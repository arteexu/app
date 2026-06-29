"use client"
// components/insights/AnalysisModeToggle.tsx
// Standard vs Deep analysis selector for the post-game insights surfaces. Deep
// mode searches deeper and writes more coach notes (slower); standard is the
// responsive default. Shared by Play, Solitaire, and the upload/review flow.

import { clsx } from "clsx"
import { ANALYSIS_MODES, type AnalysisDepthMode } from "@/lib/insights/analyze-game"

interface Props {
  mode: AnalysisDepthMode
  onChange: (mode: AnalysisDepthMode) => void
  disabled?: boolean
  className?: string
}

const ORDER: AnalysisDepthMode[] = ["standard", "deep"]

export function AnalysisModeToggle({ mode, onChange, disabled, className }: Props) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <div
        role="radiogroup"
        aria-label="Analysis depth"
        className="inline-flex items-center rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-0.5"
      >
        {ORDER.map((m) => {
          const active = mode === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={clsx(
                "text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50",
                active
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200",
              )}
            >
              {m === "deep" ? "🔬 " : "⚡ "}
              {ANALYSIS_MODES[m].label}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400 dark:text-slate-500">{ANALYSIS_MODES[mode].blurb}</p>
    </div>
  )
}
