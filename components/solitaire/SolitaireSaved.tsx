"use client"
// components/solitaire/SolitaireSaved.tsx
// "Saved games" tab of Solitaire setup. Lists engine-generated games the user
// previously saved (localStorage-backed), and lets them replay or delete each.
// Replaying reuses the stored solve side via the existing onStart() handoff, so
// startFen / side / move list are preserved exactly.

import { useEffect, useState } from "react"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import {
  deleteSavedGame,
  listSavedGames,
  type SavedSolitaireGame,
} from "@/lib/solitaire/saved-games"
import { resolveOpeningLabel } from "@/lib/solitaire/detect-opening"

interface Props {
  onStart: (setup: SolitaireSetup) => void
}

export function SolitaireSaved({ onStart }: Props) {
  // Read client-side only (localStorage) to avoid an SSR hydration mismatch.
  const [games, setGames] = useState<SavedSolitaireGame[] | null>(null)
  useEffect(() => setGames(listSavedGames()), [])

  function handlePlay(entry: SavedSolitaireGame) {
    onStart({ game: entry.game, side: entry.side, startPly: 0 })
  }

  function handleDelete(id: string) {
    setGames(deleteSavedGame(id))
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-4xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-7">
        {/* ── Hero ── */}
        <header className="relative overflow-hidden rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-amber-600/25 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500">
          <span className="pointer-events-none select-none absolute -right-5 -top-8 text-[150px] leading-none opacity-10">💾</span>
          <p className="text-sm font-bold uppercase tracking-widest text-white/80">Training mode</p>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5">
            Saved games
          </h1>
          <p className="text-white/95 text-lg md:text-xl font-semibold mt-1.5">
            Replay the engine games you saved.
          </p>
          <p className="text-white/85 text-sm md:text-base font-medium mt-2 max-w-2xl">
            Saved on this device. Pick one to play through as a Solitaire exercise again.
          </p>
        </header>

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
              Head to <strong>Generate a game</strong>, create an engine game, and tap{" "}
              <strong>Save game</strong> on the completion screen. It&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {games.map((entry) => (
              <SavedCard
                key={entry.id}
                entry={entry}
                onPlay={() => handlePlay(entry)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SavedCard({
  entry,
  onPlay,
  onDelete,
}: {
  entry: SavedSolitaireGame
  onPlay: () => void
  onDelete: () => void
}) {
  const { game, side, savedAt, name } = entry
  const openingLabel = resolveOpeningLabel(game)
  const savedDate = new Date(savedAt).toLocaleDateString()

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight break-words">
          {name}
        </span>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
          {side === "white" ? "♔ White" : "♚ Black"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
        <span className="font-semibold text-gray-600 dark:text-slate-300">{openingLabel}</span>
        <span aria-hidden>·</span>
        <span>{game.moves.length} moves</span>
        <span aria-hidden>·</span>
        <span>Saved {savedDate}</span>
      </div>
      <div className="flex gap-2 mt-0.5">
        <button
          onClick={onPlay}
          className="flex-1 bg-indigo-600 text-white font-display font-bold text-sm py-2.5 rounded-xl hover:bg-indigo-700 transition-all"
        >
          ▶ Play as {side}
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          className="shrink-0 font-display font-bold text-sm px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-all"
        >
          🗑 Delete
        </button>
      </div>
    </div>
  )
}
