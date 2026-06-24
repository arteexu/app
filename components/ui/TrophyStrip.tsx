// components/ui/TrophyStrip.tsx — earned/locked milestone badges
import type { Trophy } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  trophies: Trophy[]
  className?: string
}

export function TrophyStrip({ trophies, className }: Props) {
  const earned = trophies.filter(t => t.earned).length
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Trophies</h2>
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{earned}/{trophies.length}</span>
      </div>
      <div className="flex gap-2.5 flex-wrap">
        {trophies.map(t => (
          <div
            key={t.key}
            title={t.hint}
            className={clsx(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all",
              t.earned
                ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm"
                : "bg-transparent border-gray-200/70 dark:border-slate-700/60 opacity-50 grayscale"
            )}
          >
            <span className="text-xl leading-none">{t.emoji}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
