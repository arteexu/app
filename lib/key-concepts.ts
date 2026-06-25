export interface KeyConcept {
  id: string
  title: string
  description: string
  lessonIds: string[]
}

export const KEY_CONCEPTS: KeyConcept[] = [
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
    id: "kc-bring-pieces-attack",
    title: "Bring more pieces into the attack",
    description: "Bring more pieces into the attack.",
    lessonIds: ["l-attacking-caro-kann"],
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
