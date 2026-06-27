"use client"
// hooks/usePlayClock.ts
// A chess clock driven by an "anchor": the remaining ms for each side at a known
// instant, which side's clock is running, and whether it's ticking. The hook
// smoothly counts the active side down from the anchor (using wall-clock deltas,
// so it stays accurate across re-renders) and fires onFlag exactly once when the
// active side hits zero. Resetting the anchor (new move / clock sync) restarts
// the countdown — this lets the live game reconcile to server-authoritative
// clocks while the bot game just sets a fresh local anchor each move.

import { useEffect, useRef, useState } from "react"
import type { PieceColor } from "@/lib/play/types"

export interface ClockAnchor {
  whiteMs: number
  blackMs: number
  /** Which side's clock is currently ticking. */
  activeColor: PieceColor
  /** Whether the clock should be running (false = paused / game over / pre-start). */
  running: boolean
  /** Client timestamp (Date.now()) the anchor ms values were captured at. */
  sinceMs: number
}

export interface ClockState {
  whiteMs: number
  blackMs: number
}

export function usePlayClock(
  anchor: ClockAnchor,
  onFlag: (color: PieceColor) => void,
): ClockState {
  const [display, setDisplay] = useState<ClockState>({
    whiteMs: anchor.whiteMs,
    blackMs: anchor.blackMs,
  })
  const flaggedRef = useRef(false)
  const onFlagRef = useRef(onFlag)

  // Keep the latest onFlag without re-subscribing the interval (effect-only write).
  useEffect(() => {
    onFlagRef.current = onFlag
  }, [onFlag])

  useEffect(() => {
    flaggedRef.current = false

    // Pure compute of remaining ms for the current anchor at a given instant.
    function compute(now: number): ClockState {
      const elapsed = anchor.running ? now - anchor.sinceMs : 0
      return {
        whiteMs:
          anchor.activeColor === "white" ? Math.max(0, anchor.whiteMs - elapsed) : anchor.whiteMs,
        blackMs:
          anchor.activeColor === "black" ? Math.max(0, anchor.blackMs - elapsed) : anchor.blackMs,
      }
    }

    // Apply immediately so a new anchor renders without waiting a tick.
    setDisplay(compute(Date.now()))

    if (!anchor.running) return
    const interval = setInterval(() => {
      const next = compute(Date.now())
      const activeRemaining = anchor.activeColor === "white" ? next.whiteMs : next.blackMs
      if (activeRemaining <= 0 && !flaggedRef.current) {
        flaggedRef.current = true
        onFlagRef.current(anchor.activeColor)
      }
      setDisplay(next)
    }, 100)
    return () => clearInterval(interval)
  }, [anchor.sinceMs, anchor.activeColor, anchor.running, anchor.whiteMs, anchor.blackMs])

  return display
}
