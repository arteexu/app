export type TacticalPatternCategoryId = "checkmates" | "forks" | "tactics"

export interface TacticalPatternCategory {
  id: TacticalPatternCategoryId
  title: string
}

export interface TacticalPattern {
  id: string
  title: string
  description: string
  /** Emoji shown next to the pattern once unlocked (distinct per pattern). */
  icon: string
  category: TacticalPatternCategoryId
  lessonIds: string[]
}

export const TACTICAL_PATTERN_CATEGORIES: TacticalPatternCategory[] = [
  { id: "checkmates", title: "Checkmates" },
  { id: "forks", title: "Forks" },
  { id: "tactics", title: "Tactics" },
]

export const TACTICAL_PATTERNS: TacticalPattern[] = [
  {
    id: "tp-back-rank-mate",
    title: "Back Rank Mate",
    description:
      "A rook or queen delivers mate on the first or eighth rank while the enemy king is trapped behind its own pawns.",
    icon: "🏰",
    category: "checkmates",
    lessonIds: ["l-goal-of-chess", "l-back-rank-mate"],
  },
  {
    id: "tp-smoothered-mate",
    title: "Smothered Mate",
    description:
      "A knight delivers checkmate to a king completely hemmed in by its own pieces.",
    icon: "🐴",
    category: "checkmates",
    lessonIds: ["l-goal-of-chess"],
  },
  {
    id: "tp-rook-ladder",
    title: "Ladder Mate",
    description:
      "Two rooks cut off rank after rank, herding a lone king toward the edge until one rook delivers the final checkmate.",
    icon: "🪜",
    category: "checkmates",
    lessonIds: ["l-mating-patterns"],
  },
  {
    id: "tp-arabian-mate",
    title: "Arabian Mate",
    description: "The rook delivers checkmate to the corner.",
    icon: "🕌",
    category: "checkmates",
    lessonIds: ["l-mating-patterns"],
  },
  {
    id: "tp-morphy-mate",
    title: "Morphy's Mate",
    description:
      "A rook checks on the back rank while a bishop covers the diagonal escape, exploiting the weak squares around the king.",
    icon: "🎩",
    category: "checkmates",
    lessonIds: ["l-mating-patterns"],
  },
  {
    id: "tp-swiss-cheese-mate",
    title: "Swiss Cheese Mate",
    description:
      "A queen exploits holes in the pawn structure.",
    icon: "🧀",
    category: "checkmates",
    lessonIds: ["l-mating-patterns"],
  },
  {
    id: "tp-fork",
    title: "Fork",
    description:
      "One piece attacks two enemy pieces at once, forcing your opponent to lose material.",
    icon: "🍴",
    category: "forks",
    lessonIds: ["l-attacking-italian-trap"],
  },
  {
    id: "tp-intermezzo-move",
    title: "Intermezzo Move",
    description:
      "Instead of recapturing or playing the obvious reply, insert an in-between move — a check, threat, or attack — that improves the outcome before returning to the main line.",
    icon: "⏸️",
    category: "tactics",
    lessonIds: ["l-how-to-attack"],
  },
  {
    id: "tp-clearance",
    title: "Clearance",
    description:
      "Move a piece off a line or square so another piece can use it — here the bishop steps aside so the queen can slide to f7 and deliver mate.",
    icon: "🧹",
    category: "tactics",
    lessonIds: ["l-attacking-italian-trap"],
  },
  {
    id: "tp-taking-with-check",
    title: "Taking With Check",
    description:
      "Capture a piece and deliver check at the same time — your opponent must answer the check before recapturing.",
    icon: "✅",
    category: "tactics",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "tp-danger-levels",
    title: "Danger Levels",
    description:
      "Capture or attack a higher-value target even though your piece is under threat — trading up in danger because the prize is worth more than what you might lose.",
    icon: "☠️",
    category: "tactics",
    lessonIds: ["l-attacking-caro-kann"],
  },
]

const PATTERN_BY_ID = new Map(TACTICAL_PATTERNS.map((p) => [p.id, p]))

export function getTacticalPattern(id: string): TacticalPattern | undefined {
  return PATTERN_BY_ID.get(id)
}

export function getTacticalPatternCategory(
  id: TacticalPatternCategoryId,
): TacticalPatternCategory | undefined {
  return TACTICAL_PATTERN_CATEGORIES.find((c) => c.id === id)
}

export function getPatternsForLesson(lessonId: string): TacticalPattern[] {
  return TACTICAL_PATTERNS.filter((p) => p.lessonIds.includes(lessonId))
}

export function getPatternsByCategory(category: TacticalPatternCategoryId): TacticalPattern[] {
  return TACTICAL_PATTERNS.filter((p) => p.category === category)
}

export function getTacticalPatternsForCourse(lessonIds: string[]): TacticalPattern[] {
  const set = new Set(lessonIds)
  return TACTICAL_PATTERNS.filter((p) => p.lessonIds.some((id) => set.has(id)))
}

/**
 * Literal union of every Tactical Pattern id, derived additively as an
 * `as const` tuple. Separate from the mutable `TACTICAL_PATTERNS` array so
 * existing `getTacticalPattern(id: string)` usage is unaffected. Keep in sync
 * with TACTICAL_PATTERNS.
 */
export const TACTICAL_PATTERN_IDS = [
  "tp-back-rank-mate",
  "tp-smoothered-mate",
  "tp-rook-ladder",
  "tp-arabian-mate",
  "tp-morphy-mate",
  "tp-swiss-cheese-mate",
  "tp-fork",
  "tp-intermezzo-move",
  "tp-clearance",
  "tp-taking-with-check",
  "tp-danger-levels",
] as const

export type TacticalPatternId = (typeof TACTICAL_PATTERN_IDS)[number]
