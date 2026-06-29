"use client"
// components/insights/RecommendedPuzzles.tsx
// Additive post-game affordance: for each detected concept / tactical pattern /
// motif that has matching tagged puzzles, surface a few "Practice this" links
// that deep-link the learner straight into the relevant puzzle step.

import { useMemo } from "react"
import Link from "next/link"
import {
  recommendPuzzlesForInsights,
  DEFAULT_PUZZLES_PER_GROUP,
} from "@/lib/insights/puzzle-recommendations"
import type { InsightMotifId } from "@/lib/insights/motifs"

interface Props {
  keyConceptIds?: readonly string[]
  tacticalPatternIds?: readonly string[]
  motifIds?: readonly InsightMotifId[]
  /** Max puzzles surfaced per concept/pattern. Defaults to a tasteful 3. */
  limitPerGroup?: number
  /** Max number of concept/pattern groups shown. */
  maxGroups?: number
}

export function RecommendedPuzzles({
  keyConceptIds,
  tacticalPatternIds,
  motifIds,
  limitPerGroup = 3,
  maxGroups = 4,
}: Props) {
  const groups = useMemo(
    () =>
      recommendPuzzlesForInsights(
        { keyConceptIds, tacticalPatternIds, motifIds },
        Math.min(limitPerGroup, DEFAULT_PUZZLES_PER_GROUP),
      ).slice(0, maxGroups),
    [keyConceptIds, tacticalPatternIds, motifIds, limitPerGroup, maxGroups],
  )

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Recommended puzzles — practice what you played
      </p>
      <div className="flex flex-col gap-2.5">
        {groups.map((group) => (
          <div
            key={`${group.kind}-${group.id}`}
            className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-display font-bold text-emerald-950 dark:text-emerald-100 text-sm flex items-center gap-1.5 min-w-0">
                <span className="shrink-0" aria-hidden>{group.icon}</span>
                <span className="truncate">Practice: {group.title}</span>
              </p>
              <Link
                href={group.learnHref}
                className="shrink-0 text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300/80 hover:text-emerald-800 dark:hover:text-emerald-200 hover:underline"
              >
                Learn ↗
              </Link>
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.puzzles.map((p) => (
                <li key={p.stepId}>
                  <Link
                    href={p.href}
                    className="group flex items-center gap-2 rounded-lg bg-white/70 dark:bg-slate-900/40 border border-emerald-100 dark:border-emerald-900/50 px-3 py-2 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white dark:hover:bg-slate-900/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span
                      className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500/70 group-hover:bg-emerald-500"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-xs text-gray-700 dark:text-slate-200 truncate">
                      {p.question}
                    </span>
                    <span className="shrink-0 text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 opacity-0 group-hover:opacity-100 transition">
                      Solve ↗
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
