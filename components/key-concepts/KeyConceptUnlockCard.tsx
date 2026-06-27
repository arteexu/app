"use client"

import Link from "next/link"
import { UnlockCardCelebration } from "@/components/unlocks/UnlockCardCelebration"
import { getKeyConcept } from "@/lib/key-concepts"
import { clsx } from "clsx"

interface Props {
  conceptId: string
  /** First-time unlock: celebration headline + confetti. Repeat: softer label only. */
  celebrate?: boolean
  className?: string
}

export function KeyConceptUnlockCard({ conceptId, celebrate = false, className }: Props) {
  const concept = getKeyConcept(conceptId)
  if (!concept) return null

  return (
    <UnlockCardCelebration celebrate={celebrate}>
      <div
        className={clsx(
          "rounded-2xl border-2 border-amber-300/80 dark:border-amber-600/60",
          "bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-100/60",
          "dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-900/20",
          "px-5 py-4 flex flex-col gap-2 shadow-sm shadow-amber-500/10",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {concept.icon}
          </span>
          <span className="font-display font-extrabold text-amber-900 dark:text-amber-200 text-sm uppercase tracking-wide">
            {celebrate ? "Key Concept unlocked" : "Key Concept"}
          </span>
        </div>
      <p className="font-display font-bold text-base text-amber-950 dark:text-amber-100">
        {concept.title}
      </p>
      <p className="text-sm leading-relaxed text-amber-900/85 dark:text-amber-200/85">
        {concept.description}
      </p>
        <Link
          href="/key-concepts"
          className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline self-start mt-1"
        >
          View all Key Concepts →
        </Link>
      </div>
    </UnlockCardCelebration>
  )
}
