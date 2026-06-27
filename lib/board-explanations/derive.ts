// lib/board-explanations/derive.ts
// Resolves the on-board annotations a step should display. Prefers explicit,
// author-supplied `boardAnnotations`; otherwise derives a mechanical, always-
// correct fallback from data already on the step (the just-played move's
// destination square + the existing prose explanation). Never invents chess
// analysis — the rich per-square experience comes from explicit annotations.

import type { BoardAnnotationKind, BoardSquareAnnotation } from "@/lib/types"
import type { MoveQuality } from "@/lib/move-quality"
import { isValidSquare } from "./geometry"

export interface ResolvedAnnotation extends BoardSquareAnnotation {
  /** Stable id for React keys + popover aria wiring. */
  id: string
  kind: BoardAnnotationKind
  /** True when this came from the fallback path (not authored). */
  derived: boolean
}

/** Map a move-quality marker to an annotation kind (good vs bad family). */
function kindForQuality(quality: MoveQuality | undefined): BoardAnnotationKind {
  switch (quality) {
    case "brilliant":
    case "good":
    case "!!":
    case "!":
      return "good"
    case "dubious":
    case "mistake":
    case "blunder":
    case "?!":
    case "?":
    case "??":
      return "bad"
    default:
      return "good"
  }
}

/** Normalize explicit author annotations into resolved markers (skip bad squares). */
export function resolveExplicitAnnotations(
  annotations: BoardSquareAnnotation[] | undefined,
): ResolvedAnnotation[] {
  if (!annotations?.length) return []
  return annotations
    .filter((a) => isValidSquare(a.square))
    .map((a, i) => ({
      ...a,
      kind: a.kind ?? "info",
      id: `${a.square}-${i}`,
      derived: false,
    }))
}

export interface FallbackOptions {
  /** The move just played, used to anchor the fallback marker. */
  lastMove?: { from: string; to: string } | null
  /** Existing prose explanation to attach to the destination square. */
  explanation?: string
  /** Short headline (e.g. the move SAN). */
  label?: string
  /** Move-quality marker, when known, to color the fallback good/bad. */
  quality?: MoveQuality
  /** Optional concept/pattern links to surface inside the popover. */
  keyConceptId?: string
  tacticalPatternId?: string
}

/**
 * Mechanical fallback: a single marker on the moved piece's destination square
 * carrying the step's existing explanation. Correct and useful with zero
 * authoring. Returns [] when there's nothing reliable to anchor to.
 */
export function deriveFallbackAnnotations(opts: FallbackOptions): ResolvedAnnotation[] {
  const { lastMove, explanation, label, quality, keyConceptId, tacticalPatternId } = opts
  if (!lastMove || !isValidSquare(lastMove.to)) return []
  if (!explanation && !keyConceptId && !tacticalPatternId) return []
  return [
    {
      id: `${lastMove.to}-derived`,
      square: lastMove.to,
      label: label || "Why this move",
      detail: explanation,
      kind: kindForQuality(quality),
      keyConceptId,
      tacticalPatternId,
      derived: true,
    },
  ]
}

/**
 * Resolve the markers to show: explicit annotations win; otherwise fall back.
 * Pass `allowFallback={false}` to suppress the derived marker entirely.
 */
export function resolveBoardAnnotations(
  explicit: BoardSquareAnnotation[] | undefined,
  fallback: FallbackOptions,
  allowFallback = true,
): ResolvedAnnotation[] {
  const resolved = resolveExplicitAnnotations(explicit)
  if (resolved.length > 0) return resolved
  if (!allowFallback) return []
  return deriveFallbackAnnotations(fallback)
}
