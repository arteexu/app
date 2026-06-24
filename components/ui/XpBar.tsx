// components/ui/XpBar.tsx — level + XP progress bar (used in hero & profile)
import type { LevelInfo } from "@/lib/gamification"
import { clsx } from "clsx"

interface Props {
  info: LevelInfo
  /** "light" = for use on the dark gradient hero; "ink" = on white/slate cards */
  tone?: "light" | "ink"
  className?: string
}

export function XpBar({ info, tone = "ink", className }: Props) {
  const pct = Math.min((info.xpIntoLevel / info.xpForLevel) * 100, 100)
  const light = tone === "light"

  return (
    <div className={clsx("w-full", className)}>
      <div className={clsx(
        "flex items-center justify-between text-xs font-bold mb-1.5",
        light ? "text-white/85" : "text-gray-500 dark:text-slate-400"
      )}>
        <span>{info.xpIntoLevel} XP</span>
        <span>
          {info.isMax
            ? "Max rank"
            : `${info.xpToNext} XP to ${info.nextTitle}`}
        </span>
      </div>
      <div className={clsx(
        "h-3.5 rounded-full overflow-hidden",
        light ? "bg-white/25" : "bg-gray-100 dark:bg-slate-700"
      )}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-700"
          style={{ width: `${pct}%`, boxShadow: "0 0 14px rgba(245,200,80,0.65)" }}
        />
      </div>
    </div>
  )
}
