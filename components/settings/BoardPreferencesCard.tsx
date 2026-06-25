"use client"

import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { clsx } from "clsx"

export function BoardPreferencesCard() {
  const { showLegalMoves, setShowLegalMoves, boardSounds, setBoardSounds } = useBoardPreferences()

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Chess board</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Control how the board behaves during lessons and puzzles.
      </p>

      <div className="flex flex-col gap-5">
        <PreferenceToggle
          label="Show legal moves"
          description="Highlight possible squares when you select or drag a piece."
          checked={showLegalMoves}
          onChange={() => setShowLegalMoves(!showLegalMoves)}
          ariaLabel="Show legal moves"
        />
        <PreferenceToggle
          label="Board sounds"
          description="Soft move, capture, and check sounds when pieces are played."
          checked={boardSounds}
          onChange={() => setBoardSounds(!boardSounds)}
          ariaLabel="Board sounds"
        />
      </div>
    </div>
  )
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  ariaLabel,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  ariaLabel: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={onChange}
        className={clsx(
          "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
          checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-slate-600",
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}
