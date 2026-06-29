// lib/insights/learn-links.ts
// Deep-link helpers from post-game insights into the gamified browsers
// (/key-concepts and /tactical-patterns). The aggregated "Key concepts" and
// "Tactical patterns" surfaced in insights are ALREADY taxonomy ids, so they
// link directly. The detection-only motifs (InsightMotifId) are a deliberately
// separate vocabulary — only a subset corresponds to a taxonomy entry, so the
// mapping is sparse and everything else degrades gracefully (no link).

import { getKeyConcept, type KeyConceptId } from "@/lib/key-concepts"
import { getTacticalPattern, type TacticalPatternId } from "@/lib/tactical-patterns"
import type { InsightMotifId } from "./motifs"

/** Deep link that auto-selects a concept in the /key-concepts browser. */
export function keyConceptHref(id: KeyConceptId | string): string {
  return `/key-concepts?concept=${encodeURIComponent(id)}`
}

/** Deep link that auto-selects a pattern in the /tactical-patterns browser. */
export function tacticalPatternHref(id: TacticalPatternId | string): string {
  return `/tactical-patterns?pattern=${encodeURIComponent(id)}`
}

export type MotifLearnTarget =
  | { kind: "pattern"; id: TacticalPatternId; href: string; title: string }
  | { kind: "concept"; id: KeyConceptId; href: string; title: string }
  | null

/**
 * Detection motif → gamified taxonomy entry. Only entries with a clear
 * counterpart are mapped; the rest return null so the UI shows no broken link.
 */
const MOTIF_TO_PATTERN: Partial<Record<InsightMotifId, TacticalPatternId>> = {
  fork: "tp-fork",
  pin: "tp-pin",
  skewer: "tp-skewer",
  "discovered-attack": "tp-discovered-attack",
  "double-attack": "tp-fork",
  "hanging-piece": "tp-hanging-piece",
  "removal-of-defender": "tp-deflection",
  "back-rank": "tp-back-rank-mate",
  sacrifice: "tp-sacrifice",
  "taking-with-check": "tp-taking-with-check",
}

const MOTIF_TO_CONCEPT: Partial<Record<InsightMotifId, KeyConceptId>> = {
  "mating-net": "kc-checkmate",
}

/** Resolve the taxonomy "Learn" target for a detected motif, or null. */
export function motifLearnTarget(id: InsightMotifId): MotifLearnTarget {
  const patternId = MOTIF_TO_PATTERN[id]
  if (patternId) {
    const pattern = getTacticalPattern(patternId)
    if (pattern) {
      return { kind: "pattern", id: patternId, href: tacticalPatternHref(patternId), title: pattern.title }
    }
  }
  const conceptId = MOTIF_TO_CONCEPT[id]
  if (conceptId) {
    const concept = getKeyConcept(conceptId)
    if (concept) {
      return { kind: "concept", id: conceptId, href: keyConceptHref(conceptId), title: concept.title }
    }
  }
  return null
}
