"use client"
// components/analysis/AnalysisSaved.tsx
// "Saved analyses" collection, surfaced as a tab inside the Free Analysis panel
// (not a global nav item). Lists studies the user saved (localStorage-backed)
// and lets them reopen (restoring position + full variation tree), rename
// inline, or delete. Mounts only when the user switches to this tab (client
// side), so the saved list is read via a lazy initializer without an SSR
// hydration mismatch.

import { useState } from "react"
import { clsx } from "clsx"
import {
  deleteSavedAnalysis,
  listSavedAnalyses,
  renameSavedAnalysis,
  type SavedAnalysis,
} from "@/lib/analysis/saved-analyses"
import { countPlies } from "@/lib/analysis/move-tree"

interface Props {
  onOpen: (entry: SavedAnalysis) => void
}

export function AnalysisSaved({ onOpen }: Props) {
  const [items, setItems] = useState<SavedAnalysis[]>(() => listSavedAnalyses())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")

  function beginRename(entry: SavedAnalysis) {
    setEditingId(entry.id)
    setDraftName(entry.name)
  }

  function commitRename() {
    if (editingId) setItems(renameSavedAnalysis(editingId, draftName))
    setEditingId(null)
    setDraftName("")
  }

  function handleDelete(id: string) {
    setItems(deleteSavedAnalysis(id))
    if (editingId === id) setEditingId(null)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 p-8 text-center">
        <div className="text-3xl mb-2" aria-hidden>
          💾
        </div>
        <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
          No saved analyses yet
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
          Build a line on the board, then use <strong>Save analysis</strong> on the Analysis tab.
          Saved studies appear here on this device.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((entry) => {
        const plies = countPlies(entry.tree)
        const savedDate = new Date(entry.savedAt).toLocaleDateString()
        const isEditing = editingId === entry.id
        return (
          <li
            key={entry.id}
            className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              {isEditing ? (
                <input
                  value={draftName}
                  autoFocus
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") {
                      setEditingId(null)
                      setDraftName("")
                    }
                  }}
                  onBlur={commitRename}
                  aria-label="Rename analysis"
                  className="flex-1 min-w-0 text-sm font-display font-extrabold px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              ) : (
                <span className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight break-words">
                  {entry.name}
                </span>
              )}
              {entry.evalText && !isEditing && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full tabular-nums">
                  {entry.evalText}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
              <span>{plies === 1 ? "1 ply" : `${plies} plies`}</span>
              <span aria-hidden>·</span>
              <span>Saved {savedDate}</span>
            </div>

            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => onOpen(entry)}
                className="flex-1 bg-indigo-600 text-white font-display font-bold text-sm py-2 rounded-xl hover:bg-indigo-700 transition"
              >
                ▶ Reopen
              </button>
              <button
                onClick={() => (isEditing ? commitRename() : beginRename(entry))}
                aria-label={isEditing ? `Save name for ${entry.name}` : `Rename ${entry.name}`}
                className={clsx(
                  "shrink-0 font-display font-bold text-sm px-3 py-2 rounded-xl border-2 transition",
                  isEditing
                    ? "border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                    : "border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400",
                )}
              >
                {isEditing ? "✓" : "✎"}
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                aria-label={`Delete ${entry.name}`}
                className="shrink-0 font-display font-bold text-sm px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition"
              >
                🗑
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
