// lib/insights/game-summary.ts
// Game-LEVEL insights derived purely from the existing per-ply scan (ScannedPly[])
// produced by analyze-game.ts. Nothing here calls the engine — it reuses the
// single-engine scan results, so adding this is free relative to the analysis
// that already ran. Everything is grounded in engine evals + deterministic motif
// detection (no LLM prose), so the aggregates are accurate by construction.
//
// New categories surfaced (on top of the existing per-move "notable moves"):
//   • Per-side quality: classification counts + an ACPL-based accuracy estimate.
//   • Turning point: the single move that swung the evaluation the most.
//   • Phase breakdown: opening / middlegame / endgame verdicts (where ground was lost).
//   • Recurring strengths: tactics the USER executed soundly, by frequency.
//   • Tactics allowed: sound tactics the OPPONENT landed against the user, by frequency.
//   • Missed opportunities: user mistakes/blunders where a clearly better move existed.

import type { GamePhase, MoveClassification, Side } from "@/lib/commentary/types"
import { INSIGHT_MOTIFS, type InsightMotifId } from "./motifs"
import type { ScannedPly } from "./analyze-game"

/** Tactic motif ids (vs. slower positional concepts). */
const TACTIC_MOTIFS: ReadonlySet<InsightMotifId> = new Set(
  INSIGHT_MOTIFS.filter((m) => m.kind === "tactic").map((m) => m.id),
)

/** Classifications we treat as engine-approved (a tactic on these is "real"). */
const SOUND: ReadonlySet<MoveClassification> = new Set<MoveClassification>([
  "brilliant",
  "best",
  "good",
])

/**
 * cpLoss can balloon when mate sentinels (±100000) enter the arithmetic. Clamp it
 * before averaging / ranking so a single forced-mate swing doesn't dwarf the rest.
 */
const CP_LOSS_CAP = 1000
/** Minimum (capped) swing for a move to qualify as the game's turning point. */
const TURNING_POINT_MIN = 120
/** Minimum (capped) cpLoss for a user move to count as a missed opportunity. */
const MISSED_MIN = 150
/** Accuracy decay constant for the ACPL → accuracy estimate (higher = more lenient). */
const ACCURACY_DECAY = 350

const PHASES: GamePhase[] = ["opening", "middlegame", "endgame"]

function cap(cpLoss: number): number {
  return Math.min(Math.max(0, cpLoss), CP_LOSS_CAP)
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n))
}

export interface SideStats {
  side: Side
  /** Plies this side actually played in the scan. */
  moves: number
  brilliant: number
  best: number
  good: number
  inaccuracy: number
  mistake: number
  blunder: number
  /** Average centipawn loss (capped), this side's moves only. */
  acpl: number
  /** ACPL-based accuracy estimate, 0–100 (clearly an estimate in the UI). */
  accuracy: number
}

export interface TurningPoint {
  ply: number
  moveSan: string
  side: Side
  byUser: boolean
  classification: MoveClassification
  /** Capped centipawn swing of this move. */
  cpLoss: number
}

export type PhaseVerdict = "strong" | "solid" | "shaky" | "costly"

export interface PhaseAssessment {
  phase: GamePhase
  plyCount: number
  userMoves: number
  userAcpl: number
  userBlunders: number
  verdict: PhaseVerdict
}

/** A motif that recurred — used for both strengths and tactics-allowed. */
export interface RecurringTheme {
  motifId: InsightMotifId
  count: number
}

export interface MissedOpportunity {
  ply: number
  /** The move the user actually played. */
  moveSan: string
  /** The engine's preferred move at that position. */
  bestMoveSan: string
  classification: MoveClassification
  /** Capped centipawn loss vs. the best move. */
  cpLoss: number
}

export interface GameSummary {
  user: SideStats
  opponent: SideStats
  turningPoint: TurningPoint | null
  phases: PhaseAssessment[]
  /** Phase where the user lost the most ground (highest ACPL), if meaningful. */
  lostGroundPhase: GamePhase | null
  /** Tactics the user executed on sound moves, by frequency. */
  strengths: RecurringTheme[]
  /** Sound tactics the opponent landed against the user, by frequency. */
  tacticsAllowed: RecurringTheme[]
  /** User mistakes/blunders where a clearly stronger move was available. */
  missedOpportunities: MissedOpportunity[]
}

function emptyStats(side: Side): SideStats {
  return {
    side,
    moves: 0,
    brilliant: 0,
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    acpl: 0,
    accuracy: 0,
  }
}

function computeSideStats(plies: ScannedPly[], side: Side): SideStats {
  const stats = emptyStats(side)
  let cpLossSum = 0
  for (const s of plies) {
    if (s.record.side !== side) continue
    stats.moves++
    stats[s.classification]++
    cpLossSum += cap(s.cpLoss)
  }
  if (stats.moves > 0) {
    stats.acpl = Math.round(cpLossSum / stats.moves)
    stats.accuracy = Math.round(clampPct(100 * Math.exp(-stats.acpl / ACCURACY_DECAY)))
  }
  return stats
}

function computeTurningPoint(plies: ScannedPly[], userSide: Side): TurningPoint | null {
  let best: ScannedPly | null = null
  let bestSwing = 0
  for (const s of plies) {
    const swing = cap(s.cpLoss)
    if (swing > bestSwing) {
      bestSwing = swing
      best = s
    }
  }
  if (!best || bestSwing < TURNING_POINT_MIN) return null
  return {
    ply: best.ply,
    moveSan: best.moveSan,
    side: best.record.side,
    byUser: best.record.side === userSide,
    classification: best.classification,
    cpLoss: bestSwing,
  }
}

function phaseVerdict(userAcpl: number, userBlunders: number): PhaseVerdict {
  if (userBlunders > 0 || userAcpl > 120) return "costly"
  if (userAcpl > 60) return "shaky"
  if (userAcpl <= 20) return "strong"
  return "solid"
}

function computePhases(
  plies: ScannedPly[],
  userSide: Side,
): { phases: PhaseAssessment[]; lostGroundPhase: GamePhase | null } {
  const phases: PhaseAssessment[] = []
  let lostGroundPhase: GamePhase | null = null
  let worstAcpl = 0

  for (const phase of PHASES) {
    const inPhase = plies.filter((s) => s.record.phase === phase)
    if (inPhase.length === 0) continue
    const userPlies = inPhase.filter((s) => s.record.side === userSide)
    const userBlunders = userPlies.filter((s) => s.classification === "blunder").length
    const userAcpl =
      userPlies.length > 0
        ? Math.round(userPlies.reduce((sum, s) => sum + cap(s.cpLoss), 0) / userPlies.length)
        : 0
    phases.push({
      phase,
      plyCount: inPhase.length,
      userMoves: userPlies.length,
      userAcpl,
      userBlunders,
      verdict: phaseVerdict(userAcpl, userBlunders),
    })
    // The phase where the user leaked the most ground (needs real signal).
    if (userPlies.length > 0 && userAcpl > worstAcpl && (userAcpl > 60 || userBlunders > 0)) {
      worstAcpl = userAcpl
      lostGroundPhase = phase
    }
  }

  return { phases, lostGroundPhase }
}

function rankMotifs(plies: ScannedPly[]): RecurringTheme[] {
  const count = new Map<InsightMotifId, number>()
  const firstSeen = new Map<InsightMotifId, number>()
  let seq = 0
  for (const s of plies) {
    for (const id of s.detectedMotifs) {
      if (!TACTIC_MOTIFS.has(id)) continue
      count.set(id, (count.get(id) ?? 0) + 1)
      if (!firstSeen.has(id)) firstSeen.set(id, seq++)
    }
  }
  return [...count.entries()]
    .map(([motifId, c]) => ({ motifId, count: c }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return (firstSeen.get(a.motifId) ?? 0) - (firstSeen.get(b.motifId) ?? 0)
    })
}

function computeMissedOpportunities(
  plies: ScannedPly[],
  userSide: Side,
): MissedOpportunity[] {
  const out: MissedOpportunity[] = []
  for (const s of plies) {
    if (s.record.side !== userSide) continue
    if (s.classification !== "mistake" && s.classification !== "blunder") continue
    if (!s.bestMoveSan || s.bestMoveSan === s.moveSan) continue
    const cpLoss = cap(s.cpLoss)
    if (cpLoss < MISSED_MIN) continue
    out.push({
      ply: s.ply,
      moveSan: s.moveSan,
      bestMoveSan: s.bestMoveSan,
      classification: s.classification,
      cpLoss,
    })
  }
  return out.sort((a, b) => b.cpLoss - a.cpLoss)
}

/**
 * Build the game-level summary from the per-ply scan. `userSide` is "w"/"b".
 * Pure & synchronous — safe to call right after scanGame() resolves.
 */
export function buildGameSummary(scanned: ScannedPly[], userSide: Side): GameSummary {
  const oppSide: Side = userSide === "w" ? "b" : "w"

  const userPlies = scanned.filter((s) => s.record.side === userSide)
  const oppPlies = scanned.filter((s) => s.record.side === oppSide)

  const { phases, lostGroundPhase } = computePhases(scanned, userSide)

  return {
    user: computeSideStats(scanned, userSide),
    opponent: computeSideStats(scanned, oppSide),
    turningPoint: computeTurningPoint(scanned, userSide),
    phases,
    lostGroundPhase,
    strengths: rankMotifs(userPlies.filter((s) => SOUND.has(s.classification))),
    tacticsAllowed: rankMotifs(oppPlies.filter((s) => SOUND.has(s.classification))),
    missedOpportunities: computeMissedOpportunities(scanned, userSide),
  }
}

/** Convert a board-color label to the engine Side used throughout the scan. */
export function sideFromColor(color: "white" | "black"): Side {
  return color === "white" ? "w" : "b"
}
