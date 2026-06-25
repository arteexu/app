// lib/solitaire/storage.ts
// SSR-safe localStorage persistence for Solitaire Chess scores. Keeps the best
// and most-recent result per (game, side). Never throws; degrades to in-memory
// no-ops when window/localStorage is unavailable.

import type { Side } from "./types"

const STORAGE_KEY = "chessmind-solitaire-scores"

export interface StoredScore {
  gameId: string
  side: Side
  score: number
  accuracy: number
  matchRate: number
  matched: number
  totalMoves: number
  bestStreak: number
  difficulty: number
  stars: number
  playedAt: string // ISO
}

export interface GameScoreRecord {
  best: StoredScore
  last: StoredScore
  plays: number
}

type ScoreMap = Record<string, GameScoreRecord>

function recordKey(gameId: string, side: Side): string {
  return `${gameId}:${side}`
}

function readAll(): ScoreMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as ScoreMap) : {}
  } catch {
    return {}
  }
}

function writeAll(map: ScoreMap): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function getAllScoreRecords(): ScoreMap {
  return readAll()
}

export function getScoreRecord(gameId: string, side: Side): GameScoreRecord | null {
  return readAll()[recordKey(gameId, side)] ?? null
}

/** Save a result, updating best (higher score wins) and last. Returns the record. */
export function saveScore(score: StoredScore): GameScoreRecord {
  const map = readAll()
  const key = recordKey(score.gameId, score.side)
  const existing = map[key]
  const record: GameScoreRecord = {
    last: score,
    best: existing && existing.best.score >= score.score ? existing.best : score,
    plays: (existing?.plays ?? 0) + 1,
  }
  map[key] = record
  writeAll(map)
  return record
}
