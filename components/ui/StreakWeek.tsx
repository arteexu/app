"use client"

// components/ui/StreakWeek.tsx — flame + count + 7-day dot calendar with hourly drill-down
import { useCallback, useEffect, useRef, useSyncExternalStore, useState } from "react"
import type { DayActivity } from "@/lib/gamification"
import {
  EMPTY_HOURLY,
  formatDuration,
  formatHourLabel,
  getDayTotalSeconds,
  getHourlyActivity,
  localDateStr,
  subscribeSiteActivity,
} from "@/lib/site-activity"
import { clsx } from "clsx"

interface Props {
  streak: number
  days: DayActivity[]
}

function formatDayHeading(date: string, isToday: boolean): string {
  const d = new Date(`${date}T12:00:00`)
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" })
  if (isToday) return `Today · ${weekday}`
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function HourlyActivityPanel({
  date,
  isToday,
  dayIndex,
  totalDays,
  onClose,
}: {
  date: string
  isToday: boolean
  dayIndex: number
  totalDays: number
  onClose: () => void
}) {
  const buckets = useSyncExternalStore(
    subscribeSiteActivity,
    () => getHourlyActivity(date),
    () => EMPTY_HOURLY,
  )
  const totalSec = buckets.reduce((s, v) => s + v, 0)
  const maxSec = Math.max(...buckets, 1)
  const hasActivity = totalSec > 0
  const alignLeft = dayIndex <= 1
  const alignRight = dayIndex >= totalDays - 2

  return (
    <div
      role="dialog"
      aria-label={`Activity for ${formatDayHeading(date, isToday)}`}
      className={clsx(
        "absolute bottom-[calc(100%+10px)] z-30",
        "w-[min(17rem,calc(100vw-1.5rem))] rounded-xl",
        "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600",
        "shadow-lg shadow-indigo-500/10 dark:shadow-black/30",
        "p-3 text-left",
        "opacity-100 translate-y-0 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
        alignLeft && "left-0 translate-x-0",
        alignRight && "right-0 left-auto translate-x-0",
        !alignLeft && !alignRight && "left-1/2 -translate-x-1/2",
      )}
    >
      {/* caret */}
      <div
        className={clsx(
          "absolute -bottom-1.5 w-3 h-3 rotate-45 bg-white dark:bg-slate-800 border-r border-b border-gray-200 dark:border-slate-600",
          alignLeft && "left-4",
          alignRight && "right-4",
          !alignLeft && !alignRight && "left-1/2 -translate-x-1/2",
        )}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-900 dark:text-slate-100 truncate">
            {formatDayHeading(date, isToday)}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            {hasActivity ? `${formatDuration(totalSec)} on site` : "Local time"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-5 h-5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-xs leading-none"
          aria-label="Close activity panel"
        >
          ×
        </button>
      </div>

      {!hasActivity ? (
        <p className="text-[11px] text-gray-400 dark:text-slate-500 py-3 text-center leading-snug">
          No activity recorded yet for this day
        </p>
      ) : (
        <>
          <div
            className="flex items-end gap-px h-14 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-900/50 p-1"
            aria-hidden
          >
            {buckets.map((sec, hour) => {
              const pct = sec > 0 ? Math.max((sec / maxSec) * 100, 12) : 0
              return (
                <div
                  key={hour}
                  className="flex-1 h-full flex items-end min-w-0"
                  title={sec > 0 ? `${formatHourLabel(hour)}: ${formatDuration(sec)}` : formatHourLabel(hour)}
                >
                  <div
                    className={clsx(
                      "w-full rounded-sm transition-[height] duration-300 motion-reduce:transition-none",
                      sec > 0
                        ? "bg-gradient-to-t from-indigo-600 to-violet-400"
                        : "bg-transparent",
                    )}
                    style={{ height: sec > 0 ? `${pct}%` : "2px" }}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-between mt-1.5 px-0.5">
            {[0, 6, 12, 18].map(h => (
              <span key={h} className="text-[9px] font-bold text-gray-300 dark:text-slate-600">
                {formatHourLabel(h)}
              </span>
            ))}
          </div>

          {/* Top hours list — compact */}
          <ul className="mt-2 space-y-0.5 max-h-20 overflow-y-auto">
            {buckets
              .map((sec, hour) => ({ hour, sec }))
              .filter(({ sec }) => sec > 0)
              .sort((a, b) => b.sec - a.sec)
              .slice(0, 4)
              .map(({ hour, sec }) => (
                <li
                  key={hour}
                  className="flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400"
                >
                  <span className="font-semibold text-gray-600 dark:text-slate-300">
                    {formatHourLabel(hour)}–{formatHourLabel((hour + 1) % 24)}
                  </span>
                  <span className="font-bold tabular-nums">{formatDuration(sec)}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function StreakWeek({ streak, days }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleDay = useCallback((index: number) => {
    setOpenIndex(prev => (prev === index ? null : index))
  }, [])

  const close = useCallback(() => setOpenIndex(null), [])

  useEffect(() => {
    if (openIndex === null) return

    function onPointerDown(e: PointerEvent) {
      if (containerRef.current?.contains(e.target as Node)) return
      close()
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openIndex, close])

  // Re-read totals when storage updates (for active-day dot hint on client)
  const todayKey = useSyncExternalStore(
    subscribeSiteActivity,
    localDateStr,
    () => "",
  )

  return (
    <div
      ref={containerRef}
      className="relative bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5 flex flex-col items-center justify-center text-center overflow-visible"
    >
      <span className="text-5xl leading-none">🔥</span>
      <p className="text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-2 leading-none font-display">
        {streak}
      </p>
      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mt-1">
        day streak
      </p>

      <div className="flex gap-1.5 mt-4">
        {days.map((d, i) => {
          const clientActive = d.isToday && todayKey === d.date && getDayTotalSeconds(d.date) > 0
          const isOpen = openIndex === i

          return (
            <div key={d.date} className="relative flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => toggleDay(i)}
                aria-expanded={isOpen}
                aria-label={`${d.label}, ${formatDayHeading(d.date, d.isToday)}${d.active || clientActive ? ", active" : ""}. View hourly activity.`}
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800",
                  "hover:scale-105 motion-reduce:hover:scale-100 transition-transform motion-reduce:transition-none",
                  d.active || clientActive
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : d.isToday
                      ? "border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-400 hover:border-indigo-400"
                      : "bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-500 hover:bg-gray-200 dark:hover:bg-slate-600",
                  isOpen && "ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-800",
                )}
              >
                {d.active || clientActive ? "✓" : ""}
              </button>
              <span
                className={clsx(
                  "text-[10px] font-bold",
                  d.isToday ? "text-indigo-500 dark:text-indigo-400" : "text-gray-300 dark:text-slate-600",
                )}
              >
                {d.label}
              </span>

              {isOpen && (
                <HourlyActivityPanel
                  date={d.date}
                  isToday={d.isToday}
                  dayIndex={i}
                  totalDays={days.length}
                  onClose={close}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
