"use client"
// components/play/SavePlayGamePanel.tsx
// Inline save UI for the Play game-over overlay. Persists to localStorage.

import { useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import {
  defaultPlayGameName,
  savePlayGame,
  type SavePlayGameInput,
} from "@/lib/play/saved-play-games"

interface Props {
  defaultName: string
  payload: Omit<SavePlayGameInput, "name">
}

export function SavePlayGamePanel({ defaultName, payload }: Props) {
  const [name, setName] = useState(defaultName)
  const [savedId, setSavedId] = useState<string | null>(null)

  function handleSave() {
    if (savedId) return
    const entry = savePlayGame({ ...payload, name })
    setSavedId(entry.id)
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        Save for review
      </span>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSavedId(null)
          }}
          disabled={savedId != null}
          aria-label="Saved game name"
          placeholder={defaultPlayGameName(payload)}
          className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          onClick={handleSave}
          disabled={savedId != null}
          className={clsx(
            "shrink-0 font-display font-bold text-sm px-4 rounded-xl transition-all",
            savedId != null
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 cursor-default"
              : "bg-emerald-600 text-white hover:bg-emerald-700",
          )}
        >
          {savedId != null ? "Saved ✓" : "Save game"}
        </button>
      </div>
      {savedId && (
        <Link
          href={`/play/saved/${savedId}`}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Open saved game →
        </Link>
      )}
      {payload.supabaseGameId && !savedId && (
        <p className="text-[11px] text-gray-400 dark:text-slate-500">
          Also stored on the server for this live match.
        </p>
      )}
    </div>
  )
}
