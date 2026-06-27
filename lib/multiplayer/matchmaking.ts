// lib/multiplayer/matchmaking.ts
// Ranked head-to-head matchmaking for Solitaire Chess.
//
// TWO EXPLICIT PATHS (the user always picks; we never silently drop them on a bot):
//   • REAL player (searchRealMatch): RESUME an unfinished match, else join
//     `match_queue` and keep polling — claiming another searching user via the
//     mm_find_live_opponent() RPC, or detecting being claimed — until a LIVE
//     opponent is found or the user cancels. This path is LIVE-ONLY: it never
//     falls back to a ghost or bot. The UI drives the polling interval and shows
//     a persistent "searching" state; cancelling removes the queue row.
//   • BOT (findBotMatch): RESUME an unfinished match, else immediately create a
//     par/baseline bot match on a random ranked game.
//
// GHOST DECISION: ghosts (a real user's *recorded* attempt) are intentionally NOT
// used in the real-player path. "Real player" means a live human only, so the
// searcher is never quietly matched against a recording or a bot. (Recorded
// attempts still feed casual solo compete; they're just not a matchmaking opponent.)
//
// RESULTS (submitMatchResult): the higher solitaire-scoring score wins (tie =
// draw); Elo is awarded HEAD-TO-HEAD (see ./elo.ts computeHeadToHead). For a bot,
// only the live player's rating changes (vs the bot's baseline Elo). For live,
// BOTH players are rated, but because RLS only lets a user write their OWN
// user_ratings row, each side applies its own delta: the resolver writes its
// rating immediately; the other side applies theirs via applyPendingMatchRatings()
// the next time they open matchmaking (a_applied / b_applied track this).
//
// HONESTY: this is asynchronous (no websockets). A live pairing's two players
// solve on their own time and the match settles when both have submitted.
//
// Anti-cheat: scores are client-trusted via RLS (same caveat as solo compete). A
// SECURITY DEFINER replay RPC is the recommended future hardening.

import { createClient } from "@/lib/supabase/client"
import type { Side, SolitaireGame } from "@/lib/solitaire/types"
import { playableSide, userPlies, moveNumberAtPly } from "@/lib/solitaire/engine"
import { DEFAULT_SCORE_CONFIG } from "@/lib/solitaire-scoring"
import { BASELINE_RATING, baselinePar, computeHeadToHead, outcomeFor } from "./elo"
import { fetchEngineGameById, fetchRankedGames } from "./engine-games"
import type { MatchAndGame, MatchResultOutcome, OpponentKind, SharedGame } from "./types"

type FindMatchResult =
  | { ok: true; match: MatchAndGame }
  | { ok: false; reason: "signed-out" | "no-backend" | "error" }

/** Who the searcher wants to face. */
export type OpponentChoice = "real" | "bot"

// Ranked engine games skip the opening: the player begins solving at this full
// move instead of move 1 (the prior moves are already on the board — effectively
// auto-revealed). Derived purely from the game + side so BOTH matched players
// compute the SAME start and scoring stays fair.
export const RANKED_START_FULL_MOVE = 7
// Never start so deep that fewer than this many of the player's moves remain
// (so short games "fall back gracefully" rather than starting past the end).
const RANKED_MIN_REMAINING_GUESSES = 2

/**
 * The ply a ranked match begins solving from. Only engine games skip the opening
 * (master games keep their normal start); games shorter than move 7 start from
 * the top; the result is clamped to leave at least RANKED_MIN_REMAINING_GUESSES
 * of the player's own moves. Deterministic, so both players get the same value.
 */
export function rankedStartPly(game: SolitaireGame, side: Side): number {
  if (!game.isGenerated) return 0
  const plies = userPlies(game, side, 0)
  if (plies.length <= RANKED_MIN_REMAINING_GUESSES) return 0
  const target = plies.find((p) => moveNumberAtPly(game, p) >= RANKED_START_FULL_MOVE)
  if (target == null) return 0
  const idx = plies.indexOf(target)
  const maxIdx = plies.length - RANKED_MIN_REMAINING_GUESSES
  return plies[Math.min(idx, maxIdx)]
}

interface MatchRow {
  id: string
  game_id: string
  player_a: string
  player_b: string | null
  is_ghost: boolean
  opponent_kind: OpponentKind
  opponent_label: string | null
  player_a_score: number | null
  player_b_score: number | null
  player_a_elo_before: number | null
  player_a_elo_after: number | null
  player_b_elo_before: number | null
  player_b_elo_after: number | null
  a_applied: boolean
  b_applied: boolean
  winner: "a" | "b" | "draw" | null
  status: "pending" | "active" | "complete"
}

const MATCH_COLUMNS =
  "id, game_id, player_a, player_b, is_ghost, opponent_kind, opponent_label, player_a_score, player_b_score, player_a_elo_before, player_a_elo_after, player_b_elo_before, player_b_elo_after, a_applied, b_applied, winner, status"

function looksLikeMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "PGRST202" || // function not found
    code === "PGRST200" ||
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  )
}

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// The ranked-game pool is stable for a session; cache it so a long real-player
// search doesn't re-query engine_games on every poll tick.
let rankedCache: SharedGame[] | null = null
async function getRankedGames(): Promise<SharedGame[]> {
  if (rankedCache && rankedCache.length > 0) return rankedCache
  rankedCache = await fetchRankedGames()
  return rankedCache
}

/** A flawless-run score for a game+side — the ceiling used to derive a bot par.
 *  Counts only the guesses the player actually makes (from the ranked start ply)
 *  so the bot's par matches the shortened, opening-skipped ranked game. */
function maxScoreFor(game: SharedGame): number {
  const side = game.side
  const start = rankedStartPly(game.game, side)
  const guesses = userPlies(game.game, side, start).length
  const mult = DEFAULT_SCORE_CONFIG.difficultyMultiplier(game.game.difficulty)
  return Math.round(guesses * DEFAULT_SCORE_CONFIG.basePerMove * mult)
}

/** Read the signed-in user's rating (elo / games_played / peak), with defaults. */
async function readRating(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ elo: number; gamesPlayed: number; peakElo: number; missing: boolean }> {
  const { data, error } = await supabase
    .from("user_ratings")
    .select("elo, peak_elo, games_played")
    .eq("user_id", userId)
    .maybeSingle()
  if (error && looksLikeMissingTable(error)) {
    return { elo: BASELINE_RATING, gamesPlayed: 0, peakElo: BASELINE_RATING, missing: true }
  }
  return {
    elo: data?.elo ?? BASELINE_RATING,
    gamesPlayed: data?.games_played ?? 0,
    peakElo: data?.peak_elo ?? data?.elo ?? BASELINE_RATING,
    missing: false,
  }
}

/** Resolve a display name for a user via the public leaderboard view. */
async function displayNameFor(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fallback: string,
): Promise<string> {
  try {
    const { data } = await supabase
      .from("leaderboard")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle()
    return (data?.display_name as string) || fallback
  } catch {
    return fallback
  }
}

/** Build the client-facing MatchAndGame from a DB row + the current user's role. */
async function buildMatchAndGame(
  supabase: ReturnType<typeof createClient>,
  row: MatchRow,
  role: "a" | "b",
  myElo: number,
): Promise<MatchAndGame | null> {
  const shared = await fetchEngineGameById(row.game_id)
  if (!shared) return null
  const side: Side = playableSide(shared.game)
  const startPly = rankedStartPly(shared.game, side)

  const opponentScore = role === "a" ? row.player_b_score : row.player_a_score
  const opponentEloBefore =
    (role === "a" ? row.player_b_elo_before : row.player_a_elo_before) ?? BASELINE_RATING
  const myEloBefore = (role === "a" ? row.player_a_elo_before : row.player_b_elo_before) ?? myElo

  let opponentLabel = row.opponent_label ?? ""
  if (!opponentLabel) {
    if (row.opponent_kind === "bot") opponentLabel = "Par Bot"
    else {
      const oppId = role === "a" ? row.player_b : row.player_a
      opponentLabel = oppId
        ? await displayNameFor(supabase, oppId, row.opponent_kind === "ghost" ? "Ghost" : "Opponent")
        : "Opponent"
    }
  }

  return {
    matchId: row.id,
    game: shared.game,
    side,
    startPly,
    role,
    opponentKind: row.opponent_kind,
    opponentLabel,
    opponentScore: opponentScore ?? null,
    opponentEloBefore,
    myEloBefore,
  }
}

/** An unfinished match assigned to me (I created it and haven't played, or I was claimed). */
async function findResumable(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ row: MatchRow; role: "a" | "b" } | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("status", "active")
    .or(
      `and(player_a.eq.${userId},player_a_score.is.null),and(player_b.eq.${userId},player_b_score.is.null)`,
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const row = data as MatchRow
  const role: "a" | "b" = row.player_a === userId ? "a" : "b"
  return { row, role }
}

async function joinQueue(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  elo: number,
): Promise<void> {
  await supabase
    .from("match_queue")
    .upsert(
      { user_id: userId, elo_snapshot: elo, joined_at: new Date().toISOString(), status: "searching" },
      { onConflict: "user_id" },
    )
}

async function leaveQueue(supabase: ReturnType<typeof createClient>, userId: string): Promise<void> {
  await supabase.from("match_queue").delete().eq("user_id", userId)
}

/** Create a bot match (par baseline) on a random ranked game. */
async function createBotMatch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  myElo: number,
  ranked: SharedGame[],
): Promise<MatchAndGame | null> {
  if (ranked.length === 0) return null
  const shared = randomOf(ranked)
  const par = baselinePar(maxScoreFor(shared))

  const { data: inserted, error } = await supabase
    .from("matches")
    .insert({
      game_id: shared.game.id,
      player_a: userId,
      player_b: null,
      is_ghost: false,
      opponent_kind: "bot",
      opponent_label: "Par Bot",
      player_b_score: par,
      player_a_elo_before: myElo,
      player_b_elo_before: BASELINE_RATING,
      status: "active",
    })
    .select(MATCH_COLUMNS)
    .single()
  if (error || !inserted) return null
  return buildMatchAndGame(supabase, inserted as MatchRow, "a", myElo)
}

/**
 * BOT match: resume an unfinished match if any, else immediately create a par-bot
 * match. Used by the explicit "Bot" choice and the "Play a bot instead" escape
 * hatch in the searching overlay — a bot only ever happens by deliberate choice.
 */
export async function findBotMatch(): Promise<FindMatchResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, reason: "signed-out" }

    const rating = await readRating(supabase, user.id)
    if (rating.missing) return { ok: false, reason: "no-backend" }

    // Resume an unfinished match first (don't strand it).
    const resumable = await findResumable(supabase, user.id)
    if (resumable) {
      const built = await buildMatchAndGame(supabase, resumable.row, resumable.role, rating.elo)
      if (built) return { ok: true, match: built }
    }

    const ranked = await getRankedGames()
    const bot = await createBotMatch(supabase, user.id, rating.elo, ranked)
    return bot ? { ok: true, match: bot } : { ok: false, reason: "error" }
  } catch {
    return { ok: false, reason: "error" }
  }
}

/** One tick of a continuous real-player search (see RealSearchResult). */
export type RealSearchResult =
  | { kind: "match"; match: MatchAndGame }
  | { kind: "searching" }
  | { kind: "error"; reason: "signed-out" | "no-backend" | "error" }

/**
 * REAL-PLAYER search, driven tick-by-tick by the UI so it can keep searching
 * indefinitely (until a live opponent is found or the user cancels).
 *
 *   • On the FIRST tick: resume an unfinished match (returns it immediately),
 *     otherwise join `match_queue`.
 *   • On EVERY tick: try to atomically claim another searching user via the
 *     mm_find_live_opponent() RPC, and detect being claimed by someone else.
 *
 * Returns `{ kind: "searching" }` when nobody is available yet — the caller waits
 * and calls again. NEVER falls back to a ghost or bot. The caller is responsible
 * for the polling interval and for calling cancelSearch() to leave the queue.
 */
export async function searchRealMatch(opts: { firstTick: boolean }): Promise<RealSearchResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { kind: "error", reason: "signed-out" }

    const rating = await readRating(supabase, user.id)
    if (rating.missing) return { kind: "error", reason: "no-backend" }

    if (opts.firstTick) {
      // Resume an unfinished match before queuing.
      const resumable = await findResumable(supabase, user.id)
      if (resumable) {
        const built = await buildMatchAndGame(supabase, resumable.row, resumable.role, rating.elo)
        if (built) return { kind: "match", match: built }
      }
      await joinQueue(supabase, user.id, rating.elo)
    }

    const ranked = await getRankedGames()
    if (ranked.length === 0) return { kind: "searching" }

    // Try to claim a waiting opponent (atomic, race-safe via RPC).
    const liveGame = randomOf(ranked)
    const { data: claimedId, error: rpcErr } = await supabase.rpc("mm_find_live_opponent", {
      p_game_id: liveGame.game.id,
      p_elo: rating.elo,
    })
    if (rpcErr && looksLikeMissingTable(rpcErr)) return { kind: "error", reason: "no-backend" }
    if (claimedId) {
      const { data: row } = await supabase
        .from("matches")
        .select(MATCH_COLUMNS)
        .eq("id", claimedId as string)
        .single()
      if (row) {
        const built = await buildMatchAndGame(supabase, row as MatchRow, "a", rating.elo)
        if (built) return { kind: "match", match: built }
      }
    }

    // Detect being claimed by someone else (I become player_b of a live match).
    const { data: claimedRow } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("player_b", user.id)
      .eq("status", "active")
      .is("player_b_score", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (claimedRow) {
      await leaveQueue(supabase, user.id)
      const built = await buildMatchAndGame(supabase, claimedRow as MatchRow, "b", rating.elo)
      if (built) return { kind: "match", match: built }
    }

    return { kind: "searching" }
  } catch {
    return { kind: "error", reason: "error" }
  }
}

/** Cancel an in-progress search (best-effort queue cleanup). */
export async function cancelSearch(): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) await leaveQueue(supabase, user.id)
  } catch {
    /* ignore */
  }
}

export interface SubmitMatchInput {
  matchId: string
  score: number
  side: Side
  accuracy: number
  matchRate: number
  matched: number
  totalMoves: number
  bestStreak: number
  difficulty: number
}

/**
 * Submit the current user's score for a match. Resolves immediately for ghost/bot
 * (and for the second player of a live match); for the first player of a live
 * match it records the score and reports "pending" until the opponent finishes.
 */
export async function submitMatchResult(input: SubmitMatchInput): Promise<MatchResultOutcome> {
  const offline: MatchResultOutcome = {
    status: "complete",
    persisted: false,
    opponentKind: "bot",
    opponentLabel: "Par Bot",
    myScore: input.score,
    opponentScore: null,
    outcome: null,
    eloBefore: BASELINE_RATING,
    eloAfter: BASELINE_RATING,
    eloDelta: 0,
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ...offline, reason: "signed-out" }

    const { data: matchData, error: loadErr } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("id", input.matchId)
      .single()
    if (loadErr || !matchData) {
      return { ...offline, reason: looksLikeMissingTable(loadErr) ? "no-backend" : "error" }
    }
    const match = matchData as MatchRow
    const role: "a" | "b" = match.player_a === user.id ? "a" : "b"

    // Record a solitaire_scores row so ranked play feeds leaderboards + the ghost
    // pool (best-effort; the {error} is ignored so it never blocks the result).
    await supabase.from("solitaire_scores").insert({
      user_id: user.id,
      game_id: match.game_id,
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

    const rating = await readRating(supabase, user.id)
    const myEloBefore =
      (role === "a" ? match.player_a_elo_before : match.player_b_elo_before) ?? rating.elo
    const oppEloBefore =
      (role === "a" ? match.player_b_elo_before : match.player_a_elo_before) ?? BASELINE_RATING
    const opponentScore = role === "a" ? match.player_b_score : match.player_a_score
    const opponentLabel =
      match.opponent_label ?? (match.opponent_kind === "bot" ? "Par Bot" : "Opponent")

    const myScoreCol = role === "a" ? "player_a_score" : "player_b_score"
    const myEloAfterCol = role === "a" ? "player_a_elo_after" : "player_b_elo_after"
    const myAppliedCol = role === "a" ? "a_applied" : "b_applied"

    // ── Live opponent hasn't played yet → record my score, stay pending. ──
    if (opponentScore == null) {
      const { error: upErr } = await supabase
        .from("matches")
        .update({ [myScoreCol]: input.score })
        .eq("id", match.id)
      if (upErr) return { ...offline, reason: looksLikeMissingTable(upErr) ? "no-backend" : "error" }
      return {
        status: "pending",
        persisted: true,
        opponentKind: match.opponent_kind,
        opponentLabel,
        myScore: input.score,
        opponentScore: null,
        outcome: null,
        eloBefore: myEloBefore,
        eloAfter: myEloBefore,
        eloDelta: 0,
      }
    }

    // ── Both scores known → resolve head-to-head. ──
    const outcome = outcomeFor(input.score, opponentScore)
    const h2h = computeHeadToHead({
      playerElo: myEloBefore,
      gamesPlayed: rating.gamesPlayed,
      opponentElo: oppEloBefore,
      outcome,
    })

    const aScore = role === "a" ? input.score : match.player_a_score ?? 0
    const bScore = role === "b" ? input.score : match.player_b_score ?? 0
    const winner: "a" | "b" | "draw" = aScore > bScore ? "a" : aScore < bScore ? "b" : "draw"

    const { error: upErr } = await supabase
      .from("matches")
      .update({
        [myScoreCol]: input.score,
        [myEloAfterCol]: h2h.eloAfter,
        [myAppliedCol]: true,
        winner,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", match.id)
    if (upErr) return { ...offline, reason: looksLikeMissingTable(upErr) ? "no-backend" : "error" }

    // Apply MY rating to user_ratings (own row only — RLS).
    await supabase.from("user_ratings").upsert(
      {
        user_id: user.id,
        elo: h2h.eloAfter,
        peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
        games_played: rating.gamesPlayed + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    return {
      status: "complete",
      persisted: true,
      opponentKind: match.opponent_kind,
      opponentLabel,
      myScore: input.score,
      opponentScore,
      outcome,
      eloBefore: h2h.eloBefore,
      eloAfter: h2h.eloAfter,
      eloDelta: h2h.delta,
    }
  } catch {
    return { ...offline, reason: "error" }
  }
}

/**
 * Resign (forfeit) the current match: records it as a LOSS for the user, awards
 * the win to the opponent, and applies the head-to-head Elo loss immediately.
 * Finalizes the match and returns a loss MatchResultOutcome for the result screen.
 * (A live opponent who hadn't played yet wins by forfeit; their own rating, if
 * any, isn't auto-credited since they have no score — a minor known limitation.)
 */
export async function resignMatch(matchId: string): Promise<MatchResultOutcome> {
  const offline: MatchResultOutcome = {
    status: "complete",
    persisted: false,
    opponentKind: "bot",
    opponentLabel: "Opponent",
    myScore: 0,
    opponentScore: null,
    outcome: "loss",
    eloBefore: BASELINE_RATING,
    eloAfter: BASELINE_RATING,
    eloDelta: 0,
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ...offline, reason: "signed-out" }

    const { data: matchData, error: loadErr } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("id", matchId)
      .single()
    if (loadErr || !matchData) {
      return { ...offline, reason: looksLikeMissingTable(loadErr) ? "no-backend" : "error" }
    }
    const match = matchData as MatchRow
    const role: "a" | "b" = match.player_a === user.id ? "a" : "b"

    const rating = await readRating(supabase, user.id)
    const myEloBefore =
      (role === "a" ? match.player_a_elo_before : match.player_b_elo_before) ?? rating.elo
    const oppEloBefore =
      (role === "a" ? match.player_b_elo_before : match.player_a_elo_before) ?? BASELINE_RATING
    const opponentScore = role === "a" ? match.player_b_score : match.player_a_score
    const opponentLabel =
      match.opponent_label ?? (match.opponent_kind === "bot" ? "Par Bot" : "Opponent")

    // Forfeit = a loss for the resigner.
    const h2h = computeHeadToHead({
      playerElo: myEloBefore,
      gamesPlayed: rating.gamesPlayed,
      opponentElo: oppEloBefore,
      outcome: "loss",
    })

    const myScoreCol = role === "a" ? "player_a_score" : "player_b_score"
    const myEloAfterCol = role === "a" ? "player_a_elo_after" : "player_b_elo_after"
    const myAppliedCol = role === "a" ? "a_applied" : "b_applied"
    const winner: "a" | "b" = role === "a" ? "b" : "a"

    const { error: upErr } = await supabase
      .from("matches")
      .update({
        [myScoreCol]: 0,
        [myEloAfterCol]: h2h.eloAfter,
        [myAppliedCol]: true,
        winner,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", match.id)
    if (upErr) return { ...offline, reason: looksLikeMissingTable(upErr) ? "no-backend" : "error" }

    await supabase.from("user_ratings").upsert(
      {
        user_id: user.id,
        elo: h2h.eloAfter,
        peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
        games_played: rating.gamesPlayed + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    return {
      status: "complete",
      persisted: true,
      opponentKind: match.opponent_kind,
      opponentLabel,
      myScore: 0,
      opponentScore: opponentScore ?? null,
      outcome: "loss",
      eloBefore: h2h.eloBefore,
      eloAfter: h2h.eloAfter,
      eloDelta: h2h.delta,
    }
  } catch {
    return { ...offline, reason: "error" }
  }
}

/**
 * Apply rating deltas for any completed LIVE matches where the current user was
 * the FIRST to play (so the resolver couldn't write the user's rating under RLS).
 * Safe to call on the matchmaking screen mount; returns how many were applied.
 */
export async function applyPendingMatchRatings(): Promise<number> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    const { data, error } = await supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("status", "complete")
      .or(`and(player_a.eq.${user.id},a_applied.is.false),and(player_b.eq.${user.id},b_applied.is.false)`)
    if (error || !data || data.length === 0) return 0

    let applied = 0
    for (const raw of data as MatchRow[]) {
      const role: "a" | "b" = raw.player_a === user.id ? "a" : "b"
      const myScore = role === "a" ? raw.player_a_score : raw.player_b_score
      const oppScore = role === "a" ? raw.player_b_score : raw.player_a_score
      const myBefore = (role === "a" ? raw.player_a_elo_before : raw.player_b_elo_before) ?? BASELINE_RATING
      const oppBefore = (role === "a" ? raw.player_b_elo_before : raw.player_a_elo_before) ?? BASELINE_RATING
      if (myScore == null || oppScore == null) continue

      const rating = await readRating(supabase, user.id)
      const h2h = computeHeadToHead({
        playerElo: myBefore,
        gamesPlayed: rating.gamesPlayed,
        opponentElo: oppBefore,
        outcome: outcomeFor(myScore, oppScore),
      })

      const myEloAfterCol = role === "a" ? "player_a_elo_after" : "player_b_elo_after"
      const myAppliedCol = role === "a" ? "a_applied" : "b_applied"
      await supabase
        .from("matches")
        .update({ [myEloAfterCol]: h2h.eloAfter, [myAppliedCol]: true })
        .eq("id", raw.id)
      await supabase.from("user_ratings").upsert(
        {
          user_id: user.id,
          elo: h2h.eloAfter,
          peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
          games_played: rating.gamesPlayed + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      applied++
    }
    return applied
  } catch {
    return 0
  }
}
