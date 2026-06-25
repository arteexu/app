"use client"
// components/solitaire/SolitaireSetup.tsx
// Setup screen: choose opening → game (or shuffle) → side → starting ply, with
// a live board preview. Game select, shuffle, and opening filter all default to
// move 1; moving the start-position slider syncs the board to the chosen ply.

import { useEffect, useMemo, useState } from "react"
import { Chessboard } from "react-chessboard"
import { clsx } from "clsx"
import type { SolitaireGame, SolitaireSetup } from "@/lib/solitaire/types"
import {
  getAllGames,
  getGame,
  getGamesByOpening,
  getOpenings,
  groupByEra,
  isAnnotatedGame,
  pickRandomGame,
} from "@/lib/solitaire/games"
import {
  getStartPlyBounds,
  fenAfter,
  guessCount,
  fullMoveNumber,
  sideToMoveAt,
  playableSide,
} from "@/lib/solitaire/engine"
import { difficultyLabel } from "@/lib/solitaire-scoring"
import { getScoreRecord, type GameScoreRecord } from "@/lib/solitaire/storage"
import { buildUserHighlightStyles, composeSquareStyles } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { DifficultyPips } from "./DifficultyPips"
import { FlipBoardButton } from "./FlipBoardButton"
import { AnnotatedGameBadge } from "./AnnotatedGameBadge"

interface Props {
  initialSetup: SolitaireSetup | null
  onStart: (setup: SolitaireSetup) => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

export function SolitaireSetupScreen({ initialSetup, onStart }: Props) {
  const openings = useMemo(() => getOpenings(), [])
  const allGames = useMemo(() => getAllGames(), [])

  // react-chessboard isn't SSR-safe; this is the only board rendered during SSR
  // (play/results boards mount after a client-side phase change). Render it only
  // after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [opening, setOpening] = useState<string | null>(initialSetup?.game.opening ?? null)
  const [gameId, setGameId] = useState<string>(initialSetup?.game.id ?? allGames[0].id)
  const game = getGame(gameId) ?? allGames[0]

  // The learner always plays the winning side (derived from the result).
  const side = playableSide(game)
  // Manual board flip; default orientation = the side being played.
  const [flipped, setFlipped] = useState(false)
  const orientation = flipped ? (side === "white" ? "black" : "white") : side

  // Right-click square markers on the preview; cleared when the position changes.
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)

  const plyBounds = useMemo(() => getStartPlyBounds(game, side), [game, side])
  const [startPly, setStartPly] = useState<number>(plyBounds.minPly)
  const [boardPly, setBoardPly] = useState<number>(plyBounds.minPly)

  // When the game changes (and with it the played side), reset start ply, board, + flip.
  useEffect(() => {
    const bounds = getStartPlyBounds(game, side)
    setStartPly(bounds.minPly)
    setBoardPly(bounds.minPly)
    setFlipped(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  const gamesInOpening = useMemo(() => getGamesByOpening(opening), [opening])
  const eraGroups = useMemo(() => groupByEra(gamesInOpening), [gamesInOpening])

  const clampedStartPly = Math.min(Math.max(startPly, plyBounds.minPly), plyBounds.maxPly)
  const clampedBoardPly = Math.min(Math.max(boardPly, 0), game.moves.length)
  const previewFen = useMemo(() => fenAfter(game, clampedBoardPly), [game, clampedBoardPly])
  const guesses = guessCount(game, side, clampedStartPly)

  // Clear right-click markers whenever the previewed position changes.
  useEffect(() => {
    setUserHighlights([])
  }, [gameId, clampedBoardPly])

  const startSide = sideToMoveAt(clampedStartPly)
  const startMoveNo = fullMoveNumber(clampedStartPly)
  const startLastSan = clampedStartPly > 0 ? game.moves[clampedStartPly - 1] : null
  const startLastMoveLabel =
    clampedStartPly > 0
      ? `${fullMoveNumber(clampedStartPly - 1)}${(clampedStartPly - 1) % 2 === 0 ? "." : "…"} ${startLastSan}`
      : null

  function setStartAndBoardPly(next: number) {
    const clamped = Math.min(Math.max(next, plyBounds.minPly), plyBounds.maxPly)
    setStartPly(clamped)
    setBoardPly(clamped)
  }

  // ArrowLeft / ArrowRight step the start position (setup screen only).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setStartPly((p) => {
          const next = Math.max(plyBounds.minPly, p - 1)
          setBoardPly(next)
          return next
        })
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setStartPly((p) => {
          const next = Math.min(plyBounds.maxPly, p + 1)
          setBoardPly(next)
          return next
        })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [plyBounds.minPly, plyBounds.maxPly])

  // Best score for this game+side (localStorage, client-only to avoid SSR mismatch).
  const [record, setRecord] = useState<GameScoreRecord | null>(null)
  useEffect(() => {
    setRecord(getScoreRecord(gameId, side))
  }, [gameId, side])

  function changeOpening(next: string | null) {
    setOpening(next)
    const pool = getGamesByOpening(next)
    if (!pool.some((g) => g.id === gameId)) setGameId(pool[0].id)
  }

  function shuffle() {
    setGameId(pickRandomGame(opening, gameId).id)
  }

  function start() {
    onStart({ game, side, startPly: clampedStartPly })
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-7">
        {/* ── Hero ── */}
        <header className="relative overflow-hidden rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-indigo-600/25 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500">
          <span className="pointer-events-none select-none absolute -right-5 -top-8 text-[150px] leading-none opacity-10">♟</span>
          <p className="text-sm font-bold uppercase tracking-widest text-white/80">Training mode</p>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5">
            Solitaire Chess
          </h1>
          <p className="text-white/95 text-lg md:text-xl font-semibold mt-1.5">
            Follow a grandmaster&apos;s game and guess their moves.
          </p>
          <p className="text-white/85 text-sm md:text-base font-medium mt-2 max-w-2xl">
            Pick a famous master game and a side to play. Guess each move the grandmaster
            played — the opponent&apos;s replies are made for you.
          </p>
        </header>

        {/* ── Opening filter ── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
            1 · Choose an opening
          </h2>
          <div className="flex flex-wrap gap-2">
            <FilterChip label={`All openings (${allGames.length})`} active={opening === null} onClick={() => changeOpening(null)} />
            {openings.map((o) => (
              <FilterChip
                key={o.opening}
                label={`${o.opening} (${o.count})`}
                active={opening === o.opening}
                onClick={() => changeOpening(o.opening)}
              />
            ))}
          </div>
        </section>

        {/* ── Game picker + configure/preview ── */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
          {/* Game list */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                2 · Pick a game
              </h2>
              <button
                onClick={shuffle}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-full transition"
              >
                🎲 Surprise me
              </button>
            </div>
            <div className="flex flex-col gap-5">
              {eraGroups.map((group) => (
                <div key={group.era} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 border-b border-gray-100 dark:border-slate-800 pb-1.5">
                    <h3 className="font-display text-sm font-extrabold text-gray-700 dark:text-slate-200">
                      {group.era}
                    </h3>
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">{group.subtitle}</span>
                    <span className="ml-auto text-[11px] font-semibold text-gray-300 dark:text-slate-600">
                      {group.games.length} {group.games.length === 1 ? "game" : "games"}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {group.games.map((g) => (
                      <GameCard key={g.id} game={g} selected={g.id === gameId} onSelect={() => setGameId(g.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configure + preview */}
          <div className="lg:sticky lg:top-4 flex flex-col gap-4 bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
            <div>
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                3 · Set up &amp; preview
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-snug">
                  {game.white} <span className="text-gray-400">vs</span> {game.black}
                  {game.year ? ` · ${game.year}` : ""}
                </p>
                {isAnnotatedGame(game) && <AnnotatedGameBadge />}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">{game.note}</p>
            </div>

            {/* Board preview (client-only to avoid react-chessboard hydration mismatch) */}
            <div className="rounded-2xl overflow-hidden shadow-md" onContextMenu={(e) => e.preventDefault()}>
              {mounted ? (
                <Chessboard
                  options={{
                    position: previewFen,
                    boardOrientation: orientation,
                    allowDragging: false,
                    squareStyles: composeSquareStyles(buildUserHighlightStyles(userHighlights)),
                    darkSquareStyle: { backgroundColor: BOARD_DARK },
                    lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                    showNotation: true,
                    id: "solitaire-setup-preview",
                    ...userHighlightHandlers,
                  }}
                />
              ) : (
                <div className="aspect-square w-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              )}
            </div>

            {/* You play the winning side (locked); board can be flipped manually */}
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full">
                {side === "white" ? "♔" : "♚"} You play {side} — the winner
              </span>
              <FlipBoardButton onClick={() => setFlipped((f) => !f)} />
            </div>

            {/* Start position — single-ply (half-move) selection */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  Start position
                </span>
                <span className="font-display font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  Move {startMoveNo} · {startSide === "white" ? "White" : "Black"} to play
                </span>
              </div>
              <div className="mt-1.5">
                <input
                  type="range"
                  min={plyBounds.minPly}
                  max={plyBounds.maxPly}
                  step={1}
                  value={clampedStartPly}
                  onChange={(e) => setStartAndBoardPly(Number(e.target.value))}
                  aria-label="Starting half-move"
                  aria-valuetext={`Move ${startMoveNo}, ${startSide} to play`}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-snug">
                  {startLastMoveLabel ? (
                    <>
                      Solitaire begins after{" "}
                      <span className="font-mono text-gray-600 dark:text-slate-300">{startLastMoveLabel}</span>.{" "}
                    </>
                  ) : (
                    <>Solitaire begins at move 1 (starting position). </>
                  )}
                  Use the slider to choose where guessing starts.
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-snug">
                  You&apos;ll guess <strong className="text-gray-700 dark:text-slate-200">{guesses}</strong>{" "}
                  {guesses === 1 ? "move" : "moves"} as {side}. Play stops at move 50 or when the game ends.
                </p>
              </div>
            </div>

            {record && (
              <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3.5 py-2 text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Your best</span>
                <span className="font-display font-extrabold text-amber-700 dark:text-amber-400">
                  {record.best.score} pts · {record.best.accuracy}%
                </span>
              </div>
            )}

            <button
              onClick={start}
              className="mt-1 w-full bg-indigo-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#312e81,0_8px_20px_rgba(79,70,229,0.35)] hover:bg-indigo-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#312e81] active:translate-y-[4px] active:shadow-[0_1px_0_#312e81] transition-all"
            >
              ▶ Start guessing
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "px-3.5 py-1.5 rounded-full text-sm font-bold transition border",
        active
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
      )}
    >
      {label}
    </button>
  )
}

function GameCard({ game, selected, onSelect }: { game: SolitaireGame; selected: boolean; onSelect: () => void }) {
  const annotated = isAnnotatedGame(game)

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        "text-left rounded-2xl border-2 p-4 transition-all flex flex-col gap-2",
        selected
          ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20 shadow-md"
          : annotated
            ? "border-emerald-200/70 dark:border-emerald-800/50 bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
            : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
          {game.title}
        </span>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {annotated && <AnnotatedGameBadge />}
          <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
            {game.eco}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 leading-snug">
        {game.white} vs {game.black}
        {game.year ? ` · ${game.year}` : ""}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <DifficultyPips difficulty={game.difficulty} />
        <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
          {difficultyLabel(game.difficulty)}
        </span>
      </div>
    </button>
  )
}

