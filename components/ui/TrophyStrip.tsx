"use client"

import { useState } from "react"
import type { Trophy } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  trophies: Trophy[]
  className?: string
}

export function TrophyStrip({ trophies, className }: Props) {
  const earned = trophies.filter(t => t.earned).length
  const [selectedKey, setSelectedKey] = useState<string | null>(trophies.find(t => t.earned)?.key ?? trophies[0]?.key ?? null)
  const selected = trophies.find(t => t.key === selectedKey) ?? null

  function toggle(key: string) {
    setSelectedKey(prev => (prev === key ? null : key))
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Trophies
          </h2>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
            {earned}/{trophies.length}
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">
          Tap a trophy to learn more
        </p>
      </div>

      <div className="flex gap-2.5 flex-wrap" role="list">
        {trophies.map(t => {
          const isSelected = selectedKey === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="listitem"
              aria-pressed={isSelected}
              aria-expanded={isSelected}
              onClick={() => toggle(t.key)}
              className={clsx(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
                t.earned
                  ? isSelected
                    ? "bg-gradient-to-br from-amber-50 to-indigo-50 dark:from-amber-950/40 dark:to-indigo-950/40 border-amber-300 dark:border-amber-700 shadow-md scale-[1.02]"
                    : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md hover:-translate-y-px"
                  : isSelected
                    ? "bg-gray-50 dark:bg-slate-800/80 border-gray-300 dark:border-slate-600 opacity-80 grayscale-[0.4]"
                    : "bg-transparent border-gray-200/70 dark:border-slate-700/60 opacity-50 grayscale hover:opacity-70 hover:grayscale-[0.6]"
              )}
            >
              <span className={clsx("text-xl leading-none", t.earned && isSelected && "drop-shadow-sm")}>
                {t.emoji}
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-slate-100 text-left">{t.name}</span>
              {t.earned && (
                <span className="sr-only">Earned</span>
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <div
          key={selected.key}
          className={clsx(
            "mt-4 rounded-2xl border px-5 py-4 transition-all animate-[rise_0.35s_ease_both]",
            selected.earned
              ? "bg-gradient-to-br from-white to-indigo-50/80 dark:from-slate-800 dark:to-indigo-950/30 border-indigo-200 dark:border-indigo-800 shadow-sm"
              : "bg-gray-50/80 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"
          )}
          role="region"
          aria-label={`${selected.name} details`}
        >
          <div className="flex items-start gap-4">
            <div
              className={clsx(
                "flex-shrink-0 w-14 h-14 rounded-2xl grid place-items-center text-3xl",
                selected.earned
                  ? "bg-gradient-to-br from-amber-100 to-indigo-100 dark:from-amber-900/40 dark:to-indigo-900/40 shadow-inner"
                  : "bg-gray-100 dark:bg-slate-700/80 grayscale opacity-70"
              )}
            >
              {selected.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                  {selected.name}
                </h3>
                <span
                  className={clsx(
                    "text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full",
                    selected.earned
                      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                  )}
                >
                  {selected.earned ? "Earned" : "Locked"}
                </span>
              </div>

              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed mt-2">
                {selected.description}
              </p>

              <p
                className={clsx(
                  "text-xs font-semibold mt-3 flex items-center gap-1.5",
                  selected.earned
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-slate-400"
                )}
              >
                <span aria-hidden>{selected.earned ? "✓" : "🔒"}</span>
                {selected.earned ? `Unlocked: ${selected.hint}` : `How to earn: ${selected.hint}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
