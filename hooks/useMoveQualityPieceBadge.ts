"use client"

import { useEffect } from "react"
import type { MoveQuality } from "@/lib/move-quality"
import { moveQualityStyle } from "@/lib/move-quality"

export const MOVE_QUALITY_PIECE_BASE_CLASS = "move-quality-piece"

const ALL_BADGE_CLASSES = [
  "move-quality-brilliant",
  "move-quality-good",
  "move-quality-interesting",
  "move-quality-dubious",
  "move-quality-mistake",
  "move-quality-blunder",
] as const

export interface MoveQualityBadgeTarget {
  square: string
  quality: MoveQuality
}

/** Circle badge on the piece at `square` (top-right) for the active move-quality marker. */
export function useMoveQualityPieceBadge(
  boardRef: React.RefObject<HTMLDivElement | null>,
  target: MoveQualityBadgeTarget | null | undefined,
) {
  useEffect(() => {
    const root = boardRef.current
    if (!root) return

    const marked = root.querySelectorAll<HTMLElement>(`.${MOVE_QUALITY_PIECE_BASE_CLASS}`)
    for (const el of marked) {
      el.classList.remove(MOVE_QUALITY_PIECE_BASE_CLASS, ...ALL_BADGE_CLASSES)
    }

    if (!target) return

    const piece = root.querySelector<HTMLElement>(`[data-piece][id$="-${target.square}"]`)
    if (!piece) return

    const { pieceBadgeClass } = moveQualityStyle(target.quality)
    piece.classList.add(MOVE_QUALITY_PIECE_BASE_CLASS, pieceBadgeClass)

    return () => {
      piece.classList.remove(MOVE_QUALITY_PIECE_BASE_CLASS, pieceBadgeClass)
    }
  }, [boardRef, target?.square, target?.quality])
}
