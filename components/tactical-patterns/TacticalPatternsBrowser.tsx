"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  TACTICAL_PATTERN_CATEGORIES,
  TACTICAL_PATTERNS,
  getPatternsByCategory,
} from "@/lib/tactical-patterns"
import { getUnlockedTacticalPatternIds } from "@/lib/tactical-patterns-storage"
import { findLessonInCourses } from "@/lib/courses"
import { clsx } from "clsx"

export function TacticalPatternsBrowser() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])

  useEffect(() => {
    setUnlockedIds(getUnlockedTacticalPatternIds())
  }, [])

  const unlockedSet = new Set(unlockedIds)
  const unlockedCount = TACTICAL_PATTERNS.filter((p) => unlockedSet.has(p.id)).length

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Your collection
          </p>
          <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">
            {unlockedCount} of {TACTICAL_PATTERNS.length} unlocked
          </p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white grid place-items-center text-2xl shadow-lg shadow-rose-500/25">
          ⚡
        </div>
      </div>

      {TACTICAL_PATTERN_CATEGORIES.map((category) => {
        const patterns = getPatternsByCategory(category.id)
        if (patterns.length === 0) return null

        return (
          <section key={category.id} className="space-y-4">
            <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
              {category.title}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {patterns.map((pattern) => {
                const unlocked = unlockedSet.has(pattern.id)
                const lessonLinks = pattern.lessonIds
                  .map((id) => findLessonInCourses(id))
                  .filter(Boolean)

                return (
                  <li
                    key={pattern.id}
                    className={clsx(
                      "rounded-2xl border-2 p-5 transition-all",
                      unlocked
                        ? "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
                        : "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 opacity-75",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={clsx(
                          "flex-shrink-0 w-10 h-10 rounded-xl grid place-items-center text-lg",
                          unlocked
                            ? "bg-rose-200 dark:bg-rose-900/60"
                            : "bg-gray-200 dark:bg-slate-800 grayscale",
                        )}
                        aria-hidden
                      >
                        {unlocked ? "⚡" : "🔒"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                          {pattern.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {unlocked
                            ? pattern.description
                            : "Complete the linked lesson to unlock this pattern."}
                        </p>
                        {lessonLinks.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {lessonLinks.map((entry) =>
                              entry ? (
                                <Link
                                  key={entry.lesson.id}
                                  href={`/lessons/${entry.lesson.id}`}
                                  className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900 transition"
                                >
                                  {entry.lesson.title}
                                </Link>
                              ) : null,
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
