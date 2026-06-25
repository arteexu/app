// components/ui/WeeklyBarChart.tsx — weekly goal progress + daily practice
import type { DayActivity } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  days: DayActivity[]
  totalHours: number
  goal: number
}

const TRACK_PX = 56
const HOUR_SEGMENTS = 5

function formatH(h: number) {
  if (h < 0.1) return "0"
  return h % 1 === 0 ? String(h) : h.toFixed(1)
}

function weekStatus(totalHours: number, goal: number) {
  const pct = goal > 0 ? totalHours / goal : 0
  const remaining = Math.max(goal - totalHours, 0)
  const extra = Math.max(totalHours - goal, 0)

  if (extra >= 0.05) {
    return {
      badge: "Goal reached",
      badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
      headline: `${Math.round(pct * 100)}% of weekly goal`,
      detail: `${formatH(extra)}h extra practice this week`,
    }
  }
  if (pct >= 0.85) {
    return {
      badge: "Almost there",
      badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
      headline: `${Math.round(pct * 100)}% of weekly goal`,
      detail: `${formatH(remaining)}h left to reach ${goal}h`,
    }
  }
  if (pct >= 0.5) {
    return {
      badge: "On the board",
      badgeClass: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
      headline: `${Math.round(pct * 100)}% of weekly goal`,
      detail: `${formatH(remaining)}h left · ${formatH(goal / 7)}h/day keeps pace`,
    }
  }
  if (totalHours > 0) {
    return {
      badge: "Building momentum",
      badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300",
      headline: `${Math.round(pct * 100)}% of weekly goal`,
      detail: `${formatH(remaining)}h left · aim for ${formatH(goal / 7)}h/day`,
    }
  }
  return {
    badge: "New week",
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400",
    headline: `0% of ${goal}h goal`,
    detail: `About ${formatH(goal / 7)}h per day gets you there`,
  }
}

export function WeeklyBarChart({ days, totalHours, goal }: Props) {
  const dailyTarget = goal / 7
  const barMax = Math.max(dailyTarget * 1.35, ...days.map(d => d.hours), 0.2)
  const targetLinePx = Math.round((dailyTarget / barMax) * TRACK_PX)
  const status = weekStatus(totalHours, goal)

  const overflowHours = Math.max(totalHours - goal, 0)
  const overflowPct = goal > 0 ? (overflowHours / goal) * 100 : 0
  const segmentHours = goal / HOUR_SEGMENTS

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide shrink-0">
          This week
        </p>
        <span className={clsx("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full", status.badgeClass)}>
          {status.badge}
        </span>
      </div>

      {/* Goal progress — chess file: one square ≈ one hour toward 5h */}
      <div>
        <p className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
          {status.headline}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{status.detail}</p>

        <div className="mt-3 relative">
          <div
            className="flex h-3 rounded-lg overflow-hidden border border-stone-300/60 dark:border-stone-600/40"
            role="progressbar"
            aria-valuenow={Math.round(Math.min(totalHours / goal, 1) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Weekly practice: ${formatH(totalHours)} of ${goal} hours`}
          >
            {Array.from({ length: HOUR_SEGMENTS }).map((_, i) => {
              const hourStart = i * segmentHours
              const hourEnd = (i + 1) * segmentHours
              const filledInSeg = Math.max(0, Math.min(totalHours, hourEnd) - hourStart)
              const segPct = segmentHours > 0 ? (filledInSeg / segmentHours) * 100 : 0

              return (
                <div
                  key={i}
                  className={clsx(
                    "flex-1 relative border-r last:border-r-0 border-stone-300/40 dark:border-stone-600/30",
                    i % 2 === 0 ? "bg-[#f0d9b5]/30 dark:bg-[#769656]/15" : "bg-[#b58863]/20 dark:bg-[#486030]/20"
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-violet-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${Math.min(segPct, 100)}%` }}
                  />
                </div>
              )
            })}
          </div>

          {/* Overflow beyond goal */}
          {overflowHours > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.min(overflowPct, 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                +{formatH(overflowHours)}h bonus
              </span>
            </div>
          )}

          <div className="flex justify-between mt-1.5 px-0.5">
            <span className="text-[9px] font-bold text-gray-300 dark:text-slate-600">0h</span>
            {Array.from({ length: HOUR_SEGMENTS }).map((_, i) => (
              <span key={i} className="text-[9px] font-bold text-gray-400 dark:text-slate-500">
                {formatH(segmentHours * (i + 1))}h
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Daily bars vs pace line */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
            Daily practice
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-right">
            dashed = <span className="font-bold text-indigo-500 dark:text-indigo-400">{formatH(dailyTarget)}h</span> pace
          </p>
        </div>

        <div className="flex items-end gap-1.5" style={{ height: `${TRACK_PX + 16}px` }}>
          {days.map((d, i) => {
            const barPx = d.hours > 0
              ? Math.max(Math.round((d.hours / barMax) * TRACK_PX), 8)
              : d.active ? 8 : 3
            const metPace = d.hours >= dailyTarget * 0.85

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="relative w-full flex items-end" style={{ height: `${TRACK_PX}px` }}>
                  {/* Daily pace target */}
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-indigo-300/70 dark:border-indigo-500/40 pointer-events-none z-10"
                    style={{ bottom: `${targetLinePx}px` }}
                    aria-hidden
                  />
                  <div
                    className={clsx(
                      "w-full rounded-md transition-all duration-500 motion-reduce:transition-none relative z-0",
                      d.hours > 0
                        ? metPace
                          ? "bg-gradient-to-t from-indigo-600 to-violet-400 shadow-sm shadow-indigo-500/20"
                          : "bg-gradient-to-t from-indigo-400/80 to-violet-300/80"
                        : d.isToday
                          ? "bg-indigo-100 dark:bg-indigo-950/40 ring-1 ring-indigo-200 dark:ring-indigo-800"
                          : "bg-gray-100 dark:bg-slate-700"
                    )}
                    style={{ height: `${barPx}px` }}
                    title={d.hours > 0 ? `${formatH(d.hours)}h` : d.isToday ? "No practice yet today" : undefined}
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
    </div>
  )
}
