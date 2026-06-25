"use client"
// components/solitaire/DifficultyPips.tsx
// Five-dot difficulty meter (1–5), filled in amber.
import { clsx } from "clsx"

export function DifficultyPips({ difficulty, className }: { difficulty: number; className?: string }) {
  const filled = Math.max(1, Math.min(5, Math.round(difficulty)))
  return (
    <span className={clsx("inline-flex items-center gap-1", className)} aria-label={`Difficulty ${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={clsx(
            "w-2 h-2 rounded-full",
            n <= filled ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-600"
          )}
        />
      ))}
    </span>
  )
}
