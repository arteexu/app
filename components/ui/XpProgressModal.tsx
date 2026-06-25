"use client"

import { useCallback, useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import type { LevelInfo } from "@/lib/gamification"
import { getRankProgress } from "@/lib/gamification"
import { XpBar } from "./XpBar"
import { clsx } from "clsx"

interface Props {
  xp: number
  level: LevelInfo
  onClose: () => void
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function XpProgressModal({ xp, level, onClose }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const ranks = getRankProgress(xp)

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== "Tab" || !dialogRef.current) return

    const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (nodes.length === 0) return

    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    document.addEventListener("keydown", trapFocus)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", trapFocus)
    }
  }, [trapFocus])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm motion-reduce:backdrop-blur-none" aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        className={clsx(
          "relative w-full sm:max-w-lg max-h-[min(92vh,720px)] flex flex-col",
          "bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl",
          "border border-gray-200 dark:border-slate-700 shadow-2xl shadow-indigo-900/20",
          "animate-[rise_0.3s_ease_both] motion-reduce:animate-none",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="relative overflow-hidden rounded-t-3xl sm:rounded-t-3xl px-6 pt-6 pb-5 shrink-0
                        bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-white">
          <span className="pointer-events-none select-none absolute -right-3 -top-4 text-[100px] leading-none opacity-10" aria-hidden>
            ♛
          </span>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">Your rank</p>
              <h2 id={titleId} className="font-display text-2xl font-extrabold mt-0.5">
                Level {level.level} · {level.title}
              </h2>
              <p className="text-sm font-medium text-white/85 mt-0.5 tabular-nums">
                {xp.toLocaleString()} XP total
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white text-lg leading-none
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600"
              aria-label="Close XP progress"
            >
              ×
            </button>
          </div>

          <div className="mt-4">
            <XpBar info={level} tone="light" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-4">
            Rank ladder
          </p>

          <ol className="flex flex-col gap-0" aria-label="Chess rank progression">
            {ranks.map((rank, index) => {
              const isLast = index === ranks.length - 1
              return (
                <li key={rank.level} className="relative flex gap-3">
                  {!isLast && (
                    <span
                      className={clsx(
                        "absolute left-[15px] top-8 bottom-0 w-0.5 -translate-x-1/2",
                        rank.status === "surpassed"
                          ? "bg-indigo-300 dark:bg-indigo-600"
                          : "bg-gray-200 dark:bg-slate-700",
                      )}
                      aria-hidden
                    />
                  )}

                  <div className="relative z-10 shrink-0 mt-0.5">
                    <span
                      className={clsx(
                        "w-8 h-8 rounded-full grid place-items-center text-sm font-extrabold",
                        rank.status === "surpassed" &&
                          "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30",
                        rank.status === "current" &&
                          "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 ring-4 ring-amber-200/80 dark:ring-amber-500/30 shadow-md",
                        rank.status === "upcoming" &&
                          "bg-gray-100 dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500",
                      )}
                      aria-hidden
                    >
                      {rank.status === "surpassed" ? "✓" : rank.status === "current" ? "★" : rank.level}
                    </span>
                  </div>

                  <div
                    className={clsx(
                      "flex-1 min-w-0 pb-5",
                      rank.status === "current" &&
                        "rounded-xl -mx-2 px-2 py-2 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p
                        className={clsx(
                          "text-sm font-bold",
                          rank.status === "surpassed" && "text-gray-500 dark:text-slate-400",
                          rank.status === "current" && "text-gray-900 dark:text-slate-100",
                          rank.status === "upcoming" && "text-gray-700 dark:text-slate-300",
                        )}
                      >
                        Level {rank.level} · {rank.title}
                      </p>
                      <span className="text-[11px] font-bold tabular-nums text-gray-400 dark:text-slate-500">
                        {rank.minXp.toLocaleString()} XP
                      </span>
                    </div>

                    <p
                      className={clsx(
                        "text-xs font-semibold mt-0.5",
                        rank.status === "surpassed" && "text-emerald-600 dark:text-emerald-400",
                        rank.status === "current" && "text-amber-700 dark:text-amber-400",
                        rank.status === "upcoming" && "text-gray-500 dark:text-slate-400",
                      )}
                    >
                      {rank.status === "surpassed" && "Surpassed"}
                      {rank.status === "current" &&
                        (level.isMax ? "Top rank — you made it!" : "Current rank")}
                      {rank.status === "upcoming" &&
                        `${rank.xpToReach.toLocaleString()} XP to unlock`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  )
}
