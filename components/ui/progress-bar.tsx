"use client"
import { clsx } from "clsx"

interface ProgressBarProps {
  value: number   // 0–100
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, className, showLabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={clsx("w-full", className)}>
      {showLabel && (
        <span className="text-xs text-gray-500 mb-1 block">{clamped}%</span>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
