"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CHECKMATE_BADGES,
  getCheckmateBadgeTitle,
} from "@/lib/checkmate-badges"
import {
  formatQuickestMoves,
  getAllCheckmateBadgeRecords,
} from "@/lib/checkmate-badges-storage"
import { clsx } from "clsx"

export function CheckmateBadgesPanel() {
  const [records, setRecords] = useState<ReturnType<typeof getAllCheckmateBadgeRecords>>({})

  const refresh = useCallback(() => {
    setRecords(getAllCheckmateBadgeRecords())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [refresh])

  const earnedCount = CHECKMATE_BADGES.filter((b) => records[b.id]).length

  if (earnedCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 p-6 text-center">
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">No checkmate badges yet</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
          Complete the King + Queen and King + Rook vs lone King endgame drills to earn badges and track your quickest mates.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CHECKMATE_BADGES.map((badge) => (
            <Link
              key={badge.id}
              href={`/lessons/${badge.lessonId}`}
              className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition"
            >
              {getCheckmateBadgeTitle(badge)}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold text-gray-500 dark:text-slate-400 tabular-nums">
        {earnedCount} of {CHECKMATE_BADGES.length} earned
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CHECKMATE_BADGES.map((badge) => {
          const record = records[badge.id]
          const earned = !!record

          return (
            <li
              key={badge.id}
              className={clsx(
                "rounded-2xl border-2 px-4 py-3 flex items-start gap-3",
                earned
                  ? "border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 opacity-60",
              )}
            >
              <span
                className={clsx(
                  "flex-shrink-0 w-10 h-10 rounded-xl grid place-items-center text-lg",
                  earned
                    ? "bg-gradient-to-br from-indigo-400 to-rose-500 text-white shadow-md shadow-indigo-500/20"
                    : "bg-gray-200 dark:bg-slate-800 grayscale",
                )}
                aria-hidden
              >
                {earned ? badge.emoji : "🔒"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold text-sm text-gray-900 dark:text-slate-100 leading-snug">
                  {getCheckmateBadgeTitle(badge)}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{badge.subtitle}</p>
                {earned && record && (
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                    {formatQuickestMoves(record.quickestMoves)}
                  </p>
                )}
                {!earned && (
                  <Link
                    href={`/lessons/${badge.lessonId}`}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1.5 inline-block"
                  >
                    Start drill →
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
