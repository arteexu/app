"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { KEY_CONCEPTS } from "@/lib/key-concepts"
import { getUnlockedKeyConceptIds } from "@/lib/key-concepts-storage"
import { findLessonInCourses } from "@/lib/courses"
import { clsx } from "clsx"

export function KeyConceptsBrowser() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([])
  // Deep-link target from `?concept=<id>` — auto-scrolled to and briefly ringed.
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    setUnlockedIds(getUnlockedKeyConceptIds())

    const target = new URLSearchParams(window.location.search).get("concept")
    if (!target || !KEY_CONCEPTS.some((c) => c.id === target)) return
    setHighlightId(target)
    requestAnimationFrame(() => {
      document
        .getElementById(`concept-${target}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
    const timer = setTimeout(() => setHighlightId(null), 2800)
    return () => clearTimeout(timer)
  }, [])

  const unlockedSet = new Set(unlockedIds)
  const unlockedCount = KEY_CONCEPTS.filter((c) => unlockedSet.has(c.id)).length

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Your collection
          </p>
          <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">
            {unlockedCount} of {KEY_CONCEPTS.length} unlocked
          </p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center text-2xl shadow-lg shadow-amber-500/25">
          🔑
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {KEY_CONCEPTS.map((concept) => {
          const unlocked = unlockedSet.has(concept.id)
          const lessonLinks = concept.lessonIds
            .map((id) => findLessonInCourses(id))
            .filter(Boolean)

          return (
            <li
              key={concept.id}
              id={`concept-${concept.id}`}
              className={clsx(
                "scroll-mt-24 rounded-2xl border-2 p-5 transition-all",
                unlocked
                  ? "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30 opacity-75",
                highlightId === concept.id &&
                  "ring-4 ring-amber-400/70 dark:ring-amber-500/60 border-amber-400 dark:border-amber-500",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={clsx(
                    "flex-shrink-0 w-10 h-10 rounded-xl grid place-items-center text-lg",
                    unlocked
                      ? "bg-amber-200 dark:bg-amber-900/60"
                      : "bg-gray-200 dark:bg-slate-800 grayscale",
                  )}
                  aria-hidden
                >
                  {unlocked ? concept.icon : "🔒"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                    {concept.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {unlocked ? concept.description : "Complete the linked lesson to unlock this concept."}
                  </p>
                  {lessonLinks.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lessonLinks.map((entry) =>
                        entry ? (
                          <Link
                            key={entry.lesson.id}
                            href={`/lessons/${entry.lesson.id}`}
                            className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900 transition"
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
    </div>
  )
}
