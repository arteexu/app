"use client"

import { useSyncExternalStore } from "react"
import {
  formatDuration,
  getDayTotalSeconds,
  localDateStr,
  subscribeSiteActivity,
} from "@/lib/site-activity"

function useSiteSeconds(date: string): number {
  return useSyncExternalStore(
    subscribeSiteActivity,
    () => getDayTotalSeconds(date),
    () => 0,
  )
}

function useWeekSiteSeconds(): number {
  return useSyncExternalStore(
    subscribeSiteActivity,
    () => {
      const today = new Date()
      let total = 0
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        total += getDayTotalSeconds(localDateStr(d))
      }
      return total
    },
    () => 0,
  )
}

export function SiteActivitySummary() {
  const todayKey = useSyncExternalStore(subscribeSiteActivity, localDateStr, () => "")
  const todaySec = useSiteSeconds(todayKey)
  const weekSec = useWeekSiteSeconds()

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
          Today on site
        </p>
        <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-1 tabular-nums">
          {formatDuration(todaySec)}
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
          Last 7 days
        </p>
        <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-1 tabular-nums">
          {formatDuration(weekSec)}
        </p>
      </div>
    </div>
  )
}
