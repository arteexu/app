"use client"

import { useEffect } from "react"

export const WRONG_MOVE_PIECE_CLASS = "wrong-move-piece"

/** Marks the piece on the destination square with a red-disk × badge after a wrong guess. */
export function useWrongMovePieceBadge(
  boardRef: React.RefObject<HTMLDivElement | null>,
  toSquare: string | null | undefined,
) {
  useEffect(() => {
    const root = boardRef.current
    if (!root) return

    const marked = root.querySelectorAll<HTMLElement>(`.${WRONG_MOVE_PIECE_CLASS}`)
    for (const el of marked) el.classList.remove(WRONG_MOVE_PIECE_CLASS)

    if (!toSquare) return

    const piece = root.querySelector<HTMLElement>(`[data-piece][id$="-${toSquare}"]`)
    if (!piece) return

    piece.classList.add(WRONG_MOVE_PIECE_CLASS)

    return () => {
      piece.classList.remove(WRONG_MOVE_PIECE_CLASS)
    }
  }, [boardRef, toSquare])
}
