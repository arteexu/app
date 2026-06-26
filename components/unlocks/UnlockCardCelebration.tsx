"use client"

import { Confetti } from "@/components/lesson/RewardFx"
import { clsx } from "clsx"

interface Props {
  celebrate?: boolean
  children: React.ReactNode
  className?: string
}

/** Wraps unlock cards with a brief confetti burst on first-time unlock only. */
export function UnlockCardCelebration({ celebrate, children, className }: Props) {
  return (
    <div className={clsx("relative overflow-visible", className)}>
      {celebrate && <Confetti run count={36} originY={0.45} />}
      {children}
    </div>
  )
}
