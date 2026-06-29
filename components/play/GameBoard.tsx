"use client"
// components/play/GameBoard.tsx
// Reusable full-game board for Play (vs Bot and vs Human). Renders react-chessboard
// with chess.js-backed legal-move highlights, click- and drag-to-move, a last-move
// highlight, right-click square markers, and an inline promotion picker. It is
// purely an INPUT surface: it asks the parent to apply a candidate move via
// onAttemptMove(from, to, promotion) and reflects whatever `fen` the parent passes
// back. The parent owns the authoritative game state (local for bot, server for live).

import { useMemo, useRef, useState } from "react"
import { Chess, type Square } from "chess.js"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { usePieceLatchRef } from "@/hooks/usePieceLatchRef"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import {
  buildLastMoveStyles,
  buildSelectionStyles,
  buildUserHighlightStyles,
  composeSquareStyles,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/legal-move-highlights"
import { charFromColor, isPromotion } from "@/lib/play/game"
import type { PieceColor } from "@/lib/play/types"
import { PromotionPicker } from "./PromotionPicker"

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

interface Props {
  fen: string
  orientation: PieceColor
  /** The color this client controls; only its pieces are draggable. */
  myColor: PieceColor
  /** Whether it is currently legal for this client to move (my turn + game live). */
  canMove: boolean
  /** Apply a candidate move; return true if it was accepted. */
  onAttemptMove: (from: string, to: string, promotion?: string) => boolean
  lastMove?: { from: string; to: string } | null
  boardId?: string
}

export function GameBoard({
  fen,
  orientation,
  myColor,
  canMove,
  onAttemptMove,
  lastMove,
  boardId = "play-board",
}: Props) {
  const { showLegalMoves } = useBoardPreferences()
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)

  const chess = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return new Chess()
    }
  }, [fen])

  const myCharColor = charFromColor(myColor)

  const {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game: chess,
    enabled: showLegalMoves && canMove,
    isSelectable: (_sq, piece) => !!piece && piece.color === myCharColor,
  })

  const boardRef = usePieceLatchRef(latchAnimSquare)

  function commitMove(from: string, to: string): boolean {
    if (!canMove || from === to) return false
    // Promotion needs a piece choice first; defer to the picker.
    if (isPromotion(fen, from, to)) {
      setPromotion({ from, to })
      return false
    }
    const ok = onAttemptMove(from, to)
    if (ok) {
      clearHighlights()
      setUserHighlights([])
    }
    return ok
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    onDragEnd()
    if (!targetSquare) return false
    return commitMove(sourceSquare, targetSquare)
  }

  function handlePieceDrag(args: PieceHandlerArgs) {
    setUserHighlights([])
    onPieceDrag(args)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    // Always clear right-click square markers on a left-click, mirroring how
    // react-chessboard internally clears arrows on left mousedown. Move and
    // selection logic below still only runs when this client may move.
    setUserHighlights([])
    if (!canMove) return
    if (selectedSquare) {
      if (square === selectedSquare) {
        clearHighlights()
        return
      }
      if (commitMove(selectedSquare, square)) return
      clearHighlights()
      selectSquare(square)
      return
    }
    clearHighlights()
    selectSquare(square)
  }

  function choosePromotion(piece: "q" | "r" | "b" | "n") {
    if (!promotion) return
    const { from, to } = promotion
    setPromotion(null)
    const ok = onAttemptMove(from, to, piece)
    if (ok) {
      clearHighlights()
      setUserHighlights([])
    }
  }

  const squareStyles = composeSquareStyles(
    buildLastMoveStyles(lastMove?.from, lastMove?.to),
    buildUserHighlightStyles(userHighlights),
    canMove ? legalMoveSquares : null,
    canMove ? buildSelectionStyles(selectedSquare) : null,
  )

  return (
    <div ref={boardRef} className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove,
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          squareStyles,
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: BOARD_DARK },
          lightSquareStyle: { backgroundColor: BOARD_LIGHT },
          id: boardId,
          onPieceDrop: canMove ? handleDrop : undefined,
          onPieceDrag: canMove ? handlePieceDrag : undefined,
          onSquareClick: handleSquareClick,
          ...userHighlightHandlers,
        }}
      />
      {promotion && (
        <PromotionPicker
          color={myColor}
          onChoose={choosePromotion}
          onCancel={() => setPromotion(null)}
        />
      )}
    </div>
  )
}
