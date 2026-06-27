"use client"
// components/play/LiveSetup.tsx
// Pre-game screen for Play vs Human: pick a time control and search for a live
// opponent. While searching it shows a cancellable "looking for opponent" state.

import { clsx } from "clsx"
import { TIME_CONTROLS } from "@/lib/play/time-controls"
import type { TimeControl } from "@/lib/play/types"

export function LiveSetup({
  timeControl,
  onSelect,
  searching,
  onSearch,
  onCancel,
  error,
}: {
  timeControl: TimeControl
  onSelect: (tc: TimeControl) => void
  searching: boolean
  onSearch: () => void
  onCancel: () => void
  error: string | null
}) {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
          Play vs Human
        </p>
        <h1 className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">
          Find a live opponent
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          You&apos;ll be matched with another player searching for the same time control. Moves and
          clocks sync in real time.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2" disabled={searching}>
        <legend className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Time control</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              type="button"
              onClick={() => onSelect(tc)}
              className={clsx(
                "flex flex-col items-center py-2.5 rounded-xl border-2 transition disabled:opacity-50",
                timeControl.id === tc.id
                  ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                  : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-rose-300 dark:hover:border-rose-700",
              )}
            >
              <span className="font-display font-extrabold tabular-nums">{tc.id}</span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">{tc.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      {searching ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
            <span className="font-display font-bold text-gray-900 dark:text-slate-100">
              Searching for an opponent…
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
            Keep this tab open. {timeControl.id} ({timeControl.label})
          </p>
          <button
            onClick={onCancel}
            className="font-display font-bold px-5 py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 transition"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={onSearch}
          className="w-full font-display text-lg font-extrabold py-3.5 rounded-2xl bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/30 transition"
        >
          ⚔️ Find opponent
        </button>
      )}
    </div>
  )
}
