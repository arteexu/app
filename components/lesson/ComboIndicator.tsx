"use client"

import { useEffect, useRef, useState } from "react"
import { clsx } from "clsx"

export const COMBO_THRESHOLD = 2
const MAX_SEGMENTS = 4

interface Props {
  combo: number
  lit?: boolean
}

export function ComboIndicator({ combo, lit }: Props) {
  const prevCombo = useRef(combo)
  const [incrementPulse, setIncrementPulse] = useState(false)
  const [entering, setEntering] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [newSegment, setNewSegment] = useState(-1)
  const [frozenCombo, setFrozenCombo] = useState<number | null>(null)

  const visible = combo >= COMBO_THRESHOLD
  const show = visible || exiting
  const displayCombo = exiting && frozenCombo !== null ? frozenCombo : combo
  const filledSegments = Math.min(displayCombo, MAX_SEGMENTS)

  useEffect(() => {
    const prev = prevCombo.current
    prevCombo.current = combo

    if (combo > prev && combo >= COMBO_THRESHOLD) {
      setIncrementPulse(true)
      const nextFilled = Math.min(combo, MAX_SEGMENTS)
      const prevFilled = Math.min(prev, MAX_SEGMENTS)
      if (nextFilled > prevFilled) setNewSegment(nextFilled - 1)

      if (prev < COMBO_THRESHOLD) {
        setEntering(true)
        setTimeout(() => setEntering(false), 360)
      }

      const t = setTimeout(() => {
        setIncrementPulse(false)
        setNewSegment(-1)
      }, 450)
      return () => clearTimeout(t)
    }

    if (combo === 0 && prev >= COMBO_THRESHOLD) {
      setFrozenCombo(prev)
      setExiting(true)
      const t = setTimeout(() => {
        setExiting(false)
        setFrozenCombo(null)
      }, 280)
      return () => clearTimeout(t)
    }

    if (combo >= COMBO_THRESHOLD) {
      setExiting(false)
      setFrozenCombo(null)
    }
  }, [combo])

  if (!show) return null

  return (
    <div
      aria-live="polite"
      aria-label={`${displayCombo} combo streak`}
      className={clsx(
        "combo-indicator flex items-center gap-2.5",
        entering && "combo-indicator-enter motion-reduce:animate-none",
        exiting && "combo-indicator-exit motion-reduce:animate-none",
        !exiting && incrementPulse && "combo-indicator-pop motion-reduce:animate-none",
        lit && !exiting && "combo-indicator-lit",
      )}
    >
      <span
        className={clsx(
          "hidden sm:inline text-[10.5px] font-extrabold tracking-[0.1em] transition-colors duration-300 motion-reduce:transition-none",
          lit && !exiting ? "text-amber-400" : "text-amber-400/70",
        )}
      >
        COMBO
      </span>

      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: MAX_SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "combo-segment w-4 h-[7px] rounded-[3px] transition-all duration-300 motion-reduce:transition-none",
              i < filledSegments && "combo-segment-filled",
              i < filledSegments && lit && !exiting && "combo-segment-lit",
              i === newSegment && "combo-segment-new motion-reduce:animate-none",
            )}
          />
        ))}
      </div>

      <span
        key={displayCombo}
        className={clsx(
          "font-display text-[15px] font-extrabold tabular-nums transition-colors duration-300 motion-reduce:transition-none",
          lit && !exiting ? "text-amber-300" : "text-amber-400/90",
          incrementPulse && !exiting && "combo-count-tick motion-reduce:animate-none",
        )}
      >
        {displayCombo}×
      </span>
    </div>
  )
}
