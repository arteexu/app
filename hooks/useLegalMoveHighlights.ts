"use client"

import { useMemo, useRef, useState } from "react"
import type { Chess, Square } from "chess.js"
import type { PieceHandlerArgs } from "react-chessboard"
import { buildLegalMoveSquareStyles, PIECE_LATCH_DURATION_MS } from "@/lib/legal-move-highlights"

type Piece = ReturnType<Chess["get"]>

interface Options {
  game: Chess
  enabled: boolean
  isSelectable?: (square: string, piece: Piece) => boolean
}

export function useLegalMoveHighlights({ game, enabled, isSelectable }: Options) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [dragSquare, setDragSquare] = useState<string | null>(null)
  const [latchAnimSquare, setLatchAnimSquare] = useState<string | null>(null)
  const latchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function triggerLatch(square: string) {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    if (latchTimerRef.current) clearTimeout(latchTimerRef.current)
    setLatchAnimSquare(null)
    requestAnimationFrame(() => {
      setLatchAnimSquare(square)
      latchTimerRef.current = setTimeout(() => {
        setLatchAnimSquare(null)
        latchTimerRef.current = null
      }, PIECE_LATCH_DURATION_MS)
    })
  }

  const activeSquare = dragSquare ?? selectedSquare

  const legalMoveSquares = useMemo(() => {
    if (!enabled || !activeSquare) return {}
    const piece = game.get(activeSquare as Square)
    if (isSelectable && !isSelectable(activeSquare, piece)) return {}
    return buildLegalMoveSquareStyles(game, activeSquare)
  }, [game, enabled, isSelectable, activeSquare])

  function selectSquare(square: string) {
    const piece = game.get(square as Square)
    if (isSelectable ? !isSelectable(square, piece) : !piece) {
      setSelectedSquare(null)
      setDragSquare(null)
      return
    }
    setSelectedSquare(square)
    setDragSquare(null)
    triggerLatch(square)
  }

  function clearHighlights() {
    setSelectedSquare(null)
    setDragSquare(null)
  }

  function onPieceDrag({ square }: PieceHandlerArgs) {
    if (!enabled || !square) return
    const piece = game.get(square as Square)
    if (isSelectable && !isSelectable(square, piece)) return
    setDragSquare(square)
    setSelectedSquare(null)
  }

  function onDragEnd() {
    setDragSquare(null)
    setSelectedSquare(null)
  }

  return {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  }
}
