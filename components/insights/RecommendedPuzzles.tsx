"use client"
// components/insights/RecommendedPuzzles.tsx
// Additive post-game affordance: for each detected concept / tactical pattern /
// motif, surface a tidy study group with BOTH "Learn" (the lesson(s) that teach
// it) and "Practice" (tagged puzzles that drill it) — each deep-linking straight
// into the lesson or puzzle step. Groups with neither are omitted.

import { useMemo } from "react"
import Link from "next/link"
import {
  recommendStudyForInsights,
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
      recommendStudyForInsights(
        { keyConceptIds, tacticalPatternIds, motifIds },
        Math.min(limitPerGroup, DEFAULT_PUZZLES_PER_GROUP),
      ).slice(0, maxGroups),
    [keyConceptIds, tacticalPatternIds, motifIds, limitPerGroup, maxGroups],
  )

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Study plan — learn &amp; practice what you played
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
                <span className="truncate">{group.title}</span>
              </p>
              <Link
                href={group.learnHref}
                className="shrink-0 text-[10px] font-bold text-emerald-700/80 dark:text-emerald-300/80 hover:text-emerald-800 dark:hover:text-emerald-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              >
                Open tag ↗
              </Link>
            </div>

            {group.lessons.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90 mb-1">
                  📘 Learn
                </p>
                <ul className="flex flex-col gap-1.5">
                  {group.lessons.map((l) => (
                    <li key={l.lessonId}>
                      <Link
                        href={l.href}
                        className="group flex items-center gap-2 rounded-lg bg-white/70 dark:bg-slate-900/40 border border-sky-100 dark:border-sky-900/50 px-3 py-2 hover:border-sky-300 dark:hover:border-sky-700 hover:bg-white dark:hover:bg-slate-900/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <span
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-sky-500/70 group-hover:bg-sky-500"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 text-xs text-gray-700 dark:text-slate-200 truncate">
                          {l.title}
                          <span className="text-gray-400 dark:text-slate-500"> · {l.courseTitle}</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-sky-600/80 dark:text-sky-400/80 opacity-0 group-hover:opacity-100 transition">
                          Learn ↗
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {group.puzzles.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-300/90 mb-1">
                  🧩 Practice
                </p>
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
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
