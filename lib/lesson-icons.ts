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
  "l-how-to-attack": "♞",
  "l-attacking-italian-trap": "♗",
  "l-attacking-caro-kann": "♘",
  "l-tactics-fork": "♞",
  "l-tactics-pin": "♝",
  "l-tactics-skewer": "♜",
  "l-tactics-discovered-attack": "♗",
  "l-tactics-hanging-piece": "♟",
  "l-tactics-deflection": "♛",
  "l-tactics-sacrifice": "⚡",
  "l-tactics-mate-in-1": "♔",
  "l-tactics-mate-in-2": "♚",
  "l-tactics-back-rank-mate": "♖",
}

export function getLessonIcon(lessonId: string): string {
  return LESSON_ICON[lessonId] ?? "♟"
}
