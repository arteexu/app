"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getKeyConceptsForCourse } from "@/lib/key-concepts"
import { getUnlockedKeyConceptIds } from "@/lib/key-concepts-storage"
import { clsx } from "clsx"

interface Props {
  lessonIds: string[]
}

export function CourseKeyConceptsPanel({ lessonIds }: Props) {
  const concepts = getKeyConceptsForCourse(lessonIds)
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])

  useEffect(() => {
    setUnlockedIds(getUnlockedKeyConceptIds())
  }, [])

  if (concepts.length === 0) return null

  const unlockedSet = new Set(unlockedIds)

  return (
    <section className="mt-10 rounded-[1.75rem] border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 dark:from-amber-950/20 dark:via-slate-900/40 dark:to-orange-950/10 px-5 sm:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Key concepts in this course
          </p>
          <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">
            Ideas to carry into your games
          </h3>
        </div>
        <Link
          href="/key-concepts"
          className="text-sm font-bold text-amber-800 dark:text-amber-300 hover:underline self-start sm:self-auto"
        >
          Browse all →
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {concepts.map((concept) => {
          const unlocked = unlockedSet.has(concept.id)
          return (
            <li
              key={concept.id}
              className={clsx(
                "rounded-xl border px-4 py-3 flex items-start gap-3",
                unlocked
                  ? "border-amber-300/70 dark:border-amber-800 bg-white/70 dark:bg-slate-900/50"
                  : "border-gray-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30",
              )}
            >
              <span className="text-base mt-0.5" aria-hidden>
                {unlocked ? "🔑" : "🔒"}
              </span>
              <div>
                <p className="font-display font-bold text-sm text-gray-900 dark:text-slate-100">
                  {concept.title}
                </p>
                {unlocked && (
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {concept.description}
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
