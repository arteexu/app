"use client"
// components/solitaire/SolitaireMultiplayer.tsx
// The "⚔️ Multiplayer" tab of Solitaire setup. Players pick a game from the
// SHARED pool (curated master games + engine games promoted by other players)
// and compete: everyone solves the same game, same side (the winner), from move
// 1, scored with the identical solitaire-scoring formula — so scores compare
// fairly. Beating the field raises your Elo. Shows your rating, the pool with
// per-game competitor counts + top scores, and a link to the leaderboard.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import { difficultyLabel } from "@/lib/solitaire-scoring"
import { fetchSharedPool } from "@/lib/multiplayer/engine-games"
import { fetchMyRating, fetchAllGameStats, type GameStat } from "@/lib/multiplayer/scores"
import {
  findBotMatch,
  searchRealMatch,
  cancelSearch,
  applyPendingMatchRatings,
  RANKED_START_FULL_MOVE,
  type OpponentChoice,
} from "@/lib/multiplayer/matchmaking"
import type { SharedGame, UserRating, MatchAndGame } from "@/lib/multiplayer/types"
import { DifficultyPips } from "./DifficultyPips"
import { ChessMindLoader } from "@/components/ui/ChessMindLoader"

// How often the real-player search polls the queue while waiting (ms).
const REAL_POLL_INTERVAL_MS = 1800
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface Props {
  /** Start a RANKED head-to-head match (matchmaking). */
  onStartMatch: (setup: SolitaireSetup, match: MatchAndGame) => void
  /** Start a CASUAL practice game on a chosen shared game (no Elo). */
  onCompete: (setup: SolitaireSetup, shared: SharedGame) => void
  /** Auto-begin a match search on mount (deep-link entry). */
  autoFind?: boolean
}

export function SolitaireMultiplayer({ onStartMatch, onCompete, autoFind = false }: Props) {
  const [pool, setPool] = useState<SharedGame[] | null>(null)
  const [stats, setStats] = useState<Map<string, GameStat>>(new Map())
  const [rating, setRating] = useState<UserRating | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "curated" | "generated">("all")

  // Matchmaking (ranked) state.
  const [searching, setSearching] = useState(false)
  const [searchKind, setSearchKind] = useState<OpponentChoice>("real")
  const [searchElapsed, setSearchElapsed] = useState(0)
  const [searchError, setSearchError] = useState<string | null>(null)
  // The opponent the user wants to face when they tap Find (real ↔ bot).
  const [oppMode, setOppMode] = useState<OpponentChoice>("real")
  const startedRef = useRef(false)
  // Monotonic search id: each new search/cancel bumps it, invalidating any
  // still-running poll loop so stale ticks can't navigate or keep polling.
  const searchGenRef = useRef(0)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshRating = useCallback(() => {
    fetchMyRating().then(setRating)
  }, [])

  const reasonMessage = (reason: "signed-out" | "no-backend" | "error") =>
    reason === "signed-out"
      ? "Sign in to play ranked matches."
      : reason === "no-backend"
        ? "Matchmaking backend isn't available yet."
        : "Couldn't find a match. Try again."

  const stopElapsed = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const beginMatch = useCallback(
    (match: MatchAndGame) => {
      searchGenRef.current++ // invalidate any loop
      stopElapsed()
      // startPly comes from the match (engine games skip the opening, same for both).
      onStartMatch({ game: match.game, side: match.side, startPly: match.startPly }, match)
    },
    [onStartMatch, stopElapsed],
  )

  // Continuous real-player search: stays in the queue and keeps polling every
  // REAL_POLL_INTERVAL_MS until a live opponent is found or the user cancels.
  const runRealSearch = useCallback(async () => {
    const gen = ++searchGenRef.current
    setSearchError(null)
    setSearchKind("real")
    setSearchElapsed(0)
    setSearching(true)
    const startedAt = Date.now()
    stopElapsed()
    elapsedTimerRef.current = setInterval(
      () => setSearchElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    )

    let first = true
    while (searchGenRef.current === gen) {
      const res = await searchRealMatch({ firstTick: first })
      first = false
      if (searchGenRef.current !== gen) return // cancelled / superseded
      if (res.kind === "match") {
        beginMatch(res.match)
        return
      }
      if (res.kind === "error") {
        searchGenRef.current++ // stop the loop
        stopElapsed()
        setSearching(false)
        setSearchError(reasonMessage(res.reason))
        void cancelSearch()
        return
      }
      // res.kind === "searching" → wait, then poll again.
      await sleep(REAL_POLL_INTERVAL_MS)
    }
  }, [beginMatch, stopElapsed])

  // Immediate bot match (explicit choice or the "play a bot instead" escape hatch).
  const runBotSearch = useCallback(async () => {
    const gen = ++searchGenRef.current
    setSearchError(null)
    setSearchKind("bot")
    setSearching(true)
    const res = await findBotMatch()
    if (searchGenRef.current !== gen) return
    if (res.ok) {
      beginMatch(res.match)
      return
    }
    searchGenRef.current++
    setSearching(false)
    setSearchError(reasonMessage(res.reason))
  }, [beginMatch])

  const find = useCallback(
    (mode: OpponentChoice) => {
      if (mode === "bot") void runBotSearch()
      else void runRealSearch()
    },
    [runBotSearch, runRealSearch],
  )

  // Cancel: stop the loop, leave the queue (so we aren't a stale queued entry).
  const stopSearch = useCallback(() => {
    searchGenRef.current++
    stopElapsed()
    setSearching(false)
    void cancelSearch()
  }, [stopElapsed])

  // Opt-in escape hatch from a real-player search → leave the queue, play a bot.
  const playBotInstead = useCallback(async () => {
    searchGenRef.current++ // stop the real loop
    stopElapsed()
    await cancelSearch() // leave the queue before creating the bot match
    void runBotSearch()
  }, [runBotSearch, stopElapsed])

  useEffect(() => {
    let alive = true
    fetchSharedPool().then((p) => alive && setPool(p))
    fetchAllGameStats().then((s) => alive && setStats(s))
    // Settle any prior live matches, then read the (possibly updated) rating.
    applyPendingMatchRatings().then(() => alive && refreshRating())
    return () => {
      alive = false
    }
  }, [refreshRating])

  // Clean up on unmount: stop any loop, clear the timer, and leave the queue so
  // we never linger as a stale searcher.
  useEffect(() => {
    return () => {
      searchGenRef.current++
      stopElapsed()
      void cancelSearch()
    }
  }, [stopElapsed])

  useEffect(() => {
    if (autoFind && !startedRef.current) {
      startedRef.current = true
      void runRealSearch()
    }
  }, [autoFind, runRealSearch])

  const filtered = useMemo(() => {
    if (!pool) return null
    const q = search.trim().toLowerCase()
    return pool.filter((s) => {
      if (filter !== "all" && s.source !== filter) return false
      if (!q) return true
      const g = s.game
      return [g.title, g.white, g.black, g.opening, g.eco, g.event ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [pool, search, filter])

  function compete(shared: SharedGame) {
    onCompete({ game: shared.game, side: shared.side, startPly: 0 }, shared)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-7">
        {/* ── Hero ── */}
        <header className="relative overflow-hidden rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-rose-600/25 bg-gradient-to-br from-rose-600 via-fuchsia-600 to-indigo-600">
          <span className="pointer-events-none select-none absolute -right-5 -top-8 text-[150px] leading-none opacity-10">⚔️</span>
          <p className="text-sm font-bold uppercase tracking-widest text-white/80">Compete</p>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5">
            Multiplayer Solitaire
          </h1>
          <p className="text-white/95 text-lg md:text-xl font-semibold mt-1.5">
            Find a ranked opponent — same game, higher score wins.
          </p>
          <p className="text-white/85 text-sm md:text-base font-medium mt-2 max-w-2xl">
            Get matched with an opponent and a randomly-chosen engine game. You both solve
            it; the higher score wins and your Elo moves head-to-head. No opponent waiting?
            You&apos;ll face a recorded &quot;ghost&quot; run instantly.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 border border-white/25 px-4 py-2">
              <span className="text-2xl" aria-hidden>♛</span>
              <div className="leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-wide text-white/75">Your rating</div>
                <div className="font-display text-xl font-extrabold tabular-nums">
                  {rating ? rating.elo : 1200}
                  <span className="text-xs font-semibold text-white/70 ml-1.5">
                    {rating ? `· ${rating.gamesPlayed} games` : "· unrated"}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white text-rose-700 font-display font-extrabold px-4 py-2.5 shadow-md hover:scale-[1.03] transition-transform"
            >
              🏆 Leaderboard
            </Link>
          </div>
        </header>

        {/* ── Ranked matchmaking ── */}
        <div className="rounded-3xl border-2 border-rose-200 dark:border-rose-800/60 bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:from-rose-950/30 dark:to-fuchsia-950/20 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">
                🎯 Ranked
              </span>
              <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight mt-0.5">
                Find a match
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5 max-w-md">
                Head-to-head Elo on a random ranked engine game (starts around move{" "}
                {RANKED_START_FULL_MOVE}). {oppMode === "real"
                  ? "Keeps searching the live queue for a real opponent until one joins (or you cancel)."
                  : "Plays immediately against a par bot."}
              </p>
            </div>
            <button
              onClick={() => void find(oppMode)}
              disabled={searching}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-rose-600 text-white font-display font-extrabold text-lg px-7 py-3.5 rounded-2xl shadow-[0_5px_0_#9f1239,0_8px_20px_rgba(225,29,72,0.35)] hover:bg-rose-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#9f1239] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-60 disabled:cursor-wait disabled:translate-y-0"
            >
              {searching ? "Searching…" : oppMode === "bot" ? "🤖 Play bot" : "⚔️ Find opponent"}
            </button>
          </div>

          {/* Opponent choice: real player vs bot */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Opponent
            </span>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-white/70 dark:bg-slate-900/40 p-1 max-w-sm">
              <OppModeTab
                label="🧑 Real player"
                active={oppMode === "real"}
                disabled={searching}
                onClick={() => setOppMode("real")}
              />
              <OppModeTab
                label="🤖 Bot"
                active={oppMode === "bot"}
                disabled={searching}
                onClick={() => setOppMode("bot")}
              />
            </div>
          </div>
        </div>

        {searchError && (
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 -mt-2">
            {searchError}
          </p>
        )}

        {/* ── Casual practice header ── */}
        <div className="flex items-end justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-2">
          <div>
            <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
              Casual practice
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Pick any game and play it solo. Scores hit the per-game leaderboard (no Elo).
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a game, player, or opening…"
              aria-label="Search shared games"
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
            />
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-800 p-1 sm:w-72">
            <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterTab label="🏆 Master" active={filter === "curated"} onClick={() => setFilter("curated")} />
            <FilterTab label="🤖 Engine" active={filter === "generated"} onClick={() => setFilter("generated")} />
          </div>
        </div>

        {/* ── Pool ── */}
        {filtered === null ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-10 text-center">
            <div className="text-4xl mb-2" aria-hidden>🔍</div>
            <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">No games match</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Try a different search or filter. Generate a game and add it to the pool to grow it.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map((shared) => (
              <CompeteCard
                key={shared.game.id}
                shared={shared}
                stat={stats.get(shared.game.id)}
                onCompete={() => compete(shared)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Searching overlay (ranked matchmaking) */}
      {searching && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-2xl p-7 flex flex-col items-center gap-4 text-center">
            <ChessMindLoader size="md" label="Setting up your match" hideLabel />
            {searchKind === "bot" ? (
              <div>
                <p className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                  Setting up your bot match…
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Loading a ranked game against the par bot.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                  Searching for a player…
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Waiting in the live queue for a real opponent. This stays open until
                  someone joins — hang tight or pick an option below.
                </p>
                <p className="mt-3 font-mono text-2xl font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                  {formatElapsed(searchElapsed)}
                </p>
              </div>
            )}

            <div className="flex flex-col w-full gap-2">
              {searchKind === "real" && (
                <button
                  onClick={() => void playBotInstead()}
                  className="font-display font-bold text-sm px-5 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
                >
                  🤖 Play a bot instead
                </button>
              )}
              <button
                onClick={stopSearch}
                className="font-display font-bold text-sm px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-rose-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function OppModeTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed",
        active
          ? "bg-rose-600 text-white shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}

function FilterTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2 text-sm font-bold transition",
        active
          ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}

function CompeteCard({
  shared,
  stat,
  onCompete,
}: {
  shared: SharedGame
  stat: GameStat | undefined
  onCompete: () => void
}) {
  const { game, side, source } = shared
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:border-rose-300 dark:hover:border-rose-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight break-words">
          {game.title}
        </span>
        <span
          className={clsx(
            "shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
            source === "generated"
              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40"
              : "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40",
          )}
        >
          {source === "generated" ? "🤖 Engine" : "🏆 Master"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-600 dark:text-slate-300">{game.opening}</span>
        <span aria-hidden>·</span>
        <span>{game.white} vs {game.black}</span>
      </div>

      <div className="flex items-center justify-between">
        <DifficultyPips difficulty={game.difficulty} />
        <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
          {difficultyLabel(game.difficulty)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-slate-700 pt-2.5">
        <span className="inline-flex items-center gap-1">
          👥 {stat ? stat.players : 0} {stat?.players === 1 ? "player" : "players"}
        </span>
        {stat && stat.topScore > 0 && (
          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
            ⚡ {stat.topScore} top
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-gray-400 dark:text-slate-500">
          {side === "white" ? "♔" : "♚"} play {side}
        </span>
      </div>

      <button
        onClick={onCompete}
        className="w-full bg-rose-600 text-white font-display font-extrabold text-sm py-2.5 rounded-xl shadow-[0_4px_0_#9f1239] hover:bg-rose-700 hover:translate-y-[1px] hover:shadow-[0_3px_0_#9f1239] active:translate-y-[3px] active:shadow-none transition-all"
      >
        ⚔️ Compete
      </button>
    </div>
  )
}
