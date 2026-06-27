"use client"

import Link from "next/link"
import { UnlockCardCelebration } from "@/components/unlocks/UnlockCardCelebration"
import { getTacticalPattern, getTacticalPatternCategory } from "@/lib/tactical-patterns"
import { clsx } from "clsx"

interface Props {
  patternId: string
  /** First-time unlock: celebration headline + confetti. Repeat: softer label only. */
  celebrate?: boolean
  className?: string
}

export function TacticalPatternUnlockCard({ patternId, celebrate = false, className }: Props) {
  const pattern = getTacticalPattern(patternId)
  if (!pattern) return null

  const category = getTacticalPatternCategory(pattern.category)

  return (
    <UnlockCardCelebration celebrate={celebrate}>
      <div
        className={clsx(
          "rounded-2xl border-2 border-rose-300/80 dark:border-rose-600/60",
          "bg-gradient-to-br from-rose-50 via-pink-50/80 to-rose-100/60",
          "dark:from-rose-950/40 dark:via-pink-950/30 dark:to-rose-900/20",
          "px-5 py-4 flex flex-col gap-2 shadow-sm shadow-rose-500/10",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {pattern.icon}
          </span>
          <span className="font-display font-extrabold text-rose-900 dark:text-rose-200 text-sm uppercase tracking-wide">
            {celebrate ? "Tactical Pattern unlocked" : "Tactical Pattern"}
          </span>
        </div>
      {category && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700/80 dark:text-rose-400/90">
          {category.title}
        </p>
      )}
      <p className="font-display font-bold text-base text-rose-950 dark:text-rose-100">
        {pattern.title}
      </p>
      <p className="text-sm leading-relaxed text-rose-900/85 dark:text-rose-200/85">
        {pattern.description}
      </p>
        <Link
          href="/tactical-patterns"
          className="text-xs font-bold text-rose-800 dark:text-rose-300 hover:underline self-start mt-1"
        >
          View all Tactical Patterns →
        </Link>
      </div>
    </UnlockCardCelebration>
  )
}
