"use client"
import type { Step } from "@/lib/types"
import { clsx } from "clsx"

const stepIcon: Record<string, string> = {
  concept:           "📖",
  puzzle:            "♟",
  continuation:      "▶",
  "multiple-choice": "≡",
  identify:          "◎",
  "play-vs-bot":     "⚡",
}

const stepLabel: Record<string, string> = {
  concept:           "Concept",
  puzzle:            "Puzzle",
  continuation:      "Explore",
  "multiple-choice": "Question",
  identify:          "Identify",
  "play-vs-bot":     "Play",
}

interface Props {
  steps: Step[]
  viewIndex: number       // step currently on screen
  currentIndex: number    // furthest step reached (the frontier)
  completedStepIds: string[]
  onGoTo: (index: number) => void
}

export function StepProgressBar({ steps, viewIndex, currentIndex, completedStepIds, onGoTo }: Props) {
  const currentStep  = steps[viewIndex]
  const label        = currentStep ? (stepLabel[currentStep.type] ?? "Step") : "Step"
  const isReviewing  = viewIndex < currentIndex
  const canGoBack    = viewIndex > 0
  const canGoForward = viewIndex < currentIndex

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 px-4 py-2.5 flex items-center gap-3">

      {/* ← Back arrow */}
      <button
        onClick={() => onGoTo(viewIndex - 1)}
        disabled={!canGoBack}
        className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-sm font-bold",
          canGoBack
            ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            : "text-gray-300 dark:text-slate-600 cursor-not-allowed"
        )}
        aria-label="Previous step"
      >
        ‹
      </button>

      {/* Dot track */}
      <div className="flex items-center flex-1 min-w-0">
        {steps.map((step, i) => {
          const isCompleted  = completedStepIds.includes(step.id)
          const isViewing    = i === viewIndex
          const isReachable  = i <= currentIndex
          const icon         = stepIcon[step.type] ?? (i + 1)

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => isReachable && onGoTo(i)}
                disabled={!isReachable}
                title={stepLabel[step.type] ?? `Step ${i + 1}`}
                className={clsx(
                  "flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none",
                  // Size — viewing step is slightly bigger
                  isViewing ? "w-8 h-8" : "w-6 h-6",
                  // Style
                  isCompleted && isViewing
                    && "bg-indigo-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 ring-offset-1",
                  isCompleted && !isViewing
                    && "bg-indigo-600 text-white hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-700 hover:ring-offset-1 cursor-pointer",
                  !isCompleted && isViewing
                    && "bg-white dark:bg-slate-800 border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-sm",
                  !isCompleted && !isViewing && isReachable
                    && "bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-slate-600 text-gray-400 cursor-pointer hover:border-indigo-400",
                  !isReachable
                    && "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed"
                )}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
                  </svg>
                ) : (
                  <span className={clsx("leading-none select-none", isViewing ? "text-sm" : "text-xs")}>
                    {icon}
                  </span>
                )}
              </button>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div className={clsx(
                  "flex-1 h-0.5 mx-0.5 transition-colors duration-300",
                  completedStepIds.includes(step.id) ? "bg-indigo-500" : "bg-gray-200 dark:bg-slate-700"
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* → Forward arrow */}
      <button
        onClick={() => onGoTo(viewIndex + 1)}
        disabled={!canGoForward}
        className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-sm font-bold",
          canGoForward
            ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            : "text-gray-300 dark:text-slate-600 cursor-not-allowed"
        )}
        aria-label="Next step"
      >
        ›
      </button>

      {/* Label */}
      <div className="flex-shrink-0 text-right min-w-[80px]">
        {isReviewing ? (
          <p className="text-xs font-semibold text-amber-500 dark:text-amber-400">Reviewing</p>
        ) : (
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{label}</p>
        )}
        <p className="text-xs text-gray-400 dark:text-slate-500">{viewIndex + 1} / {steps.length}</p>
      </div>
    </div>
  )
}
