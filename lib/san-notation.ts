// lib/san-notation.ts
// Parse Standard Algebraic Notation into display segments (piece icons + text).

import { sideToMove } from "@/lib/engine/format"

const PIECE_LETTERS = new Set(["K", "Q", "R", "B", "N"])

export type PieceColor = "white" | "black"

export type SanSegment =
  | { type: "piece"; pieceType: string }
  | { type: "text"; text: string }

export function colorFromPly(ply: number, startWhite = true): PieceColor {
  const isWhite = startWhite ? ply % 2 === 0 : ply % 2 === 1
  return isWhite ? "white" : "black"
}

export function colorFromSide(side: "w" | "b"): PieceColor {
  return side === "w" ? "white" : "black"
}

/** Color of the piece that moves at `moveIndex` when playing from `fen`. */
export function colorForMoveIndex(fen: string, moveIndex: number): PieceColor {
  const startWhite = sideToMove(fen) === "w"
  return colorFromPly(moveIndex, startWhite)
}

export function parseSanSegments(san: string, color: PieceColor): SanSegment[] {
  if (/^O-O(-O)?$/.test(san)) {
    return [{ type: "text", text: san }]
  }

  const prefix = color === "white" ? "w" : "b"

  if (san.length > 0 && PIECE_LETTERS.has(san[0]) && !san.startsWith("O")) {
    return [
      { type: "piece", pieceType: `${prefix}${san[0]}` },
      { type: "text", text: san.slice(1) },
    ]
  }

  const promoIdx = san.indexOf("=")
  if (promoIdx !== -1 && promoIdx < san.length - 1) {
    const promoLetter = san[promoIdx + 1]
    if (PIECE_LETTERS.has(promoLetter)) {
      const segments: SanSegment[] = [
        { type: "text", text: san.slice(0, promoIdx + 1) },
        { type: "piece", pieceType: `${prefix}${promoLetter}` },
      ]
      const tail = san.slice(promoIdx + 2)
      if (tail) segments.push({ type: "text", text: tail })
      return segments
    }
  }

  return [{ type: "text", text: san }]
}
