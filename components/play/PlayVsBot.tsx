"use client"
// components/play/PlayVsBot.tsx
// A COMPLETE chess game against Stockfish. Owns the authoritative local game
// state (chess.js move list), a chess clock per side, and the engine loop:
// when it's the bot's turn it asks usePlayBot for a move and applies it. On game
// end (checkmate / stalemate / draw rules / resign / draw agreement / timeout)
// the user's SEPARATE Play rating is updated head-to-head vs the bot's nominal Elo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Chess } from "chess.js"
import Link from "next/link"
import { usePlayBot } from "@/hooks/usePlayBot"
import { usePlayClock, type ClockAnchor } from "@/hooks/usePlayClock"
import { botLevelById } from "@/lib/play/bot-levels"
import { timeControlById, startingClockMs } from "@/lib/play/time-controls"
import {
  detectResult,
  replayMoves,
  statusText,
  toPlayedMove,
  tryMove,
  colorFromChar,
} from "@/lib/play/game"
import { applyPlayResult } from "@/lib/play/ratings"
import { resultTag, type GameResult, type PieceColor, type PlayedMove } from "@/lib/play/types"
import { playBoardMoveSound } from "@/lib/ui-sounds"
import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"
import { BotSetup, type BotGameOptions } from "./BotSetup"
import { GameBoard } from "./GameBoard"
import { GameScaffold } from "./GameScaffold"
import { PlayerBar } from "./PlayerBar"
import { MoveList } from "./MoveList"
import { GameControls } from "./GameControls"
import { GameOverCard, type GameOverInfo } from "./GameOverCard"
import { SavePlayGamePanel } from "./SavePlayGamePanel"
import { defaultPlayGameName } from "@/lib/play/saved-play-games"

function otherColor(c: PieceColor): PieceColor {
  return c === "white" ? "black" : "white"
}

export function PlayVsBot({ playerName, playerRating }: { playerName: string; playerRating: number }) {
  const [opts, setOpts] = useState<BotGameOptions | null>(null)
  const [userColor, setUserColor] = useState<PieceColor>("white")
  const [moves, setMoves] = useState<PlayedMove[]>([])
  const [result, setResult] = useState<GameResult | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const [orientation, setOrientation] = useState<PieceColor>("white")
  const [drawNote, setDrawNote] = useState<string | null>(null)

  const level = useMemo(() => botLevelById(opts?.levelId), [opts?.levelId])
  const tc = useMemo(() => timeControlById(opts?.timeControlId ?? "5+0"), [opts?.timeControlId])
  const incrementMs = tc.incrementSeconds * 1000

  const { ready: botReady, requestMove, evaluate } = usePlayBot(level)

  const [clockAnchor, setClockAnchor] = useState<ClockAnchor>({
    whiteMs: startingClockMs(tc),
    blackMs: startingClockMs(tc),
    activeColor: "white",
    running: false,
    sinceMs: Date.now(),
  })

  const chess = useMemo(() => replayMoves(moves), [moves])
  const fen = chess.fen()
  const turnColor = colorFromChar(chess.turn())
  const botColor = otherColor(userColor)
  const isUserTurn = !result && opts != null && turnColor === userColor
  const lastMove = moves.length > 0 ? { from: moves[moves.length - 1].uci.slice(0, 2), to: moves[moves.length - 1].uci.slice(2, 4) } : null

  const requestedFenRef = useRef<string | null>(null)

  const { whiteMs, blackMs } = usePlayClock(clockAnchor, (color) => {
    // The side whose clock hit zero loses on time (insufficient-material nuance
    // is intentionally not applied — see known limitations).
    finishGame({ winner: otherColor(color), reason: "timeout" })
  })

  // ── Start / reset ──────────────────────────────────────────────────────────
  function start(options: BotGameOptions) {
    const color: PieceColor =
      options.color === "random" ? (Math.random() < 0.5 ? "white" : "black") : options.color
    const newTc = timeControlById(options.timeControlId)
    setOpts(options)
    setUserColor(color)
    setOrientation(color)
    setMoves([])
    setResult(null)
    setGameOverInfo(null)
    setDrawNote(null)
    requestedFenRef.current = null
    setClockAnchor({
      whiteMs: startingClockMs(newTc),
      blackMs: startingClockMs(newTc),
      activeColor: "white",
      running: true,
      sinceMs: Date.now(),
    })
  }

  function backToSetup() {
    setOpts(null)
    setResult(null)
    setGameOverInfo(null)
    setMoves([])
  }

  // ── Finish + rating ─────────────────────────────────────────────────────────
  const finishGame = useCallback(
    (res: GameResult) => {
      setResult((prev) => {
        if (prev) return prev // already finished; don't double-apply rating
        setClockAnchor((a) => ({ ...a, running: false }))
        const outcome: "win" | "loss" | "draw" =
          res.winner === "draw" ? "draw" : res.winner === userColorRef.current ? "win" : "loss"
        // Apply the SEPARATE Play rating vs the bot's nominal Elo.
        void applyPlayResult({ opponentElo: levelRef.current.nominalElo, outcome }).then((r) => {
          setGameOverInfo({
            outcome,
            winner: res.winner,
            reason: res.reason,
            eloBefore: r.persisted ? r.eloBefore : undefined,
            eloAfter: r.persisted ? r.eloAfter : undefined,
            eloDelta: r.persisted ? r.eloDelta : undefined,
            ratingNote: r.persisted ? undefined : "Sign in with the backend configured to rate games.",
          })
        })
        return res
      })
    },
    [],
  )

  // Keep refs fresh for use inside finishGame (which is created once).
  const userColorRef = useRef(userColor)
  userColorRef.current = userColor
  const levelRef = useRef(level)
  levelRef.current = level

  // ── Move application ─────────────────────────────────────────────────────────
  const applyMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (result) return false
      const res = tryMove(fenRef.current, from, to, promotion)
      if (!res) return false

      const now = Date.now()
      const anchor = clockAnchorRef.current
      const elapsed = anchor.running ? now - anchor.sinceMs : 0
      const moverColor = turnColorRef.current
      let w = anchor.whiteMs
      let b = anchor.blackMs
      if (moverColor === "white") w = Math.max(0, w - elapsed) + incrementMsRef.current
      else b = Math.max(0, b - elapsed) + incrementMsRef.current

      const ply = movesRef.current.length + 1
      const pm = toPlayedMove(res.move, res.fenAfter, ply)
      setMoves((prev) => [...prev, pm])
      setDrawNote(null)

      const afterChess = new Chess(res.fenAfter)
      try {
        playBoardMoveSound(res.move, afterChess)
      } catch {
        /* sound is best-effort */
      }

      const natural = detectResult(afterChess)
      setClockAnchor({
        whiteMs: w,
        blackMs: b,
        activeColor: otherColor(moverColor),
        running: !natural,
        sinceMs: now,
      })
      if (natural) finishGame(natural)
      return true
    },
    [result, finishGame],
  )

  // Refs so the engine's async callback always reads the latest state.
  const fenRef = useRef(fen)
  fenRef.current = fen
  const movesRef = useRef(moves)
  movesRef.current = moves
  const turnColorRef = useRef(turnColor)
  turnColorRef.current = turnColor
  const clockAnchorRef = useRef(clockAnchor)
  clockAnchorRef.current = clockAnchor
  const incrementMsRef = useRef(incrementMs)
  incrementMsRef.current = incrementMs

  // ── Bot move loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!opts || result) return
    if (turnColor !== botColor) return
    if (!botReady) return
    if (requestedFenRef.current === fen) return
    requestedFenRef.current = fen
    let cancelled = false
    void requestMove(fen).then((mv) => {
      if (cancelled || !mv) return
      applyMove(mv.from, mv.to, mv.promotion)
    })
    return () => {
      cancelled = true
    }
  }, [opts, result, turnColor, botColor, botReady, fen, requestMove, applyMove])

  // ── Controls ─────────────────────────────────────────────────────────────────
  function handleResign() {
    if (result) return
    finishGame({ winner: botColor, reason: "resign" })
  }

  async function handleOfferDraw() {
    if (result || !isUserTurn) return
    setDrawNote("Bot is considering…")
    const cp = await evaluate(fen) // centipawns relative to side to move (the user)
    const botEval = -(cp ?? 0)
    if (botEval <= 25) {
      finishGame({ winner: "draw", reason: "draw_agreement" })
    } else {
      setDrawNote("Bot declined the draw.")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!opts) {
    return (
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        <BotSetup onStart={start} />
      </div>
    )
  }

  const botName = `Bot · ${level.label}`
  const topColor = orientation === "white" ? "black" : "white"
  const bottomColor = orientation
  const nameFor = (c: PieceColor) => (c === userColor ? playerName : botName)
  const ratingFor = (c: PieceColor) => (c === userColor ? playerRating : level.nominalElo)
  const clockFor = (c: PieceColor) => (c === "white" ? whiteMs : blackMs)

  return (
    <GameScaffold
      topPlayer={
        <PlayerBar
          color={topColor}
          name={nameFor(topColor)}
          rating={ratingFor(topColor)}
          clockMs={clockFor(topColor)}
          active={!result && turnColor === topColor}
        />
      }
      bottomPlayer={
        <PlayerBar
          color={bottomColor}
          name={nameFor(bottomColor)}
          rating={ratingFor(bottomColor)}
          clockMs={clockFor(bottomColor)}
          active={!result && turnColor === bottomColor}
        />
      }
      board={
        <div className="relative w-full h-full">
          <GameBoard
            fen={fen}
            orientation={orientation}
            myColor={userColor}
            canMove={isUserTurn}
            onAttemptMove={applyMove}
            lastMove={lastMove}
            boardId="play-vs-bot"
          />
          {gameOverInfo && (
            <GameOverCard
              info={gameOverInfo}
              actions={
                <>
                  {result && (
                    <SavePlayGamePanel
                      defaultName={defaultPlayGameName({
                        opponentType: "bot",
                        opponentLabel: level.label,
                        timeControlId: tc.id,
                      })}
                      payload={{
                        opponentType: "bot",
                        opponentLabel: `Bot · ${level.label}`,
                        botLevelId: level.id,
                        timeControlId: tc.id,
                        userColor,
                        result,
                        moves,
                      }}
                    />
                  )}
                  <button
                    onClick={() => start(opts)}
                    className="w-full font-display font-extrabold py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    ↺ Rematch
                  </button>
                  <button
                    onClick={backToSetup}
                    className="w-full font-display font-bold py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
                  >
                    New game
                  </button>
                  <Link
                    href="/play/saved"
                    className="w-full text-center font-display font-bold py-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:underline transition"
                  >
                    Saved games
                  </Link>
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
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                Play vs Bot
              </p>
              <h1 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                {level.label} · {tc.id}
              </h1>
            </div>
            <FlipBoardButton onClick={() => setOrientation((o) => otherColor(o))} />
          </div>

          <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 px-4 py-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{statusText(chess)}</p>
            {!botReady && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Loading engine…</p>
            )}
            {drawNote && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{drawNote}</p>
            )}
          </div>

          <MoveList moves={moves} />

          {!result && (
            <GameControls
              canResign={!result}
              canOfferDraw={isUserTurn}
              draw={{ incoming: false, outgoing: false }}
              onResign={handleResign}
              onOfferDraw={handleOfferDraw}
              onAcceptDraw={() => {}}
              onDeclineDraw={() => {}}
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
