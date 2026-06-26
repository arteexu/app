"use client"
// components/leaderboard/LeaderboardView.tsx
// Two leaderboards for competitive Solitaire: a GLOBAL Elo ranking (all players)
// and a PER-GAME ranking (top scores on one shared game). Reads world-readable
// Supabase views; degrades to a friendly empty state when the multiplayer
// backend isn't populated yet.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import {
  fetchGlobalLeaderboard,
  fetchGameLeaderboard,
  fetchMyRating,
} from "@/lib/multiplayer/scores"
import { fetchSharedPool } from "@/lib/multiplayer/engine-games"
import type {
  RatingLeaderboardRow,
  GameLeaderboardRow,
  SharedGame,
  UserRating,
} from "@/lib/multiplayer/types"

type Tab = "global" | "game"

export function LeaderboardView() {
  const [tab, setTab] = useState<Tab>("global")
  const [rating, setRating] = useState<UserRating | null>(null)

  const [global, setGlobal] = useState<RatingLeaderboardRow[] | null>(null)
  const [pool, setPool] = useState<SharedGame[] | null>(null)
  const [gameId, setGameId] = useState<string>("")
  const [gameBoard, setGameBoard] = useState<GameLeaderboardRow[] | null>(null)

  useEffect(() => {
    fetchMyRating().then(setRating)
    fetchGlobalLeaderboard().then(setGlobal)
    fetchSharedPool().then((p) => {
      setPool(p)
      if (p.length > 0) setGameId(p[0].game.id)
    })
  }, [])

  useEffect(() => {
    if (!gameId) return
    setGameBoard(null)
    fetchGameLeaderboard(gameId).then(setGameBoard)
  }, [gameId])

  const selectedTitle = useMemo(
    () => pool?.find((s) => s.game.id === gameId)?.game.title ?? "",
    [pool, gameId],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl p-7 text-white shadow-xl shadow-amber-600/25 bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600">
        <span className="pointer-events-none select-none absolute -right-5 -top-8 text-[150px] leading-none opacity-10">🏆</span>
        <p className="text-sm font-bold uppercase tracking-widest text-white/80">Compete</p>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5">Leaderboard</h1>
        <p className="text-white/90 text-base font-semibold mt-1.5">
          Climb the global Elo ranking and top the charts on every shared game.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/15 border border-white/25 px-4 py-2">
            <span className="text-2xl" aria-hidden>♛</span>
            <div className="leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/75">Your rating</div>
              <div className="font-display text-xl font-extrabold tabular-nums">
                {rating ? rating.elo : 1200}
                <span className="text-xs font-semibold text-white/70 ml-1.5">
                  {rating ? `· peak ${rating.peakElo} · ${rating.gamesPlayed} games` : "· unrated"}
                </span>
              </div>
            </div>
          </div>
          <Link
            href="/solitaire"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white text-rose-700 font-display font-extrabold px-4 py-2.5 shadow-md hover:scale-[1.03] transition-transform"
          >
            ⚔️ Play to rank up
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-800 p-1 max-w-md">
        <TabButton label="🌍 Global Elo" active={tab === "global"} onClick={() => setTab("global")} />
        <TabButton label="♟ By game" active={tab === "game"} onClick={() => setTab("game")} />
      </div>

      {tab === "global" ? (
        <GlobalBoard rows={global} />
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">Game</span>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="appearance-none rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition cursor-pointer"
            >
              {(pool ?? []).map((s) => (
                <option key={s.game.id} value={s.game.id}>
                  {s.game.title} — {s.game.opening}
                </option>
              ))}
            </select>
          </label>
          <GameBoard rows={gameBoard} title={selectedTitle} />
        </div>
      )}
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2.5 text-sm font-bold transition",
        active
          ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}

function medal(rank: number): string | null {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null
}

function GlobalBoard({ rows }: { rows: RatingLeaderboardRow[] | null }) {
  if (rows === null) return <LoadingRows />
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No ranked players yet"
        body="Play a multiplayer game to earn an Elo rating and appear here."
      />
    )
  }
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700/70 overflow-hidden">
      {rows.map((row) => (
        <div
          key={row.userId}
          className={clsx(
            "flex items-center gap-3 px-4 py-3",
            row.isMe && "bg-rose-50 dark:bg-rose-900/20",
          )}
        >
          <span className="w-9 text-center font-display font-extrabold tabular-nums text-lg text-gray-400 dark:text-slate-500">
            {medal(row.rank) ?? row.rank}
          </span>
          <span className="shrink-0 w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white grid place-items-center font-bold text-sm select-none">
            {row.displayName[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {row.displayName}
              {row.isMe && <span className="ml-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">YOU</span>}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {row.gamesPlayed} {row.gamesPlayed === 1 ? "game" : "games"} · peak {row.peakElo}
            </p>
          </div>
          <span className="font-display text-xl font-extrabold tabular-nums text-gray-900 dark:text-slate-100">
            {row.elo}
          </span>
        </div>
      ))}
    </div>
  )
}

function GameBoard({ rows, title }: { rows: GameLeaderboardRow[] | null; title: string }) {
  if (rows === null) return <LoadingRows />
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No scores yet for this game"
        body={`Be the first to set a score on ${title || "this game"}.`}
      />
    )
  }
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700/70 overflow-hidden">
      {rows.map((row) => (
        <div
          key={row.userId + row.createdAt}
          className={clsx(
            "flex items-center gap-3 px-4 py-3",
            row.isMe && "bg-rose-50 dark:bg-rose-900/20",
          )}
        >
          <span className="w-9 text-center font-display font-extrabold tabular-nums text-lg text-gray-400 dark:text-slate-500">
            {medal(row.rank) ?? row.rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">
              {row.displayName}
              {row.isMe && <span className="ml-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">YOU</span>}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {row.accuracy}% accuracy · {row.movesMatched}/{row.totalMoves} matched
            </p>
          </div>
          <span className="font-display text-xl font-extrabold tabular-nums text-gray-900 dark:text-slate-100">
            {row.score}
          </span>
        </div>
      ))}
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-10 text-center">
      <div className="text-4xl mb-2" aria-hidden>🏁</div>
      <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">{title}</p>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{body}</p>
      <Link
        href="/solitaire"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-full transition"
      >
        ⚔️ Start competing
      </Link>
    </div>
  )
}
