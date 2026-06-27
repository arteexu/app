// lib/commentary/game-insights.ts
// Shared post-game insight helpers for full-chess Play games (and reusable elsewhere).
// Pivotal-ply selection + deterministic tag extraction from ConceptRecords.

import type { KeyConceptId } from "@/lib/key-concepts"
import type { TacticalPatternId } from "@/lib/tactical-patterns"
import type { ConceptRecord, MoveClassification } from "./types"
import type { GameResult, PlayedMove } from "@/lib/play/types"
import { fenBeforePly } from "@/lib/play/saved-play-games"

export interface PlyCandidate {
  ply: number
  reason: string
  priority: number
}

/** Rank candidate plies in a completed Play game (higher = more interesting). */
export function rankPlayPivotalCandidates(
  moves: PlayedMove[],
  result: GameResult,
): PlyCandidate[] {
  const candidates: PlyCandidate[] = []
  const seen = new Set<number>()

  function add(ply: number, reason: string, priority: number) {
    if (seen.has(ply) || ply < 0 || ply >= moves.length) return
    seen.add(ply)
    candidates.push({ ply, reason, priority })
  }

  for (let i = 0; i < moves.length; i++) {
    const san = moves[i].san
    if (/#/.test(san)) add(i, "checkmate", 98)
    else if (/\+/.test(san)) add(i, "check", 75)
    else if (/x/.test(san)) add(i, "capture", 68)
  }

  if (result.reason === "checkmate" && moves.length > 0) {
    add(moves.length - 1, "deciding blow", 94)
  }

  if (moves.length > 0) add(moves.length - 1, "final move", 62)
  if (moves.length > 2) add(Math.floor(moves.length / 2), "middlegame", 52)

  return candidates.sort((a, b) => b.priority - a.priority)
}

/** Up to `max` pivotal ply indices for post-game analysis. */
export function selectPlayPivotalPlies(
  moves: PlayedMove[],
  result: GameResult,
  max = 5,
): number[] {
  return rankPlayPivotalCandidates(moves, result)
    .slice(0, max)
    .map((c) => c.ply)
}

/** Pattern IDs that must come from matchTags — never inferred from LLM prose. */
const RULE_VERIFIED_TP = new Set<TacticalPatternId>([
  "tp-fork",
  "tp-back-rank-mate",
  "tp-taking-with-check",
  "tp-danger-levels",
])

const RULE_VERIFIED_KC = new Set<KeyConceptId>([
  "kc-back-rank-mate",
  "kc-checkmate",
  "kc-the-initiative",
])

/**
 * Tags grounded in engine + chess.js heuristics (matchTags on ConceptRecord).
 * Fork / back-rank mate are ONLY included when matchTags fired — not from commentary.
 */
export function verifiedTagsFromRecord(record: ConceptRecord): {
  keyConceptIds: KeyConceptId[]
  tacticalPatternIds: TacticalPatternId[]
} {
  return {
    keyConceptIds: record.matchedKeyConceptIds.filter((id) => RULE_VERIFIED_KC.has(id)),
    tacticalPatternIds: record.matchedTacticalPatternIds.filter((id) =>
      RULE_VERIFIED_TP.has(id),
    ),
  }
}

export interface PlyInsight {
  ply: number
  moveSan: string
  fenBefore: string
  reason: string
  comment: string
  source: "llm" | "template"
  classification: MoveClassification
  /** Deterministic tags from matchTags — safe to label "Detected". */
  detectedKeyConceptIds: KeyConceptId[]
  detectedTacticalPatternIds: TacticalPatternId[]
}

export interface GameInsights {
  plyInsights: PlyInsight[]
  aggregatedKeyConcepts: KeyConceptId[]
  aggregatedTacticalPatterns: TacticalPatternId[]
}

export function aggregateFromPlyInsights(insights: PlyInsight[]): {
  aggregatedKeyConcepts: KeyConceptId[]
  aggregatedTacticalPatterns: TacticalPatternId[]
} {
  const kcCount = new Map<KeyConceptId, number>()
  const tpCount = new Map<TacticalPatternId, number>()
  for (const pi of insights) {
    for (const id of pi.detectedKeyConceptIds) kcCount.set(id, (kcCount.get(id) ?? 0) + 1)
    for (const id of pi.detectedTacticalPatternIds)
      tpCount.set(id, (tpCount.get(id) ?? 0) + 1)
  }
  const sortByCount = <T extends string>(map: Map<T, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  return {
    aggregatedKeyConcepts: sortByCount(kcCount).slice(0, 5),
    aggregatedTacticalPatterns: sortByCount(tpCount).slice(0, 5),
  }
}

/** Pick the ply with the largest cpLoss from quick engine records. */
export function pickBiggestEvalDropPly(
  evaluated: Array<{ ply: number; cpLoss: number }>,
  minCpLoss = 80,
): number | null {
  let best: { ply: number; cpLoss: number } | null = null
  for (const e of evaluated) {
    if (e.cpLoss >= minCpLoss && (!best || e.cpLoss > best.cpLoss)) best = e
  }
  return best?.ply ?? null
}

export function moveSanAt(moves: PlayedMove[], ply: number): string {
  return moves[ply]?.san ?? "?"
}

export function fenBeforeAt(moves: PlayedMove[], ply: number): string {
  return fenBeforePly(moves, ply)
}
