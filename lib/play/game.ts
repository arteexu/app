// lib/play/game.ts
// Pure, framework-agnostic full-chess helpers shared by Play vs Bot and Play vs
// Human. chess.js is the single source of truth for legality and terminal-state
// detection (checkmate / stalemate / threefold / 50-move / insufficient material).

import { Chess, type Move, type Square } from "chess.js"
import type { GameResult, PieceColor, PlayedMove } from "./types"

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/** chess.js color char → our color union. */
export function colorFromChar(c: "w" | "b"): PieceColor {
  return c === "w" ? "white" : "black"
}

export function charFromColor(c: PieceColor): "w" | "b" {
  return c === "white" ? "w" : "b"
}

/** Rebuild a Chess from a move list (SAN replay), starting from the standard position. */
export function replayMoves(moves: PlayedMove[]): Chess {
  const chess = new Chess()
  for (const m of moves) {
    try {
      chess.move(m.san)
    } catch {
      // The list is validated at play time; ignore a corrupt tail defensively.
      break
    }
  }
  return chess
}

/** UCI string for a chess.js Move (e.g. "e2e4", "e7e8q"). */
export function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`
}

/** Convert a chess.js Move into our serializable PlayedMove. */
export function toPlayedMove(move: Move, fenAfter: string, ply: number): PlayedMove {
  return {
    ply,
    san: move.san,
    uci: moveToUci(move),
    fenAfter,
    color: colorFromChar(move.color),
  }
}

/**
 * Detect a NATURAL game result from a position (after a move was played).
 * Returns null while the game is still going. Does not cover resign/timeout/
 * draw-agreement — those are decided by the caller.
 */
export function detectResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    // Side to move is checkmated → the other side won.
    const winner: PieceColor = chess.turn() === "w" ? "black" : "white"
    return { winner, reason: "checkmate" }
  }
  if (chess.isStalemate()) return { winner: "draw", reason: "stalemate" }
  if (chess.isInsufficientMaterial()) return { winner: "draw", reason: "insufficient_material" }
  if (chess.isThreefoldRepetition()) return { winner: "draw", reason: "threefold" }
  // chess.js isDraw() also covers the 50-move rule.
  if (chess.isDraw()) return { winner: "draw", reason: "fifty_move" }
  return null
}

/** A short human status line for the live game header. */
export function statusText(chess: Chess): string {
  const stm: PieceColor = colorFromChar(chess.turn())
  const them: PieceColor = stm === "white" ? "black" : "white"
  if (chess.isCheckmate()) return `Checkmate — ${cap(them)} wins`
  if (chess.isStalemate()) return "Stalemate — draw"
  if (chess.isInsufficientMaterial()) return "Draw — insufficient material"
  if (chess.isThreefoldRepetition()) return "Draw — threefold repetition"
  if (chess.isDraw()) return "Draw — 50-move rule"
  if (chess.inCheck()) return `${cap(stm)} is in check`
  return `${cap(stm)} to move`
}

function cap(c: PieceColor): string {
  return c === "white" ? "White" : "Black"
}

/** Validate + apply a from/to (with promotion) on a fen; returns the Move or null. */
export function tryMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): { move: Move; fenAfter: string } | null {
  const chess = new Chess(fen)
  try {
    const move = chess.move({ from: from as Square, to: to as Square, promotion })
    if (!move) return null
    return { move, fenAfter: chess.fen() }
  } catch {
    return null
  }
}

/** Does moving from→to require choosing a promotion piece? */
export function isPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen)
  const piece = chess.get(from as Square)
  if (!piece || piece.type !== "p") return false
  const targetRank = to[1]
  if (piece.color === "w" && targetRank !== "8") return false
  if (piece.color === "b" && targetRank !== "1") return false
  // Confirm it's actually a legal move shape to that square.
  return chess
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to)
}

/** Build a minimal PGN movetext from a move list (no headers). */
export function movesToPgn(moves: PlayedMove[]): string {
  const chess = new Chess()
  for (const m of moves) {
    try {
      chess.move(m.san)
    } catch {
      break
    }
  }
  return chess.pgn()
}
