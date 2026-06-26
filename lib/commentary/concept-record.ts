// lib/commentary/concept-record.ts
// Pure orchestrator: two EngineLine results (before/after) + the played move →
// a fully-grounded ConceptRecord. No engine/network calls happen here.

import { Chess } from "chess.js"
import type { EngineLine } from "@/lib/engine/stockfish"
import { sideToMove, uciPvToSan, uciToSan } from "@/lib/engine/format"
import { classifyMove } from "./classify"
import { enumerateAttacks, findHanging } from "./attacks"
import { materialDelta, matchTags } from "./match"
import type { CandidateLine, ConceptRecord, GamePhase, RefutationLine } from "./types"

function phaseOf(fen: string): GamePhase {
  const c = new Chess(fen)
  let majors = 0
  let men = 0
  for (const row of c.board())
    for (const cell of row)
      if (cell) {
        men++
        if (cell.type === "q" || cell.type === "r") majors++
      }
  const fullmove = Number(fen.split(/\s+/)[5] ?? 1)
  if (fullmove <= 10 && men >= 28) return "opening"
  if (men <= 12 || majors <= 2) return "endgame"
  return "middlegame"
}

export interface BuildConceptRecordArgs {
  fenBefore: string
  moveSan: string
  before: EngineLine
  after: EngineLine
  userRating?: number
  /** Phase 2: precomputed MultiPV candidate lines (rigorous mode). */
  candidates?: CandidateLine[]
  /** Phase 2: precomputed refutation / consequence lines (rigorous mode). */
  refutations?: RefutationLine[]
}

/**
 * Build a ConceptRecord. Pure & synchronous given the two engine results, so it
 * is trivially testable. Throws if the move is illegal for `fenBefore`.
 */
export function buildConceptRecord(args: BuildConceptRecordArgs): ConceptRecord {
  const { fenBefore, moveSan, before, after, userRating, candidates, refutations } = args
  const side = sideToMove(fenBefore)

  const c = new Chess(fenBefore)
  const mv = c.move(moveSan)
  if (!mv) throw new Error(`Illegal move ${moveSan} for ${fenBefore}`)
  const fenAfter = c.fen()
  const isCheck = c.inCheck()
  const isCheckmate = c.isCheckmate()
  const isCapture = !!mv.captured

  const bestMoveUci = before.pv[0] ?? null
  const bestMoveSan = uciToSan(fenBefore, bestMoveUci)
  const playedIsBest = !!bestMoveSan && bestMoveSan === mv.san

  const matDelta = materialDelta(fenBefore, fenAfter, side)
  const isSacrifice = matDelta < 0

  const cls = classifyMove({ before, after, playedIsBest, isSacrifice })
  const legalAttacks = enumerateAttacks(fenAfter, side)
  const hangingPieces = findHanging(fenAfter)

  const { tacticalPatternIds, keyConceptIds } = matchTags({
    toSquare: mv.to,
    side,
    legalAttacks,
    materialDelta: matDelta,
    evalAfterCp: cls.evalAfterCp,
    isCheck,
    isCheckmate,
    isCapture,
  })

  return {
    fenBefore,
    fenAfter,
    moveSan: mv.san,
    moveUci: `${mv.from}${mv.to}${mv.promotion ?? ""}`,
    side,
    phase: phaseOf(fenBefore),
    evalBeforeCp: cls.evalBeforeCp,
    evalAfterCp: cls.evalAfterCp,
    evalDeltaCp: cls.evalDeltaCp,
    mateBefore: cls.mateBefore,
    mateAfter: cls.mateAfter,
    cpLoss: cls.cpLoss,
    classification: cls.classification,
    bestMoveSan,
    bestMoveUci,
    playedIsBest,
    topPvSan: uciPvToSan(fenBefore, before.pv),
    candidates: candidates ?? [],
    refutations: refutations ?? [],
    materialDelta: matDelta,
    legalAttacks,
    hangingPieces,
    matchedTacticalPatternIds: tacticalPatternIds,
    matchedKeyConceptIds: keyConceptIds,
    userRating,
  }
}
