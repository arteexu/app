// lib/play/live.ts
// Supabase-backed real-time logic for Play vs Human (live full chess).
//
// MATCHMAKING: a player joins play_queue for a time control and, each tick, tries
// to atomically claim another waiting player via the play_find_live_opponent()
// SECURITY DEFINER RPC (or detects being claimed). The RPC creates the play_games
// row, assigns colors randomly, and removes both from the queue.
//
// MOVE RELAY: moves are persisted to play_moves (authoritative, server-side, with
// a unique (game_id, ply) so a ply can't be double-written), and play_games keeps
// a live mirror (fen / turn / clocks) for joiners + reconnects. Clients subscribe
// via Supabase Realtime postgres_changes (INSERT on play_moves for the opponent's
// move; UPDATE on play_games for clocks / draw offers / resign / finalize).
//
// CLOCKS: each move row carries the post-move remaining ms for both sides; the
// receiver counts the new side-to-move down from those values. The mover computes
// its own elapsed locally (trusted, same anti-cheat caveat as the rest of the app).
//
// RATINGS: applied head-to-head on the SEPARATE Play ladder (play_ratings). Because
// RLS only lets a user write their OWN row, each side applies its own delta — the
// finalizer writes immediately; the other side applies on next mount via
// applyPendingPlayRatings() (white_applied / black_applied track this).

import { createClient } from "@/lib/supabase/client"
import { computeHeadToHead, outcomeFor, type MatchOutcome } from "@/lib/multiplayer/elo"
import { readPlayRating } from "./ratings"
import { PLAY_BASELINE_ELO, type EndReason, type PieceColor } from "./types"

type SupabaseClient = ReturnType<typeof createClient>

export interface PlayGameRow {
  id: string
  mode: "bot" | "human"
  white_id: string | null
  black_id: string | null
  is_bot: boolean
  tc_base_seconds: number
  tc_increment_seconds: number
  status: "waiting" | "active" | "complete" | "aborted"
  result: "1-0" | "0-1" | "1/2-1/2" | null
  winner: "white" | "black" | "draw" | null
  end_reason: EndReason | null
  fen: string
  pgn: string
  turn: PieceColor
  ply: number
  white_clock_ms: number
  black_clock_ms: number
  turn_started_at: string | null
  draw_offer_by: PieceColor | null
  white_elo_before: number | null
  white_elo_after: number | null
  black_elo_before: number | null
  black_elo_after: number | null
  white_applied: boolean
  black_applied: boolean
}

export interface PlayMoveRow {
  game_id: string
  ply: number
  san: string
  uci: string
  fen_after: string
  color: PieceColor
  by_user: string | null
  white_clock_ms: number
  black_clock_ms: number
}

export const PLAY_GAME_COLUMNS =
  "id, mode, white_id, black_id, is_bot, tc_base_seconds, tc_increment_seconds, status, result, winner, end_reason, fen, pgn, turn, ply, white_clock_ms, black_clock_ms, turn_started_at, draw_offer_by, white_elo_before, white_elo_after, black_elo_before, black_elo_after, white_applied, black_applied"

export function colorForUser(game: PlayGameRow, userId: string): PieceColor | null {
  if (game.white_id === userId) return "white"
  if (game.black_id === userId) return "black"
  return null
}

function looksLikeMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "PGRST202" ||
    code === "PGRST200" ||
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache")
  )
}

// ── Matchmaking ───────────────────────────────────────────────────────────────

export type LiveSearchResult =
  | { kind: "match"; gameId: string }
  | { kind: "searching" }
  | { kind: "error"; reason: "signed-out" | "no-backend" | "error" }

async function joinQueue(
  supabase: SupabaseClient,
  userId: string,
  elo: number,
  base: number,
  increment: number,
): Promise<void> {
  await supabase.from("play_queue").upsert(
    {
      user_id: userId,
      elo_snapshot: elo,
      tc_base_seconds: base,
      tc_increment_seconds: increment,
      joined_at: new Date().toISOString(),
      status: "searching",
    },
    { onConflict: "user_id" },
  )
}

export async function leaveQueue(): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) await supabase.from("play_queue").delete().eq("user_id", user.id)
  } catch {
    /* best-effort */
  }
}

/** Resume an unfinished live game the user is already in (waiting/active). */
async function findResumable(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("play_games")
    .select("id")
    .eq("mode", "human")
    .in("status", ["active"])
    .or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.id as string) ?? null
}

/**
 * One tick of a live search for the given time control. The caller drives the
 * polling interval and calls leaveQueue() to cancel. Never falls back to a bot.
 */
export async function searchLiveMatch(opts: {
  firstTick: boolean
  baseSeconds: number
  incrementSeconds: number
}): Promise<LiveSearchResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { kind: "error", reason: "signed-out" }

    const rating = await readPlayRating(supabase, user.id)
    if (rating.missing) return { kind: "error", reason: "no-backend" }

    if (opts.firstTick) {
      const resumable = await findResumable(supabase, user.id)
      if (resumable) return { kind: "match", gameId: resumable }
      await joinQueue(supabase, user.id, rating.elo, opts.baseSeconds, opts.incrementSeconds)
    }

    // Try to claim a waiting opponent (atomic, race-safe via RPC).
    const { data: claimedId, error: rpcErr } = await supabase.rpc("play_find_live_opponent", {
      p_tc_base: opts.baseSeconds,
      p_tc_increment: opts.incrementSeconds,
      p_elo: rating.elo,
    })
    if (rpcErr && looksLikeMissingTable(rpcErr)) return { kind: "error", reason: "no-backend" }
    if (claimedId) return { kind: "match", gameId: claimedId as string }

    // Detect being claimed by someone else (I became a participant of a live game).
    const { data: claimedRow } = await supabase
      .from("play_games")
      .select("id")
      .eq("mode", "human")
      .eq("status", "active")
      .or(`white_id.eq.${user.id},black_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (claimedRow?.id) {
      await supabase.from("play_queue").delete().eq("user_id", user.id)
      return { kind: "match", gameId: claimedRow.id as string }
    }

    return { kind: "searching" }
  } catch {
    return { kind: "error", reason: "error" }
  }
}

// ── Game state ─────────────────────────────────────────────────────────────────

export async function loadGame(gameId: string): Promise<PlayGameRow | null> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("play_games")
      .select(PLAY_GAME_COLUMNS)
      .eq("id", gameId)
      .maybeSingle()
    return (data as PlayGameRow) ?? null
  } catch {
    return null
  }
}

export async function loadMoves(gameId: string): Promise<PlayMoveRow[]> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from("play_moves")
      .select("game_id, ply, san, uci, fen_after, color, by_user, white_clock_ms, black_clock_ms")
      .eq("game_id", gameId)
      .order("ply", { ascending: true })
    return (data as PlayMoveRow[]) ?? []
  } catch {
    return []
  }
}

export interface PersistMoveInput {
  gameId: string
  ply: number
  san: string
  uci: string
  fenAfter: string
  pgn: string
  color: PieceColor
  whiteClockMs: number
  blackClockMs: number
}

/**
 * Persist one move: append the authoritative play_moves row and update the live
 * mirror on play_games (fen/turn/clocks/ply, clearing any draw offer). The unique
 * (game_id, ply) constraint rejects a duplicate ply if both clients ever raced.
 */
export async function persistMove(input: PersistMoveInput): Promise<{ ok: boolean }> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false }

    const nextTurn: PieceColor = input.color === "white" ? "black" : "white"

    const { error: moveErr } = await supabase.from("play_moves").insert({
      game_id: input.gameId,
      ply: input.ply,
      san: input.san,
      uci: input.uci,
      fen_after: input.fenAfter,
      color: input.color,
      by_user: user.id,
      white_clock_ms: input.whiteClockMs,
      black_clock_ms: input.blackClockMs,
    })
    if (moveErr) return { ok: false }

    await supabase
      .from("play_games")
      .update({
        fen: input.fenAfter,
        pgn: input.pgn,
        turn: nextTurn,
        ply: input.ply,
        white_clock_ms: input.whiteClockMs,
        black_clock_ms: input.blackClockMs,
        turn_started_at: new Date().toISOString(),
        draw_offer_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.gameId)

    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function offerDraw(gameId: string, color: PieceColor): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from("play_games")
      .update({ draw_offer_by: color, updated_at: new Date().toISOString() })
      .eq("id", gameId)
  } catch {
    /* ignore */
  }
}

export async function clearDrawOffer(gameId: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from("play_games")
      .update({ draw_offer_by: null, updated_at: new Date().toISOString() })
      .eq("id", gameId)
  } catch {
    /* ignore */
  }
}

// ── Finalize + ratings ──────────────────────────────────────────────────────────

function ratingTag(winner: "white" | "black" | "draw"): "1-0" | "0-1" | "1/2-1/2" {
  if (winner === "white") return "1-0"
  if (winner === "black") return "0-1"
  return "1/2-1/2"
}

/**
 * Finalize a live game (resign / timeout / draw agreement / natural end) and apply
 * the finalizing user's OWN Play-rating delta. The opponent applies theirs later
 * via applyPendingPlayRatings(). Guarded so it no-ops if the game is already
 * complete (the other client may have finalized first).
 */
export async function finalizeGame(
  gameId: string,
  winner: "white" | "black" | "draw",
  reason: EndReason,
): Promise<{ eloBefore: number; eloAfter: number; eloDelta: number; persisted: boolean }> {
  const fallback = { eloBefore: PLAY_BASELINE_ELO, eloAfter: PLAY_BASELINE_ELO, eloDelta: 0, persisted: false }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fallback

    const game = await loadGame(gameId)
    if (!game) return fallback

    const myColor = colorForUser(game, user.id)
    if (!myColor) return fallback

    // Idempotency: if I've already applied my delta for this game, do nothing
    // (both clients may call finalizeGame for the same end — each applies once).
    const myAlreadyApplied = myColor === "white" ? game.white_applied : game.black_applied
    const myExistingAfter = myColor === "white" ? game.white_elo_after : game.black_elo_after
    if (myAlreadyApplied) {
      const before =
        (myColor === "white" ? game.white_elo_before : game.black_elo_before) ?? PLAY_BASELINE_ELO
      const after = myExistingAfter ?? before
      return { eloBefore: before, eloAfter: after, eloDelta: after - before, persisted: true }
    }

    // If the game was already finalized by the opponent, trust its recorded result
    // so both sides rate against the same outcome.
    if (game.status === "complete" && game.winner) {
      winner = game.winner
      reason = game.end_reason ?? reason
    }

    const myEloBefore =
      (myColor === "white" ? game.white_elo_before : game.black_elo_before) ?? PLAY_BASELINE_ELO
    const oppEloBefore =
      (myColor === "white" ? game.black_elo_before : game.white_elo_before) ?? PLAY_BASELINE_ELO

    const myOutcome: MatchOutcome =
      winner === "draw" ? "draw" : winner === myColor ? "win" : "loss"

    const rating = await readPlayRating(supabase, user.id)
    const h2h = computeHeadToHead({
      playerElo: myEloBefore,
      gamesPlayed: rating.gamesPlayed,
      opponentElo: oppEloBefore,
      outcome: myOutcome,
    })

    // Mark the game complete (idempotent: only set result fields if still active).
    if (game.status !== "complete") {
      await supabase
        .from("play_games")
        .update({
          status: "complete",
          result: ratingTag(winner),
          winner,
          end_reason: reason,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameId)
        .neq("status", "complete")
    }

    // Write MY elo fields + applied flag on the game row.
    const myAfterCol = myColor === "white" ? "white_elo_after" : "black_elo_after"
    const myAppliedCol = myColor === "white" ? "white_applied" : "black_applied"
    await supabase
      .from("play_games")
      .update({ [myAfterCol]: h2h.eloAfter, [myAppliedCol]: true })
      .eq("id", gameId)

    // Apply MY rating to play_ratings (own row only — RLS).
    await supabase.from("play_ratings").upsert(
      {
        user_id: user.id,
        elo: h2h.eloAfter,
        peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
        games_played: rating.gamesPlayed + 1,
        wins: rating.wins + (myOutcome === "win" ? 1 : 0),
        losses: rating.losses + (myOutcome === "loss" ? 1 : 0),
        draws: rating.draws + (myOutcome === "draw" ? 1 : 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    return { eloBefore: h2h.eloBefore, eloAfter: h2h.eloAfter, eloDelta: h2h.delta, persisted: true }
  } catch {
    return fallback
  }
}

/**
 * Apply rating deltas for completed live games where the current user hasn't yet
 * applied theirs (they were the non-finalizing side). Safe on Play screen mount.
 * Returns how many were applied.
 */
export async function applyPendingPlayRatings(): Promise<number> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0

    const { data, error } = await supabase
      .from("play_games")
      .select(PLAY_GAME_COLUMNS)
      .eq("mode", "human")
      .eq("status", "complete")
      .or(
        `and(white_id.eq.${user.id},white_applied.is.false),and(black_id.eq.${user.id},black_applied.is.false)`,
      )
    if (error || !data || data.length === 0) return 0

    let applied = 0
    for (const raw of data as PlayGameRow[]) {
      const myColor = colorForUser(raw, user.id)
      if (!myColor || !raw.winner) continue
      const myEloBefore =
        (myColor === "white" ? raw.white_elo_before : raw.black_elo_before) ?? PLAY_BASELINE_ELO
      const oppEloBefore =
        (myColor === "white" ? raw.black_elo_before : raw.white_elo_before) ?? PLAY_BASELINE_ELO
      const myOutcome: MatchOutcome =
        raw.winner === "draw" ? "draw" : raw.winner === myColor ? "win" : "loss"

      const rating = await readPlayRating(supabase, user.id)
      const h2h = computeHeadToHead({
        playerElo: myEloBefore,
        gamesPlayed: rating.gamesPlayed,
        opponentElo: oppEloBefore,
        outcome: myOutcome,
      })

      const myAfterCol = myColor === "white" ? "white_elo_after" : "black_elo_after"
      const myAppliedCol = myColor === "white" ? "white_applied" : "black_applied"
      await supabase
        .from("play_games")
        .update({ [myAfterCol]: h2h.eloAfter, [myAppliedCol]: true })
        .eq("id", raw.id)
      await supabase.from("play_ratings").upsert(
        {
          user_id: user.id,
          elo: h2h.eloAfter,
          peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
          games_played: rating.gamesPlayed + 1,
          wins: rating.wins + (myOutcome === "win" ? 1 : 0),
          losses: rating.losses + (myOutcome === "loss" ? 1 : 0),
          draws: rating.draws + (myOutcome === "draw" ? 1 : 0),
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

/** Resolve a public display name for a user via the leaderboard views. */
export async function displayNameFor(userId: string | null): Promise<string> {
  if (!userId) return "Opponent"
  try {
    const supabase = createClient()
    const { data: play } = await supabase
      .from("play_leaderboard")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle()
    if (play?.display_name) return play.display_name as string
    const { data: solo } = await supabase
      .from("leaderboard")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle()
    return (solo?.display_name as string) || "Opponent"
  } catch {
    return "Opponent"
  }
}

// Re-export outcomeFor for callers that compute outcomes from scores/positions.
export { outcomeFor }
