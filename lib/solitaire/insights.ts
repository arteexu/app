// lib/solitaire/insights.ts
// Pure helpers for picking pivotal plies in a solitaire session and aggregating
// key concepts / tactical patterns from commentary ConceptRecords. Analysis
// orchestration lives in SolitaireGameInsights (client).

import type { KeyConceptId } from "@/lib/key-concepts"
import type { TacticalPatternId } from "@/lib/tactical-patterns"
import type { ConceptRecord, MoveClassification } from "@/lib/commentary/types"
import type { MoveOutcome, MoveResult } from "@/lib/solitaire-scoring"
import type { SolitaireGame } from "./types"
import { getCutoffPly } from "./engine"

export interface PlyCandidate {
  ply: number
  reason: string
  priority: number
}

/** Rank candidate plies for post-game commentary (higher priority = more interesting). */
export function rankPivotalCandidates(
  game: SolitaireGame,
  results: MoveResult[],
): PlyCandidate[] {
  const candidates: PlyCandidate[] = []
  const seen = new Set<number>()

  function add(ply: number, reason: string, priority: number) {
    if (seen.has(ply) || ply < 0 || ply >= game.moves.length) return
    seen.add(ply)
    candidates.push({ ply, reason, priority })
  }

  let firstMistake = false
  for (const r of results) {
    if (!firstMistake && (r.outcome === "revealed" || r.outcome === "skipped")) {
      add(r.ply, "revealed move", 92)
      firstMistake = true
    }
    if (!firstMistake && r.outcome === "retry" && r.attempts >= 2) {
      add(r.ply, "needed retries", 88)
      firstMistake = true
    }
    if (r.outcome === "first-try" && /#/.test(r.expectedSan)) add(r.ply, "checkmate", 96)
    if (r.outcome === "first-try" && /\+/.test(r.expectedSan)) add(r.ply, "check", 72)
    if (r.outcome === "first-try" && /x/.test(r.expectedSan)) add(r.ply, "capture", 68)
  }

  if (game.annotations) {
    for (const key of Object.keys(game.annotations)) {
      add(Number(key), "annotated moment", 78)
    }
  }

  if (results.length > 0) {
    add(results[results.length - 1].ply, "your last move", 62)
  }

  const cutoff = getCutoffPly(game)
  if (cutoff > 0) {
    add(cutoff - 1, "game finale", 58)
  }

  return candidates.sort((a, b) => b.priority - a.priority)
}

/** Up to `max` pivotal ply indices for post-game analysis. */
export function selectPivotalPlies(
  game: SolitaireGame,
  results: MoveResult[],
  max = 5,
): number[] {
  return rankPivotalCandidates(game, results)
    .slice(0, max)
    .map((c) => c.ply)
}

export interface PlyInsight {
  ply: number
  moveSan: string
  fenBefore: string
  reason: string
  outcome?: MoveOutcome
  comment: string
  source: "llm" | "template"
  classification: MoveClassification
  keyConceptIds: KeyConceptId[]
  tacticalPatternIds: TacticalPatternId[]
}

export interface GameInsights {
  plyInsights: PlyInsight[]
  aggregatedKeyConcepts: KeyConceptId[]
  aggregatedTacticalPatterns: TacticalPatternId[]
}

export function aggregateConceptsFromRecords(
  records: ConceptRecord[],
): { keyConceptIds: KeyConceptId[]; tacticalPatternIds: TacticalPatternId[] } {
  const kc = new Set<KeyConceptId>()
  const tp = new Set<TacticalPatternId>()
  for (const r of records) {
    for (const id of r.matchedKeyConceptIds) kc.add(id)
    for (const id of r.matchedTacticalPatternIds) tp.add(id)
  }
  return { keyConceptIds: [...kc], tacticalPatternIds: [...tp] }
}

/** Merge ply insights into aggregated concept lists (order: frequency then first seen). */
export function aggregateFromPlyInsights(insights: PlyInsight[]): {
  aggregatedKeyConcepts: KeyConceptId[]
  aggregatedTacticalPatterns: TacticalPatternId[]
} {
  const kcCount = new Map<KeyConceptId, number>()
  const tpCount = new Map<TacticalPatternId, number>()
  for (const pi of insights) {
    for (const id of pi.keyConceptIds) kcCount.set(id, (kcCount.get(id) ?? 0) + 1)
    for (const id of pi.tacticalPatternIds) tpCount.set(id, (tpCount.get(id) ?? 0) + 1)
  }
  const sortByCount = <T extends string>(map: Map<T, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  return {
    aggregatedKeyConcepts: sortByCount(kcCount).slice(0, 5),
    aggregatedTacticalPatterns: sortByCount(tpCount).slice(0, 5),
  }
}

/** Pick the ply with the largest cpLoss from quick engine records (eval swing). */
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
