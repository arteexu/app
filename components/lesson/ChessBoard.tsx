"use client"
import { Chessboard } from "react-chessboard"
import type { Arrow, PieceDropHandlerArgs } from "react-chessboard"
import type { BoardAnnotations } from "@/lib/types"

interface Props {
  fen: string
  orientation?: "white" | "black"
  onPieceDrop?: (from: string, to: string) => boolean
  onSquareClick?: (square: string) => void
  squareStyles?: Record<string, React.CSSProperties>
  arrows?: Arrow[]
  interactive?: boolean
}

export function ChessBoard({ fen, orientation = "white", onPieceDrop, onSquareClick, squareStyles, arrows, interactive = false }: Props) {
  return (
    <div className="rounded-xl overflow-hidden shadow-md w-full max-w-sm mx-auto">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: interactive,
          squareStyles,
          arrows,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          boardStyle: { borderRadius: "4px" },
          onPieceDrop: interactive && onPieceDrop
            ? ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) =>
                targetSquare ? onPieceDrop(sourceSquare, targetSquare) : false
            : undefined,
          onSquareClick: interactive && onSquareClick
            ? ({ square }) => onSquareClick(square)
            : undefined,
        }}
      />
    </div>
  )
}

export function annotationsToProps(annotations?: BoardAnnotations) {
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (annotations?.highlightSquares) {
    for (const [sq, color] of Object.entries(annotations.highlightSquares)) {
      squareStyles[sq] = { backgroundColor: color }
    }
  }
  const arrows: Arrow[] = (annotations?.arrows ?? []).map(a => ({
    startSquare: a.from,
    endSquare: a.to,
    color: a.color ?? "#f6a623",
  }))
  return { squareStyles, arrows }
}
