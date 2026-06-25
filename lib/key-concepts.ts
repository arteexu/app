export interface KeyConcept {
  id: string
  title: string
  description: string
  lessonIds: string[]
}

export const KEY_CONCEPTS: KeyConcept[] = [
  {
    id: "kc-the-initiative",
    title: "The initiative",
    description:
      "When you are ahead in development, take the initiative and play fast — even if it means sacrificing pieces. Speed and king safety beat counting pawns.",
    lessonIds: ["l-attacking-italian-trap"],
  },
  {
    id: "kc-calculate-lines",
    title: "Calculate lines",
    description:
      "Strong players calculate whole sequences (lines), not isolated moves. Always ask: where does this lead?",
    lessonIds: ["l-attacking-italian-trap"],
  },
  {
    id: "kc-bring-pieces-attack",
    title: "Bring all pieces into the attack",
    description:
      "Don't attack with just the queen — bring every piece into the assault until the king has nowhere to hide.",
    lessonIds: ["l-attacking-italian-trap", "l-attacking-caro-kann"],
  },
  {
    id: "kc-open-kingside-pawns",
    title: "Open the kingside with pawns",
    description:
      "Open up your opponent's kingside with your pawns to make way for your pieces.",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-consider-opponent-plans",
    title: "Consider your opponent's plans",
    description:
      "In chess, we cannot just consider our own ideas. We must also consider what our opponent intends to do.",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-no-backwards-moves",
    title: "Avoid backwards moves",
    description: "Don't make backwards moves.",
    lessonIds: ["l-attacking-caro-kann"],
  },
  {
    id: "kc-checkmate",
    title: "Checkmate — the goal of chess",
    description:
      "Checkmate ends the game: the king is in check with no legal escape. Every attack should aim toward this.",
    lessonIds: ["l-goal-of-chess"],
  },
  {
    id: "kc-back-rank-mate",
    title: "Back rank mate",
    description:
      "A rook or queen delivers mate on the first or eighth rank while the enemy king is trapped behind its own pawns.",
    lessonIds: ["l-back-rank-mate"],
  },
  {
    id: "kc-board-vision",
    title: "Board vision",
    description:
      "Scan the whole board for checks, captures, and threats — not just the piece you want to move.",
    lessonIds: ["l-board-vision"],
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
