// lib/engine/format.ts
// Pure helpers for turning raw Stockfish output into UI-friendly values:
// normalizing scores to White's perspective (for the eval bar), converting a
// UCI principal variation into SAN using chess.js, and formatting eval text.

import { Chess } from "chess.js"
import type { EngineLine } from "./stockfish"

export interface NormalizedEval {
  /** Centipawns from White's perspective (positive = White better). */
  whiteCp: number | null
  /** Mate distance from White's perspective (positive = White mates). */
  whiteMate: number | null
}

/** Side to move from a FEN ("w" or "b"). Defaults to white if malformed. */
export function sideToMove(fen: string): "w" | "b" {
  return fen.split(/\s+/)[1] === "b" ? "b" : "w"
}

/**
 * Stockfish reports scores relative to the side to move. Flip the sign when it's
 * Black's turn so the eval bar always reads from White's point of view.
 */
export function toWhitePerspective(line: EngineLine, fen: string): NormalizedEval {
  const sign = sideToMove(fen) === "w" ? 1 : -1
  return {
    whiteCp: line.scoreCp === null ? null : line.scoreCp * sign,
    whiteMate: line.scoreMate === null ? null : line.scoreMate * sign,
  }
}

/** Human eval string, e.g. "+1.32", "-0.50", "M5", "-M3", "0.00". */
export function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) {
    if (mate === 0) return "#"
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  }
  if (cp === null) return "0.00"
  const pawns = cp / 100
  const sign = pawns > 0 ? "+" : pawns < 0 ? "" : "+"
  return `${sign}${pawns.toFixed(2)}`
}

/**
 * Eval bar fill, 0..1, where 1 = White completely winning. Uses a smooth
 * sigmoid on centipawns and clamps mates to the extremes.
 */
export function evalBarFraction(whiteCp: number | null, whiteMate: number | null): number {
  if (whiteMate !== null) {
    if (whiteMate === 0) return whiteMate >= 0 ? 1 : 0
    return whiteMate > 0 ? 1 : 0
  }
  if (whiteCp === null) return 0.5
  // Logistic curve: ~0.5 at 0cp, saturates near ±1000cp.
  const k = 0.0035
  return 1 / (1 + Math.exp(-k * whiteCp))
}

/** Convert a UCI principal variation into SAN, starting from `fen`. */
export function uciPvToSan(fen: string, pv: string[]): string[] {
  const out: string[] = []
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return out
  }
  for (const uci of pv) {
    if (uci.length < 4) break
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    try {
      const mv = chess.move({ from, to, promotion })
      if (!mv) break
      out.push(mv.san)
    } catch {
      break
    }
  }
  return out
}

/** Convert a single UCI move to SAN from `fen` (best move display). */
export function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null
  const san = uciPvToSan(fen, [uci])
  return san[0] ?? null
}
