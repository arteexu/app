// components/ui/StreakWeek.tsx — flame + count + 7-day dot calendar
import type { DayActivity } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  streak: number
  days: DayActivity[]
}

export function StreakWeek({ streak, days }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col items-center justify-center text-center">
      <span className="text-5xl leading-none">🔥</span>
      <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-2 leading-none font-display">
        {streak}
      </p>
      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mt-1">
        day streak
      </p>

      <div className="flex gap-1.5 mt-4">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-colors",
              d.active
                ? "bg-indigo-600 text-white"
                : d.isToday
                  ? "border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-400"
                  : "bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-500"
            )}>
              {d.active ? "✓" : ""}
            </div>
            <span className="text-[10px] font-bold text-gray-300 dark:text-slate-600">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
