// lib/multiplayer/scores.ts
// Persistence + ranking for competitive Solitaire. Records an attempt to
// `solitaire_scores`, updates the player's Elo in `user_ratings`, and reads the
// global + per-game leaderboards. Mirrors the never-throw, feature-detecting
// style of lib/solitaire/supabase-scores.ts: if the user is signed out or the
// backend tables/views don't exist, it returns a graceful, locally-computed
// result instead of crashing the UI.

import { createClient } from "@/lib/supabase/client"
import type { Side, SolitaireGame } from "@/lib/solitaire/types"
import { BASELINE_RATING, baselinePar } from "./elo"
import type {
  CompetitiveResult,
  GameLeaderboardRow,
  RatingLeaderboardRow,
  UserRating,
} from "./types"

function looksLikeMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "PGRST200" || // relationship / missing object
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  )
}

export interface CompetitiveScoreInput {
  game: SolitaireGame
  side: Side
  score: number
  accuracy: number
  matchRate: number
  matched: number
  totalMoves: number
  bestStreak: number
  difficulty: number
  /** Score of a flawless (all-first-try) run — used for the first-player par. */
  maxScore: number
}

/** Best score per user from a flat list of (user_id, score) rows. */
function bestPerUser(rows: { user_id: string; score: number }[]): Map<string, number> {
  const best = new Map<string, number>()
  for (const r of rows) {
    const prev = best.get(r.user_id)
    if (prev == null || r.score > prev) best.set(r.user_id, r.score)
  }
  return best
}

/**
 * Record one CASUAL (practice) competitive attempt.
 *
 * As of the matchmaking update, solo "compete" is a casual practice mode and does
 * NOT move your Elo — ranked Elo comes from head-to-head matches (see
 * lib/multiplayer/matchmaking.ts). This still records the attempt to
 * `solitaire_scores`, which powers the per-game leaderboards AND seeds the
 * matchmaking ghost pool (so casual play makes you a future opponent's ghost).
 *
 * Flow (all best-effort): read my rating (display only) → read the field's best
 * scores on this game (for par + rank) → insert the score. Returns par, field
 * size, and my rank. `eloDelta` is always 0 (casual = no rating change).
 */
export async function recordCompetitiveScore(input: CompetitiveScoreInput): Promise<CompetitiveResult> {
  const fallbackPar = baselinePar(input.maxScore)
  const offline: CompetitiveResult = {
    persisted: false,
    eloBefore: BASELINE_RATING,
    eloAfter: BASELINE_RATING,
    eloDelta: 0,
    par: fallbackPar,
    fieldSize: 0,
    rank: 1,
    totalPlayers: 1,
  }

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ...offline, reason: "signed-out" }

    // 1 · My current rating (display only — casual play never changes it).
    let currentElo = BASELINE_RATING
    {
      const { data, error } = await supabase
        .from("user_ratings")
        .select("elo")
        .eq("user_id", user.id)
        .maybeSingle()
      if (error && looksLikeMissingTable(error)) return { ...offline, reason: "no-backend" }
      if (data) currentElo = data.elo ?? BASELINE_RATING
    }

    // 2 · The field: everyone else's scores on this exact game (for par + rank).
    const { data: scoreRows, error: scoreErr } = await supabase
      .from("solitaire_scores")
      .select("user_id, score")
      .eq("game_id", input.game.id)
    if (scoreErr && looksLikeMissingTable(scoreErr)) return { ...offline, reason: "no-backend" }

    const allBest = bestPerUser((scoreRows ?? []) as { user_id: string; score: number }[])
    const fieldBest = [...allBest.entries()].filter(([uid]) => uid !== user.id)
    const fieldSize = fieldBest.length
    const par =
      fieldSize > 0 ? Math.round(fieldBest.reduce((s, [, v]) => s + v, 0) / fieldSize) : fallbackPar

    // 3 · Insert the attempt (no Elo columns — casual). Feeds leaderboards + ghosts.
    const { error: insertErr } = await supabase.from("solitaire_scores").insert({
      user_id: user.id,
      game_id: input.game.id,
      side: input.side,
      score: input.score,
      accuracy: input.accuracy,
      match_rate: input.matchRate,
      moves_matched: input.matched,
      total_moves: input.totalMoves,
      best_streak: input.bestStreak,
      difficulty: input.difficulty,
      is_competitive: true,
    })
    if (insertErr) {
      return { ...offline, reason: looksLikeMissingTable(insertErr) ? "no-backend" : "error" }
    }

    // 4 · My rank on this game (field best + my new score).
    const myBest = Math.max(input.score, allBest.get(user.id) ?? 0)
    const better = fieldBest.filter(([, v]) => v > myBest).length
    const rank = better + 1
    const totalPlayers = fieldSize + 1

    return {
      persisted: true,
      eloBefore: currentElo,
      eloAfter: currentElo,
      eloDelta: 0,
      par,
      fieldSize,
      rank,
      totalPlayers,
    }
  } catch {
    return { ...offline, reason: "error" }
  }
}

/** Read the signed-in user's competitive rating (null if none / signed out). */
export async function fetchMyRating(): Promise<UserRating | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from("user_ratings")
      .select("elo, peak_elo, games_played")
      .eq("user_id", user.id)
      .maybeSingle()
    if (error || !data) return null
    return {
      elo: data.elo ?? BASELINE_RATING,
      peakElo: data.peak_elo ?? data.elo ?? BASELINE_RATING,
      gamesPlayed: data.games_played ?? 0,
    }
  } catch {
    return null
  }
}

/** Global Elo leaderboard (top `limit`), via the public `leaderboard` view. */
export async function fetchGlobalLeaderboard(limit = 100): Promise<RatingLeaderboardRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from("leaderboard")
      .select("user_id, display_name, elo, peak_elo, games_played")
      .order("elo", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<{
      user_id: string
      display_name: string
      elo: number
      peak_elo: number
      games_played: number
    }>).map((r, i) => ({
      userId: r.user_id,
      displayName: r.display_name || "Anonymous",
      elo: r.elo,
      peakElo: r.peak_elo,
      gamesPlayed: r.games_played,
      rank: i + 1,
      isMe: !!user && r.user_id === user.id,
    }))
  } catch {
    return []
  }
}

/** Aggregate per-game stats for the whole pool: competitors + top score. */
export interface GameStat {
  players: number
  topScore: number
}

export async function fetchAllGameStats(): Promise<Map<string, GameStat>> {
  const out = new Map<string, GameStat>()
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("solitaire_game_leaderboard")
      .select("game_id, score")
    if (error || !data) return out
    for (const r of data as { game_id: string; score: number }[]) {
      const cur = out.get(r.game_id) ?? { players: 0, topScore: 0 }
      cur.players += 1
      cur.topScore = Math.max(cur.topScore, r.score)
      out.set(r.game_id, cur)
    }
    return out
  } catch {
    return out
  }
}

/** Per-game leaderboard (each player's best on `gameId`), best score first. */
export async function fetchGameLeaderboard(gameId: string, limit = 100): Promise<GameLeaderboardRow[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from("solitaire_game_leaderboard")
      .select(
        "user_id, display_name, side, score, accuracy, match_rate, moves_matched, total_moves, best_streak, difficulty, created_at",
      )
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as Array<{
      user_id: string
      display_name: string
      side: Side
      score: number
      accuracy: number
      match_rate: number
      moves_matched: number
      total_moves: number
      best_streak: number
      difficulty: number
      created_at: string
    }>).map((r, i) => ({
      userId: r.user_id,
      displayName: r.display_name || "Anonymous",
      side: r.side,
      score: r.score,
      accuracy: r.accuracy,
      matchRate: r.match_rate ?? 0,
      movesMatched: r.moves_matched,
      totalMoves: r.total_moves,
      bestStreak: r.best_streak,
      difficulty: r.difficulty,
      createdAt: r.created_at,
      rank: i + 1,
      isMe: !!user && r.user_id === user.id,
    }))
  } catch {
    return []
  }
}
