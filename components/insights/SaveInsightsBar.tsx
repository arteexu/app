"use client"
// components/insights/SaveInsightsBar.tsx
// Tasteful, additive control row for persisting generated insights to this
// device. Purely presentational — the owning insights component holds the state
// and supplies the handlers. Shows clear saved / unsaved / stale / error states.

import { clsx } from "clsx"
import { ANALYSIS_MODES, type AnalysisDepthMode } from "@/lib/insights/analyze-game"

interface Props {
  /** A persisted record currently exists for this game. */
  saved: boolean
  /** The on-screen insights differ from what was saved (regenerated since save). */
  dirty: boolean
  savedAt: string | null
  mode: AnalysisDepthMode
  error: string | null
  onSave: () => void
  onRemove: () => void
}

function savedAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

export function SaveInsightsBar({ saved, dirty, savedAt, mode, error, onSave, onRemove }: Props) {
  const modeLabel = ANALYSIS_MODES[mode]?.label ?? mode
  const showSavedState = saved && !dirty

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {showSavedState ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span aria-hidden>✓</span> Insights saved on this device
            </span>
            {savedAt && (
              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                {modeLabel} · {savedAgo(savedAt)}
              </span>
            )}
            <button
              onClick={onRemove}
              className="ml-auto text-[11px] font-bold text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <span className="text-xs text-gray-600 dark:text-slate-300">
              {saved && dirty
                ? "You regenerated these insights — update the saved copy?"
                : `Save these ${modeLabel} insights to revisit later without re-analyzing.`}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {saved && dirty && (
                <button
                  onClick={onRemove}
                  className="text-[11px] font-bold text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                >
                  Remove
                </button>
              )}
              <button
                onClick={onSave}
                className={clsx(
                  "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  "border-indigo-200 dark:border-indigo-800 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/70",
                )}
              >
                💾 {saved && dirty ? "Update saved insights" : "Save insights"}
              </button>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
