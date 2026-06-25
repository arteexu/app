"use client"

import { useCallback, useRef, useState } from "react"
import type { LevelInfo } from "@/lib/gamification"
import { XpProgressModal } from "./XpProgressModal"
import { clsx } from "clsx"

interface Props {
  xp: number
  level: LevelInfo
  /** "light" sits on the indigo gradient hero; "ghost" on white cards */
  variant?: "light" | "ghost"
  className?: string
}

export function XpProgressButton({ xp, level, variant = "ghost", className }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const light = variant === "light"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={clsx(
          "inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-3.5 py-2 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          light
            ? "bg-white/15 hover:bg-white/25 text-white focus-visible:ring-white/80 focus-visible:ring-offset-violet-600"
            : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-900",
          className,
        )}
      >
        <span aria-hidden>📈</span>
        View XP progress
      </button>

      {open && <XpProgressModal xp={xp} level={level} onClose={close} />}
    </>
  )
}
