// lib/board-explanations/visual-hints.ts
// Converts author-supplied per-marker visual hints into react-chessboard props.
// Only explicit `arrows` / `highlightSquares` on an annotation are used —
// never inferred from chess.js or prose parsing.

import type { Arrow } from "react-chessboard"
import type { BoardSquareAnnotation } from "@/lib/types"
import { isValidSquare } from "./geometry"

export interface AnnotationVisualHints {
  squareStyles: Record<string, React.CSSProperties>
  arrows: Arrow[]
}

/** Target squares get a clear red tint; distinct from last-move amber and selection yellow. */
const MARKER_TARGET_HIGHLIGHT = "rgba(239, 68, 68, 0.42)"

export function annotationHasExplicitVisualHints(
  annotation: Pick<BoardSquareAnnotation, "arrows" | "highlightSquares">,
): boolean {
  return (annotation.arrows?.length ?? 0) > 0 || (annotation.highlightSquares?.length ?? 0) > 0
}

/** Returns board overlays for an active marker, or null when nothing was authored. */
export function annotationVisualHintsToProps(
  annotation: BoardSquareAnnotation | null | undefined,
): AnnotationVisualHints | null {
  if (!annotation || !annotationHasExplicitVisualHints(annotation)) return null

  const squareStyles: Record<string, React.CSSProperties> = {}
  for (const sq of annotation.highlightSquares ?? []) {
    if (isValidSquare(sq)) {
      squareStyles[sq] = { backgroundColor: MARKER_TARGET_HIGHLIGHT }
    }
  }

  const arrows: Arrow[] = (annotation.arrows ?? [])
    .filter((a) => isValidSquare(a.from) && isValidSquare(a.to))
    .map((a) => ({
      startSquare: a.from,
      endSquare: a.to,
      color: a.color ?? "#ef4444",
    }))

  if (Object.keys(squareStyles).length === 0 && arrows.length === 0) return null
  return { squareStyles, arrows }
}
