// components/ui/WeeklyBarChart.tsx — this-week time bars vs goal
import type { DayActivity } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  days: DayActivity[]
  totalHours: number
  goal: number
}

// Height of the bar track in pixels (must match h-16 = 64px below)
const TRACK_PX = 64

export function WeeklyBarChart({ days, totalHours, goal }: Props) {
  const max = Math.max(goal / 5, ...days.map(d => d.hours), 0.2)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">This week</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          <span className="font-bold text-gray-900 dark:text-slate-100">{totalHours.toFixed(1)}h</span> / {goal}h
        </p>
      </div>

      {/* Bar track — explicit h-16 so pixel bar heights are stable */}
      <div className="flex items-end gap-2 mt-4" style={{ height: `${TRACK_PX + 18}px` }}>
        {days.map((d, i) => {
          // Compute bar height in pixels — never rely on % of flex parent
          const barPx = d.hours > 0
            ? Math.max(Math.round((d.hours / max) * TRACK_PX), 10)
            : d.active ? 10 : 3

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Fixed-height track for bars */}
              <div className="w-full flex items-end" style={{ height: `${TRACK_PX}px` }}>
                <div
                  className={clsx(
                    "w-full rounded-md transition-all duration-500",
                    d.active
                      ? "bg-gradient-to-t from-indigo-600 to-violet-400"
                      : "bg-gray-100 dark:bg-slate-700"
                  )}
                  style={{ height: `${barPx}px` }}
                />
              </div>
              <span className={clsx(
                "text-[10px] font-bold leading-none",
                d.isToday ? "text-indigo-600 dark:text-indigo-400" : "text-gray-300 dark:text-slate-600"
              )}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
