"use client"
// components/insights/MotifPracticeSection.tsx
// Renders detected motifs as chips. Chips with at least one practice position
// (derived from a sound ply in the game) are clickable and open a drill modal;
// the rest are shown as informational chips.

import { useState } from "react"
import Link from "next/link"
import { getInsightMotif, type InsightMotifId } from "@/lib/insights/motifs"
import type { PracticePosition } from "@/lib/insights/practice"
import { motifLearnTarget } from "@/lib/insights/learn-links"
import { MotifPracticeModal } from "./MotifPracticeModal"

interface Props {
  motifs: InsightMotifId[]
  practice: Map<InsightMotifId, PracticePosition[]>
}

export function MotifPracticeSection({ motifs, practice }: Props) {
  const [active, setActive] = useState<InsightMotifId | null>(null)

  if (motifs.length === 0) return null
  const activePositions = active ? practice.get(active) ?? [] : []

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
        Patterns spotted — tap to practice
      </p>
      <div className="flex flex-wrap gap-2">
        {motifs.map((id) => {
          const motif = getInsightMotif(id)
          if (!motif) return null
          const positions = practice.get(id) ?? []
          const playable = positions.length > 0
          const learn = motifLearnTarget(id)

          // Each motif is a chip group: the chip (practice button or info label)
          // plus an additive "Learn" link when it maps to a taxonomy entry.
          return (
            <span
              key={id}
              className="inline-flex items-stretch rounded-full border border-gray-200 dark:border-slate-700 overflow-hidden"
            >
              {playable ? (
                <button
                  type="button"
                  onClick={() => setActive(id)}
                  title={`${motif.description} · ${positions.length} drill${positions.length === 1 ? "" : "s"}`}
                  className="group inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                  <span aria-hidden>{motif.icon}</span>
                  {motif.title}
                  <span className="text-[10px] font-bold text-indigo-500/80 dark:text-indigo-300/80 group-hover:text-indigo-600 dark:group-hover:text-indigo-200">
                    ▶ practice
                  </span>
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
                  title={motif.description}
                >
                  <span aria-hidden>{motif.icon}</span>
                  {motif.title}
                </span>
              )}
              {learn && (
                <Link
                  href={learn.href}
                  title={`Learn about ${learn.title} in ${learn.kind === "pattern" ? "Tactical Patterns" : "Key Concepts"}`}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 border-l border-gray-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                >
                  Learn ↗
                </Link>
              )}
            </span>
          )
        })}
      </div>

      {active && activePositions.length > 0 && (
        <MotifPracticeModal
          motifId={active}
          positions={activePositions}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  )
}
