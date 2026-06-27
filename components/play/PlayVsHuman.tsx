"use client"
// components/play/PlayVsHuman.tsx
// A COMPLETE live chess game against another human, synced in real time over
// Supabase Realtime. Flow:
//   1. Pick a time control and search (play_queue + play_find_live_opponent RPC).
//   2. On match, load the play_games row + any moves, then subscribe to:
//        • postgres_changes INSERT on play_moves  → opponent's moves + clocks
//        • postgres_changes UPDATE on play_games   → draw offers / resign / finalize
//   3. Each move is validated locally (chess.js), applied optimistically, then
//      persisted (play_moves authoritative + play_games mirror). Clocks ride along
//      on every move row. On game end the SEPARATE Play rating is applied head-to-
//      head per the deferred pattern (finalizer writes own row; opponent applies
//      its delta on next mount via applyPendingPlayRatings()).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Chess } from "chess.js"
import Link from "next/link"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { usePlayClock, type ClockAnchor } from "@/hooks/usePlayClock"
import { DEFAULT_TIME_CONTROL } from "@/lib/play/time-controls"
import {
  colorFromChar,
  detectResult,
  movesToPgn,
  replayMoves,
  statusText,
  toPlayedMove,
  tryMove,
} from "@/lib/play/game"
import {
  applyPendingPlayRatings,
  clearDrawOffer,
  colorForUser,
  displayNameFor,
  finalizeGame,
  leaveQueue,
  loadGame,
  loadMoves,
  offerDraw,
  persistMove,
  searchLiveMatch,
  type PlayGameRow,
  type PlayMoveRow,
} from "@/lib/play/live"
import { resultTag, type EndReason, type GameResult, type PieceColor, type PlayedMove, type TimeControl } from "@/lib/play/types"
import { playBoardMoveSound } from "@/lib/ui-sounds"
import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"
import { LiveSetup } from "./LiveSetup"
import { GameBoard } from "./GameBoard"
import { GameScaffold } from "./GameScaffold"
import { PlayerBar } from "./PlayerBar"
import { MoveList } from "./MoveList"
import { GameControls } from "./GameControls"
import { GameOverCard, type GameOverInfo } from "./GameOverCard"

const SEARCH_INTERVAL_MS = 2000

function other(c: PieceColor): PieceColor {
  return c === "white" ? "black" : "white"
}

function rowToPlayed(r: PlayMoveRow): PlayedMove {
  return { ply: r.ply, san: r.san, uci: r.uci, fenAfter: r.fen_after, color: r.color }
}

export function PlayVsHuman({ playerName }: { playerName: string }) {
  const [timeControl, setTimeControl] = useState<TimeControl>(DEFAULT_TIME_CONTROL)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [gameId, setGameId] = useState<string | null>(null)
  const [myColor, setMyColor] = useState<PieceColor>("white")
  const [oppName, setOppName] = useState("Opponent")
  const [moves, setMoves] = useState<PlayedMove[]>([])
  const [drawOfferBy, setDrawOfferBy] = useState<PieceColor | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const [orientation, setOrientation] = useState<PieceColor>("white")

  const [anchor, setAnchor] = useState<ClockAnchor>({
    whiteMs: DEFAULT_TIME_CONTROL.baseSeconds * 1000,
    blackMs: DEFAULT_TIME_CONTROL.baseSeconds * 1000,
    activeColor: "white",
    running: false,
    sinceMs: Date.now(),
  })

  const chess = useMemo(() => replayMoves(moves), [moves])
  const fen = chess.fen()
  const turnColor = colorFromChar(chess.turn())
  const isMyTurn = !result && gameId != null && turnColor === myColor
  const lastMove =
    moves.length > 0
      ? { from: moves[moves.length - 1].uci.slice(0, 2), to: moves[moves.length - 1].uci.slice(2, 4) }
      : null

  // Refs so realtime/async callbacks read the latest state.
  const movesRef = useRef(moves)
  movesRef.current = moves
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor
  const resultRef = useRef(result)
  resultRef.current = result
  const myColorRef = useRef(myColor)
  myColorRef.current = myColor
  const fenRef = useRef(fen)
  fenRef.current = fen
  const gameIdRef = useRef(gameId)
  gameIdRef.current = gameId
  const incMsRef = useRef(timeControl.incrementSeconds * 1000)
  incMsRef.current = timeControl.incrementSeconds * 1000

  // Apply any pending ratings from previously-finished games on mount.
  useEffect(() => {
    void applyPendingPlayRatings()
  }, [])

  // ── Clock ────────────────────────────────────────────────────────────────────
  const { whiteMs, blackMs } = usePlayClock(anchor, (color) => {
    if (resultRef.current) return
    endLocally({ winner: other(color), reason: "timeout" })
  })

  function setClock(whiteMs: number, blackMs: number, activeColor: PieceColor, running: boolean) {
    setAnchor({ whiteMs, blackMs, activeColor, running, sinceMs: Date.now() })
  }

  // ── Finalize locally (shows card + applies my rating) ───────────────────────────
  const endLocally = useCallback((res: GameResult) => {
    if (resultRef.current) return
    resultRef.current = res
    setResult(res)
    setAnchor((a) => ({ ...a, running: false }))
    const id = gameIdRef.current
    if (!id) return
    const myOutcome: "win" | "loss" | "draw" =
      res.winner === "draw" ? "draw" : res.winner === myColorRef.current ? "win" : "loss"
    void finalizeGame(id, res.winner, res.reason).then((r) => {
      setGameOverInfo({
        outcome: myOutcome,
        winner: res.winner,
        reason: res.reason,
        eloBefore: r.persisted ? r.eloBefore : undefined,
        eloAfter: r.persisted ? r.eloAfter : undefined,
        eloDelta: r.persisted ? r.eloDelta : undefined,
        ratingNote: r.persisted ? undefined : "Rating could not be saved.",
      })
    })
  }, [])

  // ── Search loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searching || gameId) return
    let cancelled = false
    let firstTick = true
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      const res = await searchLiveMatch({
        firstTick,
        baseSeconds: timeControl.baseSeconds,
        incrementSeconds: timeControl.incrementSeconds,
      })
      firstTick = false
      if (cancelled) return
      if (res.kind === "match") {
        setSearching(false)
        setGameId(res.gameId)
        return
      }
      if (res.kind === "error") {
        setSearching(false)
        setSearchError(
          res.reason === "signed-out"
            ? "Please sign in to play live."
            : res.reason === "no-backend"
              ? "Live play backend is not configured."
              : "Something went wrong searching. Try again.",
        )
        void leaveQueue()
        return
      }
      timer = setTimeout(tick, SEARCH_INTERVAL_MS)
    }
    void tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searching, gameId, timeControl.baseSeconds, timeControl.incrementSeconds])

  // ── Load game + subscribe to Realtime once matched ─────────────────────────────
  useEffect(() => {
    if (!gameId) return
    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let cancelled = false

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const game = await loadGame(gameId!)
      if (!game || cancelled) return

      const color = colorForUser(game, user.id) ?? "white"
      setMyColor(color)
      setOrientation(color)
      const oppId = color === "white" ? game.black_id : game.white_id
      void displayNameFor(oppId).then((n) => !cancelled && setOppName(n))

      const moveRows = await loadMoves(gameId!)
      if (cancelled) return
      const played = moveRows.map(rowToPlayed)
      setMoves(played)

      const last = moveRows[moveRows.length - 1]
      const wMs = last ? last.white_clock_ms : game.white_clock_ms
      const bMs = last ? last.black_clock_ms : game.black_clock_ms
      const liveChess = replayMoves(played)
      const turn = colorFromChar(liveChess.turn())
      const isComplete = game.status === "complete"
      setClock(wMs, bMs, turn, !isComplete)

      if (isComplete && game.winner) {
        applyRowEnd(game)
      }

      channel = supabase
        .channel(`play:${gameId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "play_moves", filter: `game_id=eq.${gameId}` },
          (payload) => handleIncomingMove(payload.new as PlayMoveRow),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "play_games", filter: `id=eq.${gameId}` },
          (payload) => handleGameUpdate(payload.new as PlayGameRow),
        )
        .subscribe()
    }

    void init()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  function applyRowEnd(g: PlayGameRow) {
    if (resultRef.current || !g.winner) return
    const res: GameResult = { winner: g.winner, reason: (g.end_reason ?? "resign") as EndReason }
    endLocally(res)
  }

  // ── Realtime handlers ──────────────────────────────────────────────────────────
  function handleIncomingMove(r: PlayMoveRow) {
    const cur = movesRef.current
    if (cur.some((m) => m.ply === r.ply)) return
    // Ignore my own move echoed back (already applied optimistically).
    if (r.ply !== cur.length + 1) {
      // Out of order (missed a move) — reconcile from the DB.
      void syncFromServer()
      return
    }
    const pm = rowToPlayed(r)
    const next = [...cur, pm]
    setMoves(next)
    setDrawOfferBy(null)

    const afterChess = new Chess(r.fen_after)
    try {
      // Reconstruct the Move object for sound by replaying the last SAN.
      const before = new Chess(cur.length > 0 ? cur[cur.length - 1].fenAfter : undefined)
      const mv = before.move(r.san)
      if (mv) playBoardMoveSound(mv, afterChess)
    } catch {
      /* sound best-effort */
    }

    const nextTurn = other(r.color)
    const natural = detectResult(afterChess)
    setClock(r.white_clock_ms, r.black_clock_ms, nextTurn, !natural)
    if (natural) endLocally(natural)
  }

  function handleGameUpdate(g: PlayGameRow) {
    setDrawOfferBy(g.draw_offer_by)
    // Backup move path: play_games carries fen/turn/ply on every move via the
    // persistMove mirror update. The play_games UPDATE channel is column-only RLS
    // and always delivers, so if its ply is ahead of our local move list we pull
    // the authoritative moves from the DB — guaranteeing a move never gets stuck
    // even if the play_moves INSERT event is missed. syncFromServer() is guarded
    // so it no-ops when we're already in sync (no double-apply).
    if (g.ply > movesRef.current.length && !resultRef.current) {
      void syncFromServer()
    }
    if (g.status === "complete" && g.winner && !resultRef.current) {
      applyRowEnd(g)
    }
  }

  /**
   * Pull the authoritative move list from the DB and apply anything newer than
   * our local state. Guarded by ply count so it never re-applies a move we
   * already have (prevents double-apply when both the play_moves INSERT and the
   * play_games UPDATE arrive for the same move). `force` re-syncs even at equal
   * length to recover from a divergence (e.g. a rejected optimistic move).
   */
  async function syncFromServer(opts?: { force?: boolean }) {
    const id = gameIdRef.current
    if (!id) return
    const moveRows = await loadMoves(id)
    const prevLen = movesRef.current.length
    if (moveRows.length < prevLen) return
    if (moveRows.length === prevLen && !opts?.force) return

    const played = moveRows.map(rowToPlayed)
    setMoves(played)
    setDrawOfferBy(null)

    const last = moveRows[moveRows.length - 1]
    if (!last) return

    if (moveRows.length > prevLen) {
      try {
        const before = new Chess(
          moveRows.length > 1 ? moveRows[moveRows.length - 2].fen_after : undefined,
        )
        const mv = before.move(last.san)
        if (mv) playBoardMoveSound(mv, new Chess(last.fen_after))
      } catch {
        /* sound best-effort */
      }
    }

    const afterChess = new Chess(last.fen_after)
    const nextTurn = other(last.color)
    const natural = detectResult(afterChess)
    setClock(last.white_clock_ms, last.black_clock_ms, nextTurn, !natural)
    if (natural) endLocally(natural)
  }

  // ── Local move application ───────────────────────────────────────────────────
  const attemptMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (resultRef.current) return false
    const cur = movesRef.current
    const liveChess = replayMoves(cur)
    if (colorFromChar(liveChess.turn()) !== myColorRef.current) return false
    const res = tryMove(fenRef.current, from, to, promotion)
    if (!res) return false

    const now = Date.now()
    const a = anchorRef.current
    const elapsed = a.running ? now - a.sinceMs : 0
    let w = a.whiteMs
    let b = a.blackMs
    if (myColorRef.current === "white") w = Math.max(0, w - elapsed) + incMsRef.current
    else b = Math.max(0, b - elapsed) + incMsRef.current
    w = Math.round(w)
    b = Math.round(b)

    const ply = cur.length + 1
    const pm = toPlayedMove(res.move, res.fenAfter, ply)
    const next = [...cur, pm]
    setMoves(next)
    setDrawOfferBy(null)

    const afterChess = new Chess(res.fenAfter)
    try {
      playBoardMoveSound(res.move, afterChess)
    } catch {
      /* best-effort */
    }

    const nextTurn = other(myColorRef.current)
    const natural = detectResult(afterChess)
    setClock(w, b, nextTurn, !natural)

    const pgn = movesToPgn(next)
    const p = persistMove({
      gameId: gameIdRef.current!,
      ply,
      san: pm.san,
      uci: pm.uci,
      fenAfter: res.fenAfter,
      pgn,
      color: myColorRef.current,
      whiteClockMs: w,
      blackClockMs: b,
    })
    if (natural) {
      void p.then(() => endLocally(natural))
    } else {
      void p.then((r) => {
        if (!r.ok) void syncFromServer({ force: true })
      })
    }
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endLocally])

  // ── Controls ─────────────────────────────────────────────────────────────────
  function handleResign() {
    if (result) return
    endLocally({ winner: other(myColor), reason: "resign" })
  }
  function handleOfferDraw() {
    if (result || !gameId) return
    setDrawOfferBy(myColor)
    void offerDraw(gameId, myColor)
  }
  function handleAcceptDraw() {
    if (result) return
    endLocally({ winner: "draw", reason: "draw_agreement" })
  }
  function handleDeclineDraw() {
    if (!gameId) return
    setDrawOfferBy(null)
    void clearDrawOffer(gameId)
  }

  function reset() {
    setGameId(null)
    gameIdRef.current = null
    setMoves([])
    setResult(null)
    resultRef.current = null
    setGameOverInfo(null)
    setDrawOfferBy(null)
    setSearchError(null)
  }

  function startSearch() {
    setSearchError(null)
    setSearching(true)
  }
  function cancelSearch() {
    setSearching(false)
    void leaveQueue()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!gameId) {
    return (
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        <LiveSetup
          timeControl={timeControl}
          onSelect={setTimeControl}
          searching={searching}
          onSearch={startSearch}
          onCancel={cancelSearch}
          error={searchError}
        />
      </div>
    )
  }

  const drawIncoming = drawOfferBy != null && drawOfferBy !== myColor
  const drawOutgoing = drawOfferBy != null && drawOfferBy === myColor

  const topColor = other(orientation)
  const bottomColor = orientation
  const nameFor = (c: PieceColor) => (c === myColor ? playerName : oppName)
  const clockFor = (c: PieceColor) => (c === "white" ? whiteMs : blackMs)

  return (
    <GameScaffold
      topPlayer={
        <PlayerBar
          color={topColor}
          name={nameFor(topColor)}
          clockMs={clockFor(topColor)}
          active={!result && turnColor === topColor}
        />
      }
      bottomPlayer={
        <PlayerBar
          color={bottomColor}
          name={nameFor(bottomColor)}
          clockMs={clockFor(bottomColor)}
          active={!result && turnColor === bottomColor}
        />
      }
      board={
        <div className="relative w-full h-full">
          <GameBoard
            fen={fen}
            orientation={orientation}
            myColor={myColor}
            canMove={isMyTurn}
            onAttemptMove={attemptMove}
            lastMove={lastMove}
            boardId="play-vs-human"
          />
          {gameOverInfo && (
            <GameOverCard
              info={gameOverInfo}
              actions={
                <>
                  <button
                    onClick={reset}
                    className="w-full font-display font-extrabold py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
                  >
                    ⚔️ New game
                  </button>
                  <Link
                    href="/play"
                    className="w-full text-center font-display font-bold py-2.5 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition"
                  >
                    Back to Play
                  </Link>
                </>
              }
            />
          )}
        </div>
      }
      panel={
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                Play vs Human
              </p>
              <h1 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                {timeControl.id} · {timeControl.label}
              </h1>
            </div>
            <FlipBoardButton onClick={() => setOrientation((o) => other(o))} />
          </div>

          <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              {result ? statusText(chess) : isMyTurn ? "Your move" : `Waiting for ${oppName}…`}
            </p>
          </div>

          <MoveList moves={moves} />

          {!result && (
            <GameControls
              canResign={!result}
              canOfferDraw={!result}
              draw={{ incoming: drawIncoming, outgoing: drawOutgoing }}
              onResign={handleResign}
              onOfferDraw={handleOfferDraw}
              onAcceptDraw={handleAcceptDraw}
              onDeclineDraw={handleDeclineDraw}
            />
          )}

          {result && (
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Game over — {result.winner === "draw" ? "draw" : `${result.winner} wins`}. PGN:{" "}
              <span className="font-mono">{resultTag(result.winner)}</span>
            </p>
          )}
        </>
      }
    />
  )
}
