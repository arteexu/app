"use client"
// components/play/PlayerBar.tsx
// One side's name + clock row, shown above/below the board. Highlights the clock
// when it's that side's turn and turns red under 10s (or when flagged).

import { clsx } from "clsx"
import { formatClock } from "@/lib/play/time-controls"
import type { PieceColor } from "@/lib/play/types"

export function PlayerBar({
  color,
  name,
  rating,
  clockMs,
  active,
  showClock = true,
}: {
  color: PieceColor
  name: string
  rating?: number | null
  clockMs: number
  active: boolean
  showClock?: boolean
}) {
  const low = clockMs <= 10000
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-2 border transition-colors",
        active
          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40"
          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={clsx(
            "inline-block w-3.5 h-3.5 rounded-full border",
            color === "white"
              ? "bg-white border-gray-400"
              : "bg-slate-900 border-slate-600",
          )}
          aria-hidden
        />
        <span className="font-display font-bold text-sm text-gray-900 dark:text-slate-100 truncate">
          {name}
        </span>
        {rating != null && (
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 tabular-nums">
            {rating}
          </span>
        )}
      </div>
      {showClock && (
        <span
          className={clsx(
            "font-mono font-extrabold text-lg sm:text-xl tabular-nums px-2.5 py-0.5 rounded-lg",
            low
              ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40"
              : active
                ? "text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900"
                : "text-gray-500 dark:text-slate-400",
          )}
        >
          {formatClock(clockMs)}
        </span>
      )}
    </div>
  )
}
