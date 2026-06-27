// lib/commentary/match.ts
// Material delta + rudimentary, high-precision heuristic tagging of moves to the
// real TACTICAL_PATTERNS / KEY_CONCEPTS taxonomies. Only fires tags we can detect
// reliably; the rest are left for the LLM to infer from the full concept list.

import { Chess } from "chess.js"
import type { AttackFact, KeyConceptId, Side, TacticalPatternId } from "./types"

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Mover material balance (mover - opponent), in pawns, for a FEN. */
function balance(fen: string, mover: Side): number {
  const c = new Chess(fen)
  let bal = 0
  for (const row of c.board())
    for (const cell of row)
      if (cell) bal += (cell.color === mover ? 1 : -1) * VALUE[cell.type]
  return bal
}

export function materialDelta(fenBefore: string, fenAfter: string, mover: Side): number {
  return balance(fenAfter, mover) - balance(fenBefore, mover)
}

export interface MatchContext {
  toSquare: string // destination square of the moved piece
  side: Side
  legalAttacks: AttackFact[]
  materialDelta: number
  evalAfterCp: number
  isCheck: boolean
  isCheckmate: boolean
  isCapture: boolean
}

export interface MatchResult {
  tacticalPatternIds: TacticalPatternId[]
  keyConceptIds: KeyConceptId[]
}

export function matchTags(ctx: MatchContext): MatchResult {
  const tp = new Set<TacticalPatternId>()
  const kc = new Set<KeyConceptId>()

  // FORK: the MOVED piece attacks 2+ enemy pieces (any piece, or king via check).
  const fromMovedPiece = ctx.legalAttacks.filter((a) => a.bySquare === ctx.toSquare)
  const forkTargets = new Set(
    fromMovedPiece
      .filter((a) => a.givesCheck || ["p", "n", "b", "r", "q"].includes(a.targetPiece))
      .map((a) => a.targetSquare),
  )
  if (forkTargets.size >= 2) tp.add("tp-fork")

  // TAKING WITH CHECK: capture that also gives (non-mating) check.
  if (ctx.isCapture && ctx.isCheck && !ctx.isCheckmate) tp.add("tp-taking-with-check")

  // BACK-RANK MATE: checkmate delivered on the 1st/8th rank (rough heuristic).
  if (ctx.isCheckmate && /[18]$/.test(ctx.toSquare)) {
    tp.add("tp-back-rank-mate")
    kc.add("kc-back-rank-mate")
  }

  // DANGER LEVELS: capture/attack a higher-value target while giving up material.
  if (ctx.isCapture && ctx.materialDelta <= 0 && ctx.evalAfterCp > 50) tp.add("tp-danger-levels")

  // CHECKMATE concept.
  if (ctx.isCheckmate) kc.add("kc-checkmate")

  // THE INITIATIVE: sacrifice (gave material) that keeps a clear advantage.
  if (ctx.materialDelta < 0 && ctx.evalAfterCp > 150) kc.add("kc-the-initiative")

  return { tacticalPatternIds: [...tp], keyConceptIds: [...kc] }
}
