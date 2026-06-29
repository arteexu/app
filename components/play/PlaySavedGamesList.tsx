"use client"
// components/play/PlaySavedGamesList.tsx
// Lists Play games saved to localStorage with review, rename, and delete.

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  deleteSavedPlayGame,
  listSavedPlayGames,
  renameSavedPlayGame,
  type SavedPlayGame,
} from "@/lib/play/saved-play-games"
import { deleteSavedInsights, hasSavedInsights } from "@/lib/insights/saved-insights"
import { resultTag } from "@/lib/play/types"

export function PlaySavedGamesList() {
  const [games, setGames] = useState<SavedPlayGame[] | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage read
  useEffect(() => setGames(listSavedPlayGames()), [])

  function handleDelete(id: string) {
    // Also drop any saved insights for this game so nothing is orphaned.
    deleteSavedInsights(`play:${id}`)
    setGames(deleteSavedPlayGame(id))
  }

  function handleRename(id: string, name: string) {
    setGames(renameSavedPlayGame(id, name))
  }

  return (
    <div className="flex flex-col gap-6">
      {games === null ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-10 text-center">
          <div className="text-4xl mb-2" aria-hidden>💾</div>
          <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
            No saved games yet
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Finish a game vs the bot or a live opponent and tap{" "}
            <strong>Save game</strong> on the game-over screen.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Link
              href="/play/bot"
              className="font-display font-bold text-sm px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Play vs Bot
            </Link>
            <Link
              href="/play/live"
              className="font-display font-bold text-sm px-4 py-2 rounded-xl border-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              Play vs Human
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {games.map((entry) => (
            <SavedCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
              onRename={(name) => handleRename(entry.id, name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SavedCard({
  entry,
  onDelete,
  onRename,
}: {
  entry: SavedPlayGame
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(entry.name)
  const [hasInsights, setHasInsights] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage read
    setHasInsights(hasSavedInsights(`play:${entry.id}`))
  }, [entry.id])
  const savedDate = new Date(entry.savedAt).toLocaleDateString()
  const outcome =
    entry.result.winner === "draw"
      ? "Draw"
      : entry.result.winner === entry.userColor
        ? "Win"
        : "Loss"

  function commitRename() {
    onRename(editName)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => e.key === "Enter" && commitRename()}
            autoFocus
            className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-slate-700 px-2 py-1 text-sm font-bold"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight break-words text-left hover:underline"
            title="Click to rename"
          >
            {entry.name}
          </button>
        )}
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
          {entry.userColor === "white" ? "♔ White" : "♚ Black"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-600 dark:text-slate-300">
          {entry.opponentLabel}
        </span>
        <span aria-hidden>·</span>
        <span>{entry.timeControlId}</span>
        <span aria-hidden>·</span>
        <span>{entry.moves.length} plies</span>
        <span aria-hidden>·</span>
        <span>
          {outcome} ({resultTag(entry.result.winner)})
        </span>
        <span aria-hidden>·</span>
        <span>Saved {savedDate}</span>
        {hasInsights && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
              🧠 Insights saved
            </span>
          </>
        )}
      </div>
      <div className="flex gap-2 mt-0.5">
        <Link
          href={`/play/saved/${entry.id}`}
          className="flex-1 text-center bg-indigo-600 text-white font-display font-bold text-sm py-2.5 rounded-xl hover:bg-indigo-700 transition-all"
        >
          ▶ Review
        </Link>
        <button
          onClick={onDelete}
          aria-label={`Delete ${entry.name}`}
          className="shrink-0 font-display font-bold text-sm px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-all"
        >
          🗑
        </button>
      </div>
    </div>
  )
}
