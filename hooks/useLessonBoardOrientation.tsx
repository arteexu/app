"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

type Orientation = "white" | "black"

interface LessonBoardOrientationContextValue {
  isFlipped: boolean
  toggleFlip: () => void
}

const LessonBoardOrientationContext = createContext<LessonBoardOrientationContextValue | null>(null)

function flipOrientation(orientation: Orientation): Orientation {
  return orientation === "white" ? "black" : "white"
}

export function LessonBoardOrientationProvider({ children }: { children: ReactNode }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const toggleFlip = useCallback(() => setIsFlipped(f => !f), [])

  return (
    <LessonBoardOrientationContext.Provider value={{ isFlipped, toggleFlip }}>
      {children}
    </LessonBoardOrientationContext.Provider>
  )
}

/** Effective board orientation for a step, honoring session flip preference. */
export function useLessonBoardOrientation(stepDefault: Orientation = "white"): Orientation {
  const ctx = useContext(LessonBoardOrientationContext)
  if (!ctx) return stepDefault
  return ctx.isFlipped ? flipOrientation(stepDefault) : stepDefault
}

/** Flip control for LessonLayout (null outside a lesson session). */
export function useLessonBoardFlipControl() {
  const ctx = useContext(LessonBoardOrientationContext)
  if (!ctx) return null
  return { toggleFlip: ctx.toggleFlip }
}
