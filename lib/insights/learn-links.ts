// lib/insights/learn-links.ts
// Deep-link helpers from post-game insights into the gamified browsers
// (/key-concepts and /tactical-patterns). The aggregated "Key concepts" and
// "Tactical patterns" surfaced in insights are ALREADY taxonomy ids, so they
// link directly. The detection-only motifs (InsightMotifId) are a deliberately
// separate vocabulary — only a subset corresponds to a taxonomy entry, so the
// mapping is sparse and everything else degrades gracefully (no link).

import { getKeyConcept, type KeyConceptId } from "@/lib/key-concepts"
import { getTacticalPattern, type TacticalPatternId } from "@/lib/tactical-patterns"
import { findLessonInCourses } from "@/lib/courses"
import type { InsightMotifId } from "./motifs"

/** Deep link that auto-selects a concept in the /key-concepts browser. */
export function keyConceptHref(id: KeyConceptId | string): string {
  return `/key-concepts?concept=${encodeURIComponent(id)}`
}

/** Deep link that auto-selects a pattern in the /tactical-patterns browser. */
export function tacticalPatternHref(id: TacticalPatternId | string): string {
  return `/tactical-patterns?pattern=${encodeURIComponent(id)}`
}

/** Deep link that opens a lesson at its first step. */
export function lessonHref(lessonId: string): string {
  return `/lessons/${encodeURIComponent(lessonId)}`
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

// ── Lesson mapping (concept / pattern / motif → the lessons that teach it) ─────
// The taxonomy entries (KEY_CONCEPTS / TACTICAL_PATTERNS) carry `lessonIds`. We
// resolve those ids against the in-memory course data so the post-game insights
// can offer "Learn this in: <lesson>" links. Ids that don't resolve to a real
// lesson are dropped (graceful degradation — never a dangling deep-link).

/** A lesson that teaches a detected concept / pattern, ready to deep-link into. */
export interface LessonLink {
  lessonId: string
  title: string
  courseTitle: string
  href: string
}

function resolveLessons(lessonIds: readonly string[]): LessonLink[] {
  const out: LessonLink[] = []
  const seen = new Set<string>()
  for (const id of lessonIds) {
    if (seen.has(id)) continue
    const match = findLessonInCourses(id)
    if (!match) continue // dangling id — skip rather than emit a broken link
    seen.add(id)
    out.push({
      lessonId: id,
      title: match.lesson.title,
      courseTitle: match.course.title,
      href: lessonHref(id),
    })
  }
  return out
}

/** Lessons that teach a given Key Concept (validated against course data). */
export function lessonsForKeyConcept(id: KeyConceptId | string): LessonLink[] {
  const concept = getKeyConcept(id)
  return concept ? resolveLessons(concept.lessonIds) : []
}

/** Lessons that teach a given Tactical Pattern (validated against course data). */
export function lessonsForTacticalPattern(id: TacticalPatternId | string): LessonLink[] {
  const pattern = getTacticalPattern(id)
  return pattern ? resolveLessons(pattern.lessonIds) : []
}

/** Lessons that teach the taxonomy entry a detected motif maps to (or none). */
export function lessonsForMotif(id: InsightMotifId): LessonLink[] {
  const target = motifLearnTarget(id)
  if (!target) return []
  return target.kind === "pattern"
    ? lessonsForTacticalPattern(target.id)
    : lessonsForKeyConcept(target.id)
}
