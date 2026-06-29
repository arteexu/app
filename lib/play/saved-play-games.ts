// lib/play/saved-play-games.ts
// SSR-safe localStorage persistence for completed Play games (vs Bot and vs Human).
// Mirrors the Solitaire saved-games CRUD style. Stores the full move list + metadata
// so games can be replayed and analyzed later. Never throws.

import { movesToPgn, START_FEN } from "./game"
import type { GameResult, PieceColor, PlayedMove } from "./types"

const STORAGE_KEY = "chessmind-play-saved-games"

export type PlayOpponentType = "bot" | "human"

export interface SavedPlayGame {
  id: string
  name: string
  savedAt: string
  opponentType: PlayOpponentType
  /** e.g. "Bot · Intermediate" or the live opponent's display name. */
  opponentLabel: string
  botLevelId?: string
  timeControlId: string
  userColor: PieceColor
  result: GameResult
  moves: PlayedMove[]
  pgn: string
  /** Set when saved from a live Supabase game (already persisted server-side). */
  supabaseGameId?: string
}

export type SavePlayGameInput = Omit<SavedPlayGame, "id" | "savedAt" | "pgn"> & {
  name: string
  pgn?: string
}

function readAll(): SavedPlayGame[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedPlayGame[]) : []
  } catch {
    return []
  }
}

function writeAll(list: SavedPlayGame[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota / privacy mode */
  }
}

function makeId(): string {
  return `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function listSavedPlayGames(): SavedPlayGame[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getSavedPlayGame(id: string): SavedPlayGame | null {
  return readAll().find((g) => g.id === id) ?? null
}

export function savePlayGame(input: SavePlayGameInput): SavedPlayGame {
  const entry: SavedPlayGame = {
    id: makeId(),
    name: input.name.trim() || defaultPlayGameName(input),
    savedAt: new Date().toISOString(),
    opponentType: input.opponentType,
    opponentLabel: input.opponentLabel,
    botLevelId: input.botLevelId,
    timeControlId: input.timeControlId,
    userColor: input.userColor,
    result: input.result,
    moves: input.moves,
    pgn: input.pgn ?? movesToPgn(input.moves),
    supabaseGameId: input.supabaseGameId,
  }
  const list = readAll()
  list.push(entry)
  writeAll(list)
  return entry
}

export function renameSavedPlayGame(id: string, name: string): SavedPlayGame[] {
  const trimmed = name.trim()
  const next = readAll().map((g) =>
    g.id === id ? { ...g, name: trimmed || g.name } : g,
  )
  writeAll(next)
  return next.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function deleteSavedPlayGame(id: string): SavedPlayGame[] {
  const next = readAll().filter((g) => g.id !== id)
  writeAll(next)
  return next.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/**
 * FEN before ply `ply` (0 = starting position). `startFen` lets uploaded games
 * that begin from a custom position resolve ply 0 correctly (defaults to the
 * standard initial position).
 */
export function fenBeforePly(moves: PlayedMove[], ply: number, startFen: string = START_FEN): string {
  if (ply <= 0) return startFen
  return moves[ply - 1]?.fenAfter ?? startFen
}

export function defaultPlayGameName(input: {
  opponentType: PlayOpponentType
  opponentLabel: string
  timeControlId: string
}): string {
  const vs = input.opponentType === "bot" ? "vs Bot" : `vs ${input.opponentLabel}`
  return `${vs} · ${input.timeControlId}`
}
