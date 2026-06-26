"use client"

import Link from "next/link"
import { UnlockCardCelebration } from "@/components/unlocks/UnlockCardCelebration"
import {
  formatQuickestMoves,
  type CheckmateBadgeRecord,
} from "@/lib/checkmate-badges-storage"
import {
  getCheckmateBadge,
  getCheckmateBadgeTitle,
} from "@/lib/checkmate-badges"
import { clsx } from "clsx"

interface Props {
  badgeId: string
  record: CheckmateBadgeRecord
  /** First-time earn: celebration headline + confetti. Repeat: softer label only. */
  celebrate?: boolean
  className?: string
}

export function CheckmateBadgeUnlockCard({ badgeId, record, celebrate = false, className }: Props) {
  const badge = getCheckmateBadge(badgeId)
  if (!badge) return null

  return (
    <UnlockCardCelebration celebrate={celebrate}>
      <div
        className={clsx(
          "rounded-2xl border-2 border-indigo-300/80 dark:border-indigo-600/60",
          "bg-gradient-to-br from-indigo-50 via-violet-50/80 to-rose-50/60",
          "dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-rose-950/20",
          "px-5 py-4 flex flex-col gap-2 shadow-sm shadow-indigo-500/10",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {badge.emoji}
          </span>
          <span className="font-display font-extrabold text-indigo-900 dark:text-indigo-200 text-sm uppercase tracking-wide">
            {celebrate ? "Checkmate badge earned" : "Checkmate badge"}
          </span>
        </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700/80 dark:text-indigo-400/90">
        Endgame drills
      </p>
      <p className="font-display font-bold text-base text-indigo-950 dark:text-indigo-100">
        {getCheckmateBadgeTitle(badge)}
      </p>
      <p className="text-sm text-indigo-900/85 dark:text-indigo-200/85">
        {badge.subtitle} — {formatQuickestMoves(record.quickestMoves)}
      </p>
        <Link
          href="/settings/statistics"
          className="text-xs font-bold text-indigo-800 dark:text-indigo-300 hover:underline self-start mt-1"
        >
          View checkmate badges →
        </Link>
      </div>
    </UnlockCardCelebration>
  )
}
