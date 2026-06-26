// lib/multiplayer/engine-games.ts
// The shared pool of games for Multiplayer Mode. Source of truth is the Supabase
// `engine_games` table (so generated games can be shared across users), but the
// bundled curated games.json is ALWAYS merged in as a fallback. Because curated
// games have stable ids identical for every user, two players can compete on the
// same game and have comparable scores even before the seed migration is applied
// (or if the backend is unavailable). Never throws — degrades to curated-only.

import { createClient } from "@/lib/supabase/client"
import { getAllGames } from "@/lib/solitaire/games"
import { resolveOpeningLabel } from "@/lib/solitaire/detect-opening"
import { playableSide } from "@/lib/solitaire/engine"
import type { SolitaireGame, GameResult } from "@/lib/solitaire/types"
import type { SharedGame } from "./types"

interface EngineGameRow {
  id: string
  title: string
  opening: string | null
  eco: string | null
  white: string | null
  black: string | null
  event: string | null
  year: number | null
  result: string
  difficulty: number | null
  start_fen: string | null
  max_start_move: number | null
  moves: unknown
  is_generated: boolean | null
  source: string | null
  created_at: string | null
}

function looksLikeMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  )
}

function normalizeResult(result: string): GameResult {
  return result === "1-0" || result === "0-1" || result === "1/2-1/2" ? result : "1-0"
}

/** Convert a DB row into a fully playable SolitaireGame. */
function rowToGame(row: EngineGameRow): SolitaireGame | null {
  const moves = Array.isArray(row.moves) ? (row.moves as string[]) : null
  if (!moves || moves.length === 0) return null
  return {
    id: row.id,
    title: row.title || "Engine game",
    opening: row.opening || "Unknown",
    eco: row.eco || "",
    white: row.white || "White",
    black: row.black || "Black",
    event: row.event ?? null,
    year: row.year ?? null,
    result: normalizeResult(row.result),
    difficulty: row.difficulty ?? 3,
    maxStartMove: row.max_start_move ?? undefined,
    startFen: row.start_fen ?? undefined,
    isGenerated: row.is_generated ?? row.source === "generated",
    note:
      row.source === "generated"
        ? "An engine self-play game shared to the multiplayer pool."
        : "A curated master game in the shared multiplayer pool.",
    moves,
  }
}

function toSharedGame(game: SolitaireGame, source: "curated" | "generated", createdAt: string | null): SharedGame {
  return { game, source, side: playableSide(game), createdAt }
}

/** The curated games, as shared-pool entries (always available, stable ids). */
function curatedPool(): SharedGame[] {
  return getAllGames().map((g) => toSharedGame(g, "curated", null))
}

/**
 * Fetch the shared pool: curated games merged with any rows from `engine_games`.
 * DB rows win on id collisions (so a curated game seeded into the table uses its
 * stored copy). Generated games sort first (newest), then curated.
 */
export async function fetchSharedPool(): Promise<SharedGame[]> {
  const curated = curatedPool()
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("engine_games")
      .select(
        "id, title, opening, eco, white, black, event, year, result, difficulty, start_fen, max_start_move, moves, is_generated, source, created_at",
      )
      .order("created_at", { ascending: false })

    if (error || !data) {
      if (error && !looksLikeMissingTable(error)) {
        // Real error (not just a missing table) — still degrade to curated.
      }
      return curated
    }

    const byId = new Map<string, SharedGame>()
    // Seed with curated so any curated game absent from the DB still appears.
    for (const s of curated) byId.set(s.game.id, s)
    // Overlay DB rows (DB copy wins on id collisions).
    for (const row of data as EngineGameRow[]) {
      const game = rowToGame(row)
      if (!game) continue
      const source = (row.source === "generated" ? "generated" : "curated") as "curated" | "generated"
      byId.set(game.id, toSharedGame(game, source, row.created_at))
    }

    const all = [...byId.values()]
    // Generated (with timestamps) first/newest, then curated alphabetically.
    all.sort((a, b) => {
      if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt)
      if (a.createdAt) return -1
      if (b.createdAt) return 1
      return a.game.title.localeCompare(b.game.title)
    })
    return all
  } catch {
    return curated
  }
}

const ENGINE_GAME_COLUMNS =
  "id, title, opening, eco, white, black, event, year, result, difficulty, start_fen, max_start_move, moves, is_generated, source, created_at"

/** Fetch a single shared game by its id (from engine_games, then curated). */
export async function fetchEngineGameById(id: string): Promise<SharedGame | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("engine_games")
      .select(ENGINE_GAME_COLUMNS)
      .eq("id", id)
      .maybeSingle()
    if (!error && data) {
      const game = rowToGame(data as EngineGameRow)
      if (game) {
        const source = ((data as EngineGameRow).source === "generated" ? "generated" : "curated") as
          | "curated"
          | "generated"
        return toSharedGame(game, source, (data as EngineGameRow).created_at)
      }
    }
  } catch {
    /* fall through to curated */
  }
  // Curated fallback (stable bundled ids).
  const curated = getAllGames().find((g) => g.id === id)
  return curated ? toSharedGame(curated, "curated", null) : null
}

/**
 * The RANKED matchmaking pool. Prefers the anti-cheat engine self-play games
 * (`eng-med-*`), which can't be looked up online. Falls back to any generated
 * pool game, then to the curated pool, so matchmaking always has a game to give.
 */
export async function fetchRankedGames(): Promise<SharedGame[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("engine_games")
      .select(ENGINE_GAME_COLUMNS)
      .like("id", "eng-med-%")
    if (!error && data && data.length > 0) {
      const out: SharedGame[] = []
      for (const row of data as EngineGameRow[]) {
        const game = rowToGame(row)
        if (game) out.push(toSharedGame(game, "generated", row.created_at))
      }
      if (out.length > 0) return out
    }
  } catch {
    /* fall through */
  }
  // Fallbacks: any generated games in the pool, else curated.
  const pool = await fetchSharedPool()
  const generated = pool.filter((s) => s.source === "generated")
  return generated.length > 0 ? generated : pool
}

/**
 * Promote a (typically engine-generated) game into the shared pool so every user
 * can compete on it. Stamps the current user as creator (required by RLS). Gives
 * the game a stable, content-independent id. Returns the shared id on success.
 */
export async function promoteToPool(game: SolitaireGame): Promise<{ ok: boolean; id?: string; reason?: string }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, reason: "signed-out" }

    const opening = resolveOpeningLabel(game)
    const id = `gen-${user.id.slice(0, 8)}-${Date.now().toString(36)}`

    const { error } = await supabase.from("engine_games").insert({
      id,
      title: game.title || "Engine game",
      opening,
      eco: game.eco || "",
      white: game.white || "White",
      black: game.black || "Black",
      event: game.event ?? null,
      year: game.year ?? null,
      result: game.result,
      difficulty: game.difficulty ?? 3,
      start_fen: game.startFen ?? null,
      max_start_move: game.maxStartMove ?? null,
      moves: game.moves,
      is_generated: true,
      source: "generated",
      created_by: user.id,
    })

    if (error) return { ok: false, reason: looksLikeMissingTable(error) ? "no-backend" : "error" }
    return { ok: true, id }
  } catch {
    return { ok: false, reason: "error" }
  }
}
