// lib/board-explanations/geometry.ts
// Deterministic square → board-percentage mapping for positioning overlay markers
// on top of a react-chessboard. No DOM measuring needed: a chessboard is an 8×8
// grid, so each square center sits at a fixed percentage of the board, adjusted
// for orientation. The overlay layer is sized to exactly cover the board, so
// percentages translate directly to marker positions.

export type BoardOrientation = "white" | "black"

const FILE_A = "a".charCodeAt(0)
const SQUARE_PCT = 12.5 // 100% / 8

export interface SquarePosition {
  /** Center X as a percentage (0–100) of the board width. */
  leftPct: number
  /** Center Y as a percentage (0–100) of the board height. */
  topPct: number
}

/** True for a well-formed algebraic square like "e4" / "h8". */
export function isValidSquare(square: string): boolean {
  if (square.length !== 2) return false
  const file = square.charCodeAt(0) - FILE_A
  const rank = Number(square[1])
  return file >= 0 && file <= 7 && rank >= 1 && rank <= 8
}

/**
 * Center of `square` as board-relative percentages, honoring orientation.
 * White: a-file on the left, rank 8 on top. Black: mirrored on both axes.
 * Returns null for malformed squares so callers can skip bad annotations.
 */
export function squareCenterPercent(
  square: string,
  orientation: BoardOrientation = "white",
): SquarePosition | null {
  if (!isValidSquare(square)) return null
  const file = square.charCodeAt(0) - FILE_A // a=0 … h=7
  const rank = Number(square[1])             // 1 … 8

  let col = file          // columns left→right
  let row = 8 - rank      // rank 8 → row 0 (top)
  if (orientation === "black") {
    col = 7 - file
    row = rank - 1
  }

  return {
    leftPct: (col + 0.5) * SQUARE_PCT,
    topPct: (row + 0.5) * SQUARE_PCT,
  }
}

export const BOARD_SQUARE_PCT = SQUARE_PCT
