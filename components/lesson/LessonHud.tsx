"use client"
// components/lesson/LessonHud.tsx
// Quest HUD — replaces StepProgressBar. A dark game HUD that stays muted while
// the learner is thinking and `lit` ignites it on a correct answer. Keeps the
// same step-navigation contract as StepProgressBar (onGoTo to any reached step).
import type { Step } from "@/lib/types"
import { clsx } from "clsx"
import { ComboIndicator } from "@/components/lesson/ComboIndicator"

const stepIcon: Record<string, string> = {
  concept: "📖", puzzle: "♟", continuation: "▶", "multiple-choice": "≡",
  identify: "◎", "play-vs-bot": "⚡", "find-all-checkmates": "🔍", "move-multiple-choice": "⚖",
}
const stepLabel: Record<string, string> = {
  concept: "Concept", puzzle: "Puzzle", continuation: "Explore", "multiple-choice": "Question",
  identify: "Identify", "play-vs-bot": "Play", "find-all-checkmates": "Find Mates", "move-multiple-choice": "Best Move",
}

interface Props {
  steps: Step[]
  viewIndex: number
  currentIndex: number
  completedStepIds: string[]
  onGoTo: (index: number) => void
  combo: number
  sessionXp: number
  timerLabel: string
  timerPct: number        // 0–1, drives the ring
  lit?: boolean           // true momentarily on a correct answer
}

function TimerRing({ pct, label, lit }: { pct: number; label: string; lit?: boolean }) {
  const r = 13, c = 2 * Math.PI * r
  return (
    <div className="relative w-[34px] h-[34px]" style={{ opacity: lit ? 1 : 0.55 }}>
      <svg width="34" height="34">
        <circle cx="17" cy="17" r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={lit ? "#f59e0b" : "#475569"} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(pct, 0), 1))} transform="rotate(-90 17 17)" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[8.5px] font-extrabold text-slate-300 font-mono">{label}</span>
    </div>
  )
}

export function LessonHud({ steps, viewIndex, currentIndex, completedStepIds, onGoTo, combo, sessionXp, timerLabel, timerPct, lit }: Props) {
  const canBack = viewIndex > 0
  const canFwd = viewIndex < currentIndex

  return (
    <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 h-[52px] sm:h-[60px] bg-[#0b1220] border-b border-slate-800 flex-shrink-0 min-w-0 overflow-hidden">
      <ComboIndicator combo={combo} lit={lit} />

      {/* Back arrow */}
      <button onClick={() => onGoTo(viewIndex - 1)} disabled={!canBack} aria-label="Previous step"
        className={clsx("w-7 h-7 rounded-full grid place-items-center flex-shrink-0 text-base font-bold transition-colors",
          canBack ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 cursor-not-allowed")}>‹</button>

      {/* Step rail */}
      <div className="flex-1 flex items-center min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((step, i) => {
          const done = completedStepIds.includes(step.id)
          const viewing = i === viewIndex
          const reachable = i <= currentIndex
          const icon = stepIcon[step.type] ?? (i + 1)
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => reachable && onGoTo(i)}
                disabled={!reachable}
                title={stepLabel[step.type] ?? `Step ${i + 1}`}
                className={clsx(
                  "flex-shrink-0 rounded-full grid place-items-center transition-all duration-200 focus:outline-none",
                  viewing ? "w-8 h-8" : "w-6 h-6",
                  done && "bg-indigo-600 text-white",
                  done && viewing && "ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-[#0b1220]",
                  done && !viewing && "hover:ring-2 hover:ring-indigo-400/50 cursor-pointer",
                  !done && viewing && "bg-indigo-500/15 border-2 border-indigo-500 text-indigo-300 shadow-[0_0_14px_rgba(99,102,241,0.5)]",
                  !done && !viewing && reachable && "border-2 border-slate-600 text-slate-500 cursor-pointer hover:border-indigo-400",
                  !reachable && "border border-slate-700 text-slate-600 cursor-not-allowed",
                )}
              >
                {done ? (
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
                  </svg>
                ) : (
                  <span className={clsx("leading-none select-none", viewing ? "text-sm" : "text-xs")}>{icon}</span>
                )}
              </button>
              {i < steps.length - 1 && (
                <div className={clsx("flex-1 h-[2px] mx-1 rounded transition-colors duration-300",
                  done ? "bg-indigo-500" : "bg-slate-800")} />
              )}
            </div>
          )
        })}
      </div>

      {/* Forward arrow */}
      <button onClick={() => onGoTo(viewIndex + 1)} disabled={!canFwd} aria-label="Next step"
        className={clsx("w-7 h-7 rounded-full grid place-items-center flex-shrink-0 text-base font-bold transition-colors",
          canFwd ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 cursor-not-allowed")}>›</button>

      {/* Timer + XP */}
      <div className="flex items-center gap-2 sm:gap-3.5 flex-shrink-0">
        <TimerRing pct={timerPct} label={timerLabel} lit={lit} />
        <div className="flex items-center gap-1 sm:gap-1.5 bg-[#111a2e] border border-slate-800 rounded-full px-2 sm:px-3 py-1 sm:py-1.5">
          <span className="text-[13px]">⚡</span>
          <span className="font-display text-xs sm:text-sm font-extrabold text-slate-200 font-mono">{sessionXp.toLocaleString()}</span>
          <span className="hidden sm:inline text-[11px] font-bold text-slate-500">XP</span>
        </div>
      </div>
    </div>
  )
}
