"use client"

import { useEffect, useRef } from "react"
import { PIECE_LATCH_CLASS, PIECE_LATCH_DURATION_MS } from "@/lib/legal-move-highlights"

/** dnd-kit draggable pieces inside react-chessboard (Enter/Space start keyboard drag). */
const DRAGGABLE_SELECTOR = '[aria-roledescription="draggable"]'

/** Attach to the board wrapper; plays a one-shot latch jitter on the selected piece. */
export function usePieceLatchRef(latchSquare: string | null) {
  const ref = useRef<HTMLDivElement>(null)

  // react-chessboard wires dnd-kit KeyboardSensor (Enter/Space → drag start). A focused
  // piece then shows the drag overlay at scale(1.2). Block those keys in capture phase
  // so click-to-move selection is not hijacked by keyboard drag.
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const board = root

    function onKeyDownCapture(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return
      const target = e.target
      if (!(target instanceof Node) || !board.contains(target)) return
      if (!(target instanceof Element) || !target.closest(DRAGGABLE_SELECTOR)) return
      e.preventDefault()
      e.stopPropagation()
    }

    board.addEventListener("keydown", onKeyDownCapture, true)
    return () => board.removeEventListener("keydown", onKeyDownCapture, true)
  }, [])

  useEffect(() => {
    if (!latchSquare) return
    const root = ref.current
    if (!root) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const piece = root.querySelector<HTMLElement>(`[data-piece][id$="-${latchSquare}"]`)
    if (!piece) return

    piece.classList.remove(PIECE_LATCH_CLASS)
    // Force reflow so re-latching the same square replays the animation.
    void piece.offsetWidth
    piece.classList.add(PIECE_LATCH_CLASS)

    const timer = window.setTimeout(() => {
      piece.classList.remove(PIECE_LATCH_CLASS)
    }, PIECE_LATCH_DURATION_MS)

    return () => {
      window.clearTimeout(timer)
      piece.classList.remove(PIECE_LATCH_CLASS)
    }
  }, [latchSquare])

  return ref
}
