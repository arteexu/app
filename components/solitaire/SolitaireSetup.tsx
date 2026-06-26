"use client"
// components/solitaire/SolitaireSetup.tsx
// Setup screen: choose opening → game (or shuffle) → side → starting ply, with
// a live board preview. Game select, shuffle, and opening filter all default to
// move 1; moving the start-position slider syncs the board to the chosen ply.

import { useEffect, useMemo, useState } from "react"
import { Chessboard } from "react-chessboard"
import { clsx } from "clsx"
import type { Side, SolitaireGame, SolitaireSetup } from "@/lib/solitaire/types"
import {
  getAllGames,
  getGame,
  getOpenings,
  groupByEra,
  isAnnotatedGame,
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
import { SanNotation } from "@/components/chess/SanNotation"
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
  // Filter by the side the featured (winning) player had — i.e. the side the
  // learner will guess. null = both colors.
  const [color, setColor] = useState<Side | null>(null)
  const [search, setSearch] = useState("")
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

  // Combined client-side filter: opening AND color AND free-text search (all
  // applied together). See filterGames() for the matching rules.
  const filteredGames = useMemo(
    () => filterGames(allGames, opening, color, search),
    [allGames, opening, color, search]
  )

  const eraGroups = useMemo(() => groupByEra(filteredGames), [filteredGames])
  const hasActiveFilters = opening !== null || color !== null || search.trim() !== ""

  // Keep the selected game inside the current filter set: if a filter change
  // drops the selection out of view, jump to the first remaining match so the
  // right-hand preview/setup panel always reflects a game that's actually listed.
  // Reconciled at event time (in the change handlers) rather than in an effect.
  function reconcileSelection(next: SolitaireGame[]) {
    if (next.length > 0 && !next.some((g) => g.id === gameId)) setGameId(next[0].id)
  }

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
    reconcileSelection(filterGames(allGames, next, color, search))
  }

  function changeColor(next: Side | null) {
    setColor(next)
    reconcileSelection(filterGames(allGames, opening, next, search))
  }

  function changeSearch(next: string) {
    setSearch(next)
    reconcileSelection(filterGames(allGames, opening, color, next))
  }

  function clearFilters() {
    setOpening(null)
    setColor(null)
    setSearch("")
    reconcileSelection(allGames)
  }

  // Shuffle within whatever is currently filtered (never repeats the current game
  // when another match exists).
  function shuffle() {
    const others = filteredGames.filter((g) => g.id !== gameId)
    const pool = others.length > 0 ? others : filteredGames
    if (pool.length === 0) return
    setGameId(pool[Math.floor(Math.random() * pool.length)].id)
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

        {/* ── Filter / search bar ── */}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
            1 · Find a game
          </h2>
          <div className="rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400 dark:text-slate-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search player, opponent, event, or opening…"
                aria-label="Search games"
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 pl-10 pr-9 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              {search !== "" && (
                <button
                  onClick={() => changeSearch("")}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Opening + color */}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  Opening
                </span>
                <select
                  value={opening ?? ""}
                  onChange={(e) => changeOpening(e.target.value || null)}
                  aria-label="Filter by opening"
                  className="appearance-none rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:1.1rem] pr-10 cursor-pointer"
                >
                  <option value="">All openings ({allGames.length})</option>
                  {openings.map((o) => (
                    <option key={o.opening} value={o.opening}>
                      {o.opening} ({o.count})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  You play (winning side)
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-900/60 p-1">
                  <ColorTab label="All" active={color === null} onClick={() => changeColor(null)} />
                  <ColorTab label="♔ White" active={color === "white"} onClick={() => changeColor("white")} />
                  <ColorTab label="♚ Black" active={color === "black"} onClick={() => changeColor("black")} />
                </div>
              </div>
            </div>

            {/* Result count + clear */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                Showing{" "}
                <span className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                  {filteredGames.length}
                </span>{" "}
                of {allGames.length} {allGames.length === 1 ? "game" : "games"}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
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
                disabled={filteredGames.length === 0}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                🎲 Surprise me
              </button>
            </div>
            {filteredGames.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-10 text-center">
                <div className="text-4xl mb-2" aria-hidden>🔍</div>
                <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                  No games match your filters
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Try a different opening, color, or search term.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-full transition"
                >
                  Clear filters
                </button>
              </div>
            ) : (
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
            )}
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
                  {startLastSan ? (
                    <>
                      Solitaire begins after{" "}
                      <span className="inline-flex items-baseline gap-0.5 text-gray-600 dark:text-slate-300">
                        <span className="font-mono">
                          {fullMoveNumber(clampedStartPly - 1)}
                          {(clampedStartPly - 1) % 2 === 0 ? "." : "…"}
                        </span>
                        <SanNotation
                          san={startLastSan}
                          color={sideToMoveAt(clampedStartPly - 1)}
                        />
                      </span>.{" "}
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

/**
 * Apply the opening + color + free-text filters together (AND logic).
 * - `opening`: exact opening name, or null for all openings.
 * - `color`:  the side the featured (winning) player had — null for both.
 * - `search`: case-insensitive substring matched against title, both player
 *             names, event and opening name.
 */
function filterGames(
  games: SolitaireGame[],
  opening: string | null,
  color: Side | null,
  search: string
): SolitaireGame[] {
  const q = search.trim().toLowerCase()
  return games.filter((g) => {
    if (opening && g.opening !== opening) return false
    if (color && playableSide(g) !== color) return false
    if (q) {
      const haystack = [g.title, g.white, g.black, g.event ?? "", g.opening, g.eco]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ColorTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2 text-sm font-bold transition",
        active
          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
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

