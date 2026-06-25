/** Chess-themed emoji per lesson — shown on the quest path for every state (including complete). */
export const LESSON_ICON: Record<string, string> = {
  "l-goal-of-chess":    "♚",
  "l-back-rank-mate":   "♜",
  "l-mating-patterns":  "♕",
  "l-queen-king-mate":  "♛",
  "l-rook-king-mate":   "♖",
  "l-board-vision":     "♞",
  "l-find-checkmates":  "🎯",
  "l-scholars-mate":    "⚡",
  "l-advanced-tactics": "♗",
}

export function getLessonIcon(lessonId: string): string {
  return LESSON_ICON[lessonId] ?? "♟"
}
