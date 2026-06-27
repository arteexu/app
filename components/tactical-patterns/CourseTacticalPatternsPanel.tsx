"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getTacticalPatternsForCourse } from "@/lib/tactical-patterns"
import { getUnlockedTacticalPatternIds } from "@/lib/tactical-patterns-storage"
import { clsx } from "clsx"

interface Props {
  lessonIds: string[]
}

export function CourseTacticalPatternsPanel({ lessonIds }: Props) {
  const patterns = getTacticalPatternsForCourse(lessonIds)
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])

  useEffect(() => {
    setUnlockedIds(getUnlockedTacticalPatternIds())
  }, [])

  if (patterns.length === 0) return null

  const unlockedSet = new Set(unlockedIds)

  return (
    <section className="mt-10 rounded-[1.75rem] border border-rose-200/60 dark:border-rose-900/40 bg-gradient-to-br from-rose-50/80 via-white to-pink-50/40 dark:from-rose-950/20 dark:via-slate-900/40 dark:to-pink-950/10 px-5 sm:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-400">
            Tactical Patterns in this course
          </p>
          <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">
            Motifs to spot in one glance
          </h3>
        </div>
        <Link
          href="/tactical-patterns"
          className="text-sm font-bold text-rose-800 dark:text-rose-300 hover:underline self-start sm:self-auto"
        >
          Browse all →
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {patterns.map((pattern) => {
          const unlocked = unlockedSet.has(pattern.id)
          return (
            <li
              key={pattern.id}
              className={clsx(
                "rounded-xl border px-4 py-3 flex items-start gap-3",
                unlocked
                  ? "border-rose-300/70 dark:border-rose-800 bg-white/70 dark:bg-slate-900/50"
                  : "border-gray-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30",
              )}
            >
              <span className="text-base mt-0.5" aria-hidden>
                {unlocked ? pattern.icon : "🔒"}
              </span>
              <div>
                <p className="font-display font-bold text-sm text-gray-900 dark:text-slate-100">
                  {pattern.title}
                </p>
                {unlocked && (
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {pattern.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
