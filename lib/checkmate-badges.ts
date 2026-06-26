/** Badge for delivering checkmate in a lone King + piece vs King endgame drill. */
export interface CheckmateBadgeDefinition {
  id: string
  /** Piece or combo that delivers the mate, shown after "King +". */
  matingPiece: string
  emoji: string
  lessonId: string
  stepId: string
  subtitle: string
}

export const CHECKMATE_BADGES: CheckmateBadgeDefinition[] = [
  {
    id: "cb-king-queen-mate",
    matingPiece: "Queen",
    emoji: "👑",
    lessonId: "l-queen-king-mate",
    stepId: "s-qk-playvbot1",
    subtitle: "King + Queen vs lone King endgame",
  },
  {
    id: "cb-king-rook-mate",
    matingPiece: "Rook",
    emoji: "🛡️",
    lessonId: "l-rook-king-mate",
    stepId: "s-rk-playvbot1",
    subtitle: "King + Rook vs lone King endgame",
  },
]

const BADGE_BY_ID = new Map(CHECKMATE_BADGES.map((b) => [b.id, b]))
const BADGE_BY_STEP = new Map(CHECKMATE_BADGES.map((b) => [b.stepId, b]))

export function getCheckmateBadgeTitle(def: CheckmateBadgeDefinition): string {
  return `Checkmate with a King + ${def.matingPiece}`
}

export function getCheckmateBadge(badgeId: string): CheckmateBadgeDefinition | undefined {
  return BADGE_BY_ID.get(badgeId)
}

export function isCheckmateBadgeId(badgeId: string): boolean {
  return BADGE_BY_ID.has(badgeId)
}

export function getCheckmateBadgeForStep(stepId: string): CheckmateBadgeDefinition | undefined {
  return BADGE_BY_STEP.get(stepId)
}

export function getAllCheckmateBadgeIds(): string[] {
  return CHECKMATE_BADGES.map((b) => b.id)
}
