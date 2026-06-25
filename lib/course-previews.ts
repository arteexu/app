// lib/course-previews.ts — hand-curated dashboard previews for each course.
// Each card carries a custom chess emblem (see components/ui/course-icons.tsx)
// that captures the course's identity, painted in the course's accent color.

import type { CourseIconName } from "@/components/ui/course-icons"

export interface CoursePreview {
  /** Course id — must match a course in lib/courses.ts */
  id: string
  /** Display label shown on the card (may differ from the stored course title). */
  displayLabel: string
  /** Small character/order eyebrow, e.g. "Start here". */
  eyebrow: string
  /** One plain sentence: what the learner will actually do. */
  tagline: string
  /** Short, honest topic chips pulled from the course's chapters. */
  topics: string[]
  /** Accent color (hex) — used sparingly for the eyebrow, emblem, and progress. */
  accent: string
  /**
   * Emblem icon for the card. Unknown/missing keys fall back to a neutral pawn,
   * so a newly added course always has an emblem.
   */
  icon: CourseIconName
}

export const COURSE_PREVIEWS: CoursePreview[] = [
  {
    id: "chess-attack-and-checkmate",
    displayLabel: "Checkmating",
    eyebrow: "Start here",
    tagline:
      "Learn to see the mate before it lands — checkmate patterns, mating nets, and the board vision to spot them.",
    topics: ["Fundamentals", "Mating patterns", "Back-rank & smothered", "King hunts", "Board vision"],
    accent: "#b23a2e",
    // The finishing blow — a king toppled, the universal sign of mate.
    icon: "fallen-king",
  },
  {
    id: "attacking-chess",
    displayLabel: "Attacking Chess",
    eyebrow: "Go deeper",
    tagline:
      "Play through a real attacking game — calculate full lines, sacrifice for the initiative, and convert the assault.",
    topics: ["Italian Game", "Sacrifice", "Calculate lines", "Initiative"],
    accent: "#c47b1a",
    // The assault — a knight charging into the attack.
    icon: "charging-knight",
  },
]

export function getCoursePreview(id: string): CoursePreview | undefined {
  return COURSE_PREVIEWS.find((p) => p.id === id)
}
