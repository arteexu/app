export interface KeyConcept {
  id: string
  title: string
  description: string
  /** Emoji shown next to the concept once unlocked (distinct per concept). */
  icon: string
  lessonIds: string[]
}

export const KEY_CONCEPTS: KeyConcept[] = [
  {
    id: "kc-the-initiative",
    title: "The Initiative",
    description:
      "When you are ahead in development, take the initiative and play fast — even if it means sacrificing pieces. Speed and king safety beat counting pawns.",
    icon: "🏇",
    lessonIds: ["l-attacking-italian-trap"],
  },
  {
    id: "kc-bring-pieces-attack",
    title: "Bring All Pieces Into The Attack",
    description:
      "Don't attack with just the queen — bring every piece into the assault until the king has nowhere to hide.",
    icon: "⚔️",
    lessonIds: ["l-attacking-italian-trap", "l-attacking-caro-kann"],
  },
  {
    id: "kc-open-kingside-pawns",
    title: "Open The Enemy King With Pawns",
    description:
      "Open up your opponent's kingside with your pawns to make way for your pieces.",
    icon: "🪓",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-consider-opponent-plans",
    title: "Consider Your Opponent's Plans",
    description:
      "In chess, we cannot just consider our own ideas. We must also consider what our opponent intends to do.",
    icon: "🔮",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-no-backwards-moves",
    title: "Avoid Backwards Moves",
    description: "We typically want to avoid backwards move, especially in attacking contexts. These are often only reserved for maneuvers and positional ideas.",
    icon: "🚫",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-checkmate",
    title: "Checkmate",
    description:
      "Checkmate ends the game: the king is in check with no legal escape. This is the final goal of chess.",
    icon: "🏁",
    lessonIds: ["l-goal-of-chess"],
  },
  {
    id: "kc-back-rank-mate",
    title: "Back Rank Mate",
    description:
      "A rook or queen delivers mate on the first or eighth rank while the enemy king is trapped behind its own pawns.",
    icon: "🏰",
    lessonIds: ["l-goal-of-chess", "l-back-rank-mate"],
  },
  {
    id: "kc-see-the-whole-board",
    title: "See The Whole Board",
    description:
      "Don't fixate on one area — scan the entire board for checks, captures, and threats that can swing the game from far away.",
    icon: "👁️",
    lessonIds: ["l-how-to-attack", "l-find-checkmates"],
  },
  {
    id: "kc-candidate-moves",
    title: "Candidate Moves",
    description:
      "In every position, list the moves worth considering — from threats and your own ideas to prophylaxis — then weigh them before you commit.",
    icon: "📋",
    lessonIds: ["l-advanced-tactics"],
  },
  {
    id: "kc-premature-attacking",
    title: "Premature Attacking",
    description:
      "Don't launch an attack before enough pieces are in place. Committal attacking moves without support waste time and let your opponent catch up.",
    icon: "⚠️",
    lessonIds: ["l-how-to-attack"],
  },
  {
    id: "kc-calculate-deeper",
    title: "Deep Calculation",
    description:
      "Deep Calculation means seeing the whole forcing sequence, not just the first shot. If you only see Ng5, you miss Nxf7.",
    icon: "🤿",
    lessonIds: ["l-how-to-attack"],
  },
  {
    id: "kc-calculate-all-relevant-lines",
    title: "Calculate All Relevant Lines",
    description:
      "When you play a forcing move, calculate every serious reply your opponent can make — not just the line you hope they'll play. Strong players see whole sequences through to a winning position, not isolated moves.",
    icon: "🌳",
    lessonIds: ["l-how-to-attack", "l-attacking-italian-trap"],
  },
]

const KEY_CONCEPT_BY_ID = new Map(KEY_CONCEPTS.map((c) => [c.id, c]))

export function getKeyConcept(id: string): KeyConcept | undefined {
  return KEY_CONCEPT_BY_ID.get(id)
}

export function getKeyConceptsForLesson(lessonId: string): KeyConcept[] {
  return KEY_CONCEPTS.filter((c) => c.lessonIds.includes(lessonId))
}

export function getKeyConceptsForCourse(lessonIds: string[]): KeyConcept[] {
  const set = new Set(lessonIds)
  return KEY_CONCEPTS.filter((c) => c.lessonIds.some((id) => set.has(id)))
}

/** Match "KEY CONCEPT: ..." or "KEY CONCEPT ..." in annotation text (authoring aid). */
export function extractKeyConceptText(text: string): string | null {
  const match = text.match(/key concept:?\s*(.+?)(?:\.\s*$|$)/i)
  return match?.[1]?.trim() ?? null
}

/**
 * Literal union of every Key Concept id, derived additively as an `as const`
 * tuple. This is intentionally a separate declaration so the mutable
 * `KEY_CONCEPTS: KeyConcept[]` typing above (and `getKeyConcept(id: string)`)
 * keep working unchanged, while consumers like the commentary layer get a real
 * literal union. Keep this list in sync with KEY_CONCEPTS.
 */
export const KEY_CONCEPT_IDS = [
  "kc-the-initiative",
  "kc-bring-pieces-attack",
  "kc-open-kingside-pawns",
  "kc-consider-opponent-plans",
  "kc-no-backwards-moves",
  "kc-checkmate",
  "kc-back-rank-mate",
  "kc-see-the-whole-board",
  "kc-candidate-moves",
  "kc-premature-attacking",
  "kc-calculate-deeper",
  "kc-calculate-all-relevant-lines",
] as const

export type KeyConceptId = (typeof KEY_CONCEPT_IDS)[number]
