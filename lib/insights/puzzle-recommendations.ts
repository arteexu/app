// lib/insights/puzzle-recommendations.ts
// Reverse-index from taxonomy ids (and detection motifs) → tagged puzzles.
//
// Part 1 (scripts/tag-puzzles.mjs) wrote `keyConcepts` / `tacticalPatterns`
// tags onto every PuzzleStep. This module flips that mapping so the post-game
// insights surfaces can answer "the player struggled with X — which puzzles
// train X?" and deep-link the learner straight into that puzzle.
//
// The index is built once at module load from the in-memory course data
// (getAllCourses) and is purely additive: untagged puzzles never appear.

import { getAllCourses, getCourseLessons } from "@/lib/courses"
import type { Course, Lesson, PuzzleStep } from "@/lib/types"
import { getKeyConcept, type KeyConceptId } from "@/lib/key-concepts"
import { getTacticalPattern, type TacticalPatternId } from "@/lib/tactical-patterns"
import {
  motifLearnTarget,
  lessonsForKeyConcept,
  lessonsForTacticalPattern,
  type LessonLink,
} from "./learn-links"
import type { InsightMotifId } from "./motifs"

/** A puzzle the learner can be deep-linked into to practice a concept/pattern. */
export interface PuzzleRecommendation {
  courseId: string
  courseTitle: string
  lessonId: string
  lessonTitle: string
  stepId: string
  /** The puzzle prompt, e.g. "White to move. Win material with a fork." */
  question: string
  fen: string
  orientation: "white" | "black"
  /** Deep link that opens the lesson on this exact puzzle step. */
  href: string
}

/** A detected concept/pattern paired with puzzles that train it. */
export interface PuzzleRecommendationGroup {
  kind: "concept" | "pattern"
  id: KeyConceptId | TacticalPatternId
  title: string
  icon: string
  /** Link to the gamified browser entry (existing "Learn ↗" destination). */
  learnHref: string
  puzzles: PuzzleRecommendation[]
}

/** Deep link that opens a lesson scrolled/advanced to a specific step. */
export function lessonStepHref(lessonId: string, stepId: string): string {
  return `/lessons/${encodeURIComponent(lessonId)}?step=${encodeURIComponent(stepId)}`
}

// ── Build the reverse index once ────────────────────────────────────────────

const byKeyConcept = new Map<string, PuzzleRecommendation[]>()
const byTacticalPattern = new Map<string, PuzzleRecommendation[]>()

function pushTag(map: Map<string, PuzzleRecommendation[]>, id: string, rec: PuzzleRecommendation) {
  const list = map.get(id)
  if (list) list.push(rec)
  else map.set(id, [rec])
}

function indexLesson(course: Course, lesson: Lesson) {
  for (const step of lesson.steps) {
    if (step.type !== "puzzle") continue
    const puzzle = step as PuzzleStep
    const hasTags =
      (puzzle.keyConcepts?.length ?? 0) > 0 || (puzzle.tacticalPatterns?.length ?? 0) > 0
    if (!hasTags) continue

    const rec: PuzzleRecommendation = {
      courseId: course.id,
      courseTitle: course.title,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      stepId: puzzle.id,
      question: puzzle.question,
      fen: puzzle.fen,
      orientation: puzzle.orientation ?? "white",
      href: lessonStepHref(lesson.id, puzzle.id),
    }

    for (const id of puzzle.keyConcepts ?? []) pushTag(byKeyConcept, id, rec)
    for (const id of puzzle.tacticalPatterns ?? []) pushTag(byTacticalPattern, id, rec)
  }
}

for (const course of getAllCourses()) {
  for (const lesson of getCourseLessons(course)) {
    indexLesson(course, lesson)
  }
}

// ── Lookups ─────────────────────────────────────────────────────────────────

/** Default number of puzzles surfaced per concept/pattern. */
export const DEFAULT_PUZZLES_PER_GROUP = 4

export function puzzlesForKeyConcept(id: string, limit = DEFAULT_PUZZLES_PER_GROUP): PuzzleRecommendation[] {
  return (byKeyConcept.get(id) ?? []).slice(0, limit)
}

export function puzzlesForTacticalPattern(id: string, limit = DEFAULT_PUZZLES_PER_GROUP): PuzzleRecommendation[] {
  return (byTacticalPattern.get(id) ?? []).slice(0, limit)
}

export function hasPuzzlesForKeyConcept(id: string): boolean {
  return (byKeyConcept.get(id)?.length ?? 0) > 0
}

export function hasPuzzlesForTacticalPattern(id: string): boolean {
  return (byTacticalPattern.get(id)?.length ?? 0) > 0
}

interface InsightTagInput {
  keyConceptIds?: readonly string[]
  tacticalPatternIds?: readonly string[]
  motifIds?: readonly InsightMotifId[]
}

/**
 * Build deduped "Recommended puzzles" groups for a set of detected insights.
 * Tactical patterns and key concepts map directly; detection motifs are routed
 * through the existing learn-links mapping. Each taxonomy target appears at
 * most once, and only groups with at least one matching puzzle are returned.
 */
export function recommendPuzzlesForInsights(
  input: InsightTagInput,
  limitPerGroup = DEFAULT_PUZZLES_PER_GROUP,
): PuzzleRecommendationGroup[] {
  // Collect unique taxonomy targets in a stable order: patterns first
  // (most actionable for tactics drills), then concepts.
  const patternIds: string[] = []
  const conceptIds: string[] = []
  const seenPattern = new Set<string>()
  const seenConcept = new Set<string>()

  const addPattern = (id: string) => {
    if (!seenPattern.has(id)) { seenPattern.add(id); patternIds.push(id) }
  }
  const addConcept = (id: string) => {
    if (!seenConcept.has(id)) { seenConcept.add(id); conceptIds.push(id) }
  }

  for (const id of input.tacticalPatternIds ?? []) addPattern(id)
  for (const id of input.keyConceptIds ?? []) addConcept(id)
  for (const id of input.motifIds ?? []) {
    const target = motifLearnTarget(id)
    if (!target) continue
    if (target.kind === "pattern") addPattern(target.id)
    else addConcept(target.id)
  }

  const groups: PuzzleRecommendationGroup[] = []

  for (const id of patternIds) {
    const puzzles = puzzlesForTacticalPattern(id, limitPerGroup)
    if (puzzles.length === 0) continue
    const pattern = getTacticalPattern(id)
    if (!pattern) continue
    groups.push({
      kind: "pattern",
      id: id as TacticalPatternId,
      title: pattern.title,
      icon: pattern.icon,
      learnHref: `/tactical-patterns?pattern=${encodeURIComponent(id)}`,
      puzzles,
    })
  }

  for (const id of conceptIds) {
    const puzzles = puzzlesForKeyConcept(id, limitPerGroup)
    if (puzzles.length === 0) continue
    const concept = getKeyConcept(id)
    if (!concept) continue
    groups.push({
      kind: "concept",
      id: id as KeyConceptId,
      title: concept.title,
      icon: concept.icon,
      learnHref: `/key-concepts?concept=${encodeURIComponent(id)}`,
      puzzles,
    })
  }

  return groups
}

// ── Study plan: lessons ("Learn") + puzzles ("Practice") per detected target ──
// Richer than recommendPuzzlesForInsights: each group carries BOTH the lessons
// that teach the concept/pattern and the puzzles that drill it. A group is kept
// when it has at least one lesson OR one puzzle, so detected ideas that only have
// lessons (no tagged puzzles yet) still route the learner somewhere useful.

export interface StudyRecommendationGroup {
  kind: "concept" | "pattern"
  id: KeyConceptId | TacticalPatternId
  title: string
  icon: string
  /** Link to the gamified browser entry (the tag page). */
  learnHref: string
  /** Lessons that teach this concept/pattern (validated, may be empty). */
  lessons: LessonLink[]
  /** Tagged puzzles that drill this concept/pattern (may be empty). */
  puzzles: PuzzleRecommendation[]
}

/** Default number of lessons surfaced per concept/pattern. */
export const DEFAULT_LESSONS_PER_GROUP = 2

export function recommendStudyForInsights(
  input: InsightTagInput,
  limitPuzzlesPerGroup = DEFAULT_PUZZLES_PER_GROUP,
  limitLessonsPerGroup = DEFAULT_LESSONS_PER_GROUP,
): StudyRecommendationGroup[] {
  const patternIds: string[] = []
  const conceptIds: string[] = []
  const seenPattern = new Set<string>()
  const seenConcept = new Set<string>()

  const addPattern = (id: string) => {
    if (!seenPattern.has(id)) { seenPattern.add(id); patternIds.push(id) }
  }
  const addConcept = (id: string) => {
    if (!seenConcept.has(id)) { seenConcept.add(id); conceptIds.push(id) }
  }

  for (const id of input.tacticalPatternIds ?? []) addPattern(id)
  for (const id of input.keyConceptIds ?? []) addConcept(id)
  for (const id of input.motifIds ?? []) {
    const target = motifLearnTarget(id)
    if (!target) continue
    if (target.kind === "pattern") addPattern(target.id)
    else addConcept(target.id)
  }

  const groups: StudyRecommendationGroup[] = []

  for (const id of patternIds) {
    const pattern = getTacticalPattern(id)
    if (!pattern) continue
    const lessons = lessonsForTacticalPattern(id).slice(0, limitLessonsPerGroup)
    const puzzles = puzzlesForTacticalPattern(id, limitPuzzlesPerGroup)
    if (lessons.length === 0 && puzzles.length === 0) continue
    groups.push({
      kind: "pattern",
      id: id as TacticalPatternId,
      title: pattern.title,
      icon: pattern.icon,
      learnHref: `/tactical-patterns?pattern=${encodeURIComponent(id)}`,
      lessons,
      puzzles,
    })
  }

  for (const id of conceptIds) {
    const concept = getKeyConcept(id)
    if (!concept) continue
    const lessons = lessonsForKeyConcept(id).slice(0, limitLessonsPerGroup)
    const puzzles = puzzlesForKeyConcept(id, limitPuzzlesPerGroup)
    if (lessons.length === 0 && puzzles.length === 0) continue
    groups.push({
      kind: "concept",
      id: id as KeyConceptId,
      title: concept.title,
      icon: concept.icon,
      learnHref: `/key-concepts?concept=${encodeURIComponent(id)}`,
      lessons,
      puzzles,
    })
  }

  return groups
}
