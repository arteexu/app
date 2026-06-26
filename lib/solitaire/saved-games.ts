// lib/solitaire/saved-games.ts
// SSR-safe localStorage persistence for user-saved, engine-generated Solitaire
// games so they can be replayed later. Stores the FULL SolitaireGame (including
// isGenerated, startFen, and the move list) plus the chosen solve side, so a
// saved game replays exactly as generated. Never throws; degrades to in-memory
// no-ops when window/localStorage is unavailable.

import type { Side, SolitaireGame } from "./types"
import { resolveOpeningLabel } from "./detect-opening"

const STORAGE_KEY = "chessmind-solitaire-saved-games"

export interface SavedSolitaireGame {
  /** Unique id for this saved entry (distinct from the game's own id). */
  id: string
  /** User-facing display name. */
  name: string
  /** The side the user solves as when replaying. */
  side: Side
  /** ISO timestamp of when it was saved. */
  savedAt: string
  /** The full game, preserved verbatim for exact replay. */
  game: SolitaireGame
}

function readAll(): SavedSolitaireGame[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedSolitaireGame[]) : []
  } catch {
    return []
  }
}

function writeAll(list: SavedSolitaireGame[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function makeId(): string {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** All saved games, newest first. */
export function listSavedGames(): SavedSolitaireGame[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getSavedGame(id: string): SavedSolitaireGame | null {
  return readAll().find((g) => g.id === id) ?? null
}

/**
 * Persist a generated game under a display name + solve side. Returns the new
 * saved entry (with its generated id + savedAt). Newest entries sort first.
 */
export function saveGame(input: { game: SolitaireGame; side: Side; name: string }): SavedSolitaireGame {
  const opening = resolveOpeningLabel(input.game)
  const game =
    opening !== input.game.opening ? { ...input.game, opening } : input.game
  const entry: SavedSolitaireGame = {
    id: makeId(),
    name: input.name.trim() || input.game.title,
    side: input.side,
    savedAt: new Date().toISOString(),
    game,
  }
  const list = readAll()
  list.push(entry)
  writeAll(list)
  return entry
}

/** Remove a saved game by id. Returns the remaining list (newest first). */
export function deleteSavedGame(id: string): SavedSolitaireGame[] {
  const next = readAll().filter((g) => g.id !== id)
  writeAll(next)
  return next.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}
