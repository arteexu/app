"use client"
// components/analysis/EvalBar.tsx
// Vertical eval bar (White advantage grows from the bottom). Sits alongside the
// board. White fills from the bottom; the numeric eval is printed at whichever
// end is currently ahead.

import { clsx } from "clsx"
import { evalBarFraction, formatEval } from "@/lib/engine/format"

interface Props {
  whiteCp: number | null
  whiteMate: number | null
  /** Board orientation — when black is at the bottom, flip the bar to match. */
  orientation: "white" | "black"
  active: boolean
}

/**
 * Compact label that always fits the narrow bar. Mates stay as "M3"/"-M3";
 * big advantages drop the decimal ("+12"/"-12") so long values never clip,
 * while normal evals keep one decimal ("+1.3"/"-0.5").
 */
function compactBarLabel(whiteCp: number | null, whiteMate: number | null): string {
  if (whiteMate !== null) {
    if (whiteMate === 0) return "#"
    return whiteMate > 0 ? `M${whiteMate}` : `-M${Math.abs(whiteMate)}`
  }
  if (whiteCp === null) return "0.0"
  const pawns = whiteCp / 100
  const sign = pawns > 0 ? "+" : pawns < 0 ? "-" : ""
  const abs = Math.abs(pawns)
  const num = abs >= 10 ? Math.round(abs).toString() : abs.toFixed(1)
  return `${sign}${num}`
}

export function EvalBar({ whiteCp, whiteMate, orientation, active }: Props) {
  const fraction = active ? evalBarFraction(whiteCp, whiteMate) : 0.5
  const whitePct = Math.round(fraction * 100)
  // Compact label rendered inside the bar; full-precision value for a11y/tooltip.
  const barLabel = active ? compactBarLabel(whiteCp, whiteMate) : "–"
  const fullLabel = active ? formatEval(whiteCp, whiteMate) : "–"
  // White better when fraction > 0.5.
  const whiteAhead = fraction >= 0.5
  // White is anchored to the bottom unless the board is flipped.
  const whiteAtBottom = orientation === "white"

  return (
    <div
      className="relative h-full w-6 sm:w-7 shrink-0 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-black/20"
      aria-label={`Evaluation ${fullLabel}`}
      title={`Evaluation: ${fullLabel}`}
    >
      {/* White portion */}
      <div
        className="absolute inset-x-0 bg-gradient-to-t from-gray-50 to-white transition-[height] duration-300 ease-out"
        style={{ height: `${whitePct}%`, [whiteAtBottom ? "bottom" : "top"]: 0 } as React.CSSProperties}
      />
      {/* Numeric label, pinned to the leading side */}
      <span
        className={clsx(
          "absolute inset-x-0 text-center text-[9px] sm:text-[10px] font-bold font-mono tabular-nums leading-none tracking-tighter px-px",
          whiteAhead ? "text-slate-900" : "text-white",
        )}
        style={
          (whiteAhead === whiteAtBottom
            ? { bottom: 3 }
            : { top: 3 }) as React.CSSProperties
        }
      >
        {barLabel}
      </span>
    </div>
  )
}
