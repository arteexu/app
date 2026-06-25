// lib/solitaire/games.ts
// Typed loader over the curated game database. The JSON is bundled directly
// (small, ~17 games) so both server and client code can read it without a
// round-trip. All selection/filtering helpers live here.

import rawGames from "@/content/solitaire/games.json"
import type { SolitaireGame, Era } from "./types"

const GAMES = rawGames as SolitaireGame[]

// ── Eras (grouping by year) ──────────────────────────────────────────────────
// Chronological order used for display.
export const ERAS: Era[] = ["Classics", "Legend Era", "Engine Era", "Modern"]

/** Short subtitle for each era (the year range it covers). */
export const ERA_SUBTITLE: Record<Era, string> = {
  Classics: "pre-1970",
  "Legend Era": "1970–1999",
  "Engine Era": "2000–2010",
  Modern: "2011+",
}

/**
 * Bucket a game by its year. Boundaries (overlap resolved as specified):
 *   year < 1970        → Classics
 *   1970 ≤ year ≤ 1999 → Legend Era
 *   2000 ≤ year ≤ 2010 → Engine Era
 *   year ≥ 2011        → Modern
 * Undated games (null year) fold into Classics (the oldest bucket).
 */
export function eraForYear(year: number | null): Era {
  if (year == null) return "Classics"
  if (year < 1970) return "Classics"
  if (year <= 1999) return "Legend Era"
  if (year <= 2010) return "Engine Era"
  return "Modern"
}

export interface EraGroup {
  era: Era
  subtitle: string
  games: SolitaireGame[]
}

/** Group games into eras (chronological order), omitting empty eras. */
export function groupByEra(games: SolitaireGame[]): EraGroup[] {
  return ERAS.map((era) => ({
    era,
    subtitle: ERA_SUBTITLE[era],
    games: games.filter((g) => eraForYear(g.year) === era),
  })).filter((group) => group.games.length > 0)
}

export function getAllGames(): SolitaireGame[] {
  return GAMES
}

export function getGame(id: string): SolitaireGame | undefined {
  return GAMES.find((g) => g.id === id)
}

/** True when the game ships with human-authored move annotations. */
export function isAnnotatedGame(game: SolitaireGame): boolean {
  const annotations = game.annotations
  return annotations != null && Object.keys(annotations).length > 0
}

export interface OpeningSummary {
  opening: string
  count: number
  minDifficulty: number
  maxDifficulty: number
}

/** Distinct openings, ordered by how many games they contain (then name). */
export function getOpenings(): OpeningSummary[] {
  const byOpening = new Map<string, SolitaireGame[]>()
  for (const g of GAMES) {
    const list = byOpening.get(g.opening) ?? []
    list.push(g)
    byOpening.set(g.opening, list)
  }
  return [...byOpening.entries()]
    .map(([opening, list]) => ({
      opening,
      count: list.length,
      minDifficulty: Math.min(...list.map((g) => g.difficulty)),
      maxDifficulty: Math.max(...list.map((g) => g.difficulty)),
    }))
    .sort((a, b) => b.count - a.count || a.opening.localeCompare(b.opening))
}

/** Games for an opening, or all games when `opening` is null/undefined. */
export function getGamesByOpening(opening?: string | null): SolitaireGame[] {
  if (!opening) return GAMES
  return GAMES.filter((g) => g.opening === opening)
}

/**
 * Pick a random game, optionally constrained to an opening and excluding a
 * given id (so "New game" / "random" never repeats the current one).
 */
export function pickRandomGame(opening?: string | null, excludeId?: string): SolitaireGame {
  const pool = getGamesByOpening(opening).filter((g) => g.id !== excludeId)
  const source = pool.length > 0 ? pool : getGamesByOpening(opening)
  return source[Math.floor(Math.random() * source.length)]
}
