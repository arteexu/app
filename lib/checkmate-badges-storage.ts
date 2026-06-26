import { isCheckmateBadgeId } from "./checkmate-badges"

const STORAGE_KEY = "chessmind-checkmate-badges"

/**
 * Quickest-mate metric: fewest learner moves from puzzle start to checkmate.
 * Endgame drills count only learner plies (play-vs-bot move counter).
 * lesson_attempts has no move count or duration columns, so localStorage mirrors
 * the key-concepts unlock pattern without a schema migration.
 */

export interface CheckmateBadgeRecord {
  earnedAt: string
  quickestMoves: number
}

type BadgeMap = Record<string, CheckmateBadgeRecord>

export interface RecordCheckmateBadgeResult {
  isNew: boolean
  improved: boolean
  record: CheckmateBadgeRecord
}

function readAll(): BadgeMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const map: BadgeMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (
        typeof value === "object" &&
        value !== null &&
        typeof (value as CheckmateBadgeRecord).earnedAt === "string" &&
        typeof (value as CheckmateBadgeRecord).quickestMoves === "number"
      ) {
        map[key] = value as CheckmateBadgeRecord
      }
    }
    return map
  } catch {
    return {}
  }
}

function writeAll(map: BadgeMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function getAllCheckmateBadgeRecords(): BadgeMap {
  return readAll()
}

export function getCheckmateBadgeRecord(badgeId: string): CheckmateBadgeRecord | null {
  return readAll()[badgeId] ?? null
}

export function formatQuickestMoves(moves: number): string {
  return `Quickest: ${moves} move${moves === 1 ? "" : "s"}`
}

/** Persist badge earn or personal-best move count. Returns null for unknown badge ids. */
export function recordCheckmateBadge(
  badgeId: string,
  learnerMoveCount: number,
): RecordCheckmateBadgeResult | null {
  if (!isCheckmateBadgeId(badgeId)) return null
  if (learnerMoveCount < 1) return null

  const map = readAll()
  const existing = map[badgeId]

  if (!existing) {
    const record: CheckmateBadgeRecord = {
      earnedAt: new Date().toISOString(),
      quickestMoves: learnerMoveCount,
    }
    map[badgeId] = record
    writeAll(map)
    return { isNew: true, improved: false, record }
  }

  if (learnerMoveCount < existing.quickestMoves) {
    const record: CheckmateBadgeRecord = {
      earnedAt: existing.earnedAt,
      quickestMoves: learnerMoveCount,
    }
    map[badgeId] = record
    writeAll(map)
    return { isNew: false, improved: true, record }
  }

  return { isNew: false, improved: false, record: existing }
}

/** Count learner-only plies in a puzzle move history (even indices). */
export function countLearnerMoves(moveHistory: string[]): number {
  return moveHistory.filter((_, i) => i % 2 === 0).length
}
