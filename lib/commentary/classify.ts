// lib/commentary/classify.ts
// Pure eval normalization + move classification from two EngineLine results.

import type { EngineLine } from "@/lib/engine/stockfish"
import type { MoveClassification } from "./types"

/** Sentinel so mates dominate cp arithmetic. */
export const MATE_CP = 100_000

/** Collapse an EngineLine to a single signed cp value, RELATIVE TO SIDE-TO-MOVE. */
export function lineToCp(line: Pick<EngineLine, "scoreCp" | "scoreMate">): number {
  if (line.scoreMate !== null) {
    // Positive mate = side-to-move mates; negative = gets mated.
    return line.scoreMate > 0 ? MATE_CP - line.scoreMate : -MATE_CP - line.scoreMate
  }
  return line.scoreCp ?? 0
}

/** Cp-loss thresholds (mover POV). Tunable to mirror chess.com-style buckets. */
export const CLASSIFY_THRESHOLDS = {
  best: 10,
  good: 50,
  inaccuracy: 100,
  mistake: 250, // > mistake ⇒ blunder
} as const

export interface ClassifyInput {
  before: EngineLine // analysis of fenBefore (best play available to mover)
  after: EngineLine // analysis of fenAfter (now opponent to move)
  playedIsBest: boolean
  isSacrifice: boolean
}

export interface ClassifyResult {
  evalBeforeCp: number
  evalAfterCp: number
  evalDeltaCp: number
  cpLoss: number
  mateBefore: number | null
  mateAfter: number | null
  classification: MoveClassification
}

export function classifyMove(input: ClassifyInput): ClassifyResult {
  const { before, after, playedIsBest, isSacrifice } = input

  // `before` is relative to the mover (mover is side-to-move in fenBefore).
  const evalBeforeCp = lineToCp(before)
  // `after` is relative to the OPPONENT (they're now to move) → negate for mover POV.
  const evalAfterCp = -lineToCp(after)

  const evalDeltaCp = evalAfterCp - evalBeforeCp
  const cpLoss = Math.max(0, -evalDeltaCp)

  const t = CLASSIFY_THRESHOLDS
  let classification: MoveClassification
  if (cpLoss > t.mistake) classification = "blunder"
  else if (cpLoss > t.inaccuracy) classification = "mistake"
  else if (cpLoss > t.good) classification = "inaccuracy"
  else if (cpLoss > t.best) classification = "good"
  else classification = "best"

  // Brilliant: a (near-)best move that sacrifices material yet stays clearly winning.
  if (
    (classification === "best" || classification === "good") &&
    isSacrifice &&
    playedIsBest &&
    evalAfterCp > 150
  ) {
    classification = "brilliant"
  }

  // Mate distances, converted to mover POV (after-line is from opponent's POV).
  const mateBefore = before.scoreMate
  const mateAfter = after.scoreMate === null ? null : -after.scoreMate

  return { evalBeforeCp, evalAfterCp, evalDeltaCp, cpLoss, mateBefore, mateAfter, classification }
}
