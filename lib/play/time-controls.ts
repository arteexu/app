// lib/play/time-controls.ts
// The selectable time controls for Play (shared by Bot and Human modes) plus
// pure clock helpers. A clock is just remaining milliseconds per side; the side
// to move burns time and gains the increment when they complete a move.

import type { TimeControl } from "./types"

export const TIME_CONTROLS: TimeControl[] = [
  { id: "3+2", label: "Blitz", baseSeconds: 180, incrementSeconds: 2 },
  { id: "5+0", label: "Blitz", baseSeconds: 300, incrementSeconds: 0 },
  { id: "10+0", label: "Rapid", baseSeconds: 600, incrementSeconds: 0 },
  { id: "15+10", label: "Rapid", baseSeconds: 900, incrementSeconds: 10 },
]

export const DEFAULT_TIME_CONTROL = TIME_CONTROLS[1] // 5+0

export function timeControlById(id: string): TimeControl {
  return TIME_CONTROLS.find((tc) => tc.id === id) ?? DEFAULT_TIME_CONTROL
}

/** Find the closest matching configured time control for a base+increment pair. */
export function timeControlFor(baseSeconds: number, incrementSeconds: number): TimeControl {
  return (
    TIME_CONTROLS.find(
      (tc) => tc.baseSeconds === baseSeconds && tc.incrementSeconds === incrementSeconds,
    ) ?? {
      id: `${Math.round(baseSeconds / 60)}+${incrementSeconds}`,
      label: "Custom",
      baseSeconds,
      incrementSeconds,
    }
  )
}

/**
 * Format remaining milliseconds as a chess clock string.
 *   ≥ 60s        → M:SS        (e.g. 4:07)
 *   < 60s        → SS.t        (tenths, e.g. 12.4) so flag scrambles read well
 *   ≤ 0          → 0:00
 */
export function formatClock(ms: number): string {
  if (ms <= 0) return "0:00"
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) {
    return totalSeconds.toFixed(1)
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

/** The starting clock (ms) for a time control. */
export function startingClockMs(tc: TimeControl): number {
  return tc.baseSeconds * 1000
}
