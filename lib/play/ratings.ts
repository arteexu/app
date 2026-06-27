// lib/play/ratings.ts
// Read/update the SEPARATE Play Elo ladder (play_ratings). Uses the shared
// head-to-head Elo math (lib/multiplayer/elo.ts) but never touches the Solitaire
// user_ratings table. Each user writes only their own row (RLS), matching the
// deferred "self-service" pattern used by the existing matchmaking code.

import { createClient } from "@/lib/supabase/client"
import { computeHeadToHead, type MatchOutcome } from "@/lib/multiplayer/elo"
import { PLAY_BASELINE_ELO, type PlayRating } from "./types"

type SupabaseClient = ReturnType<typeof createClient>

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

export interface ReadRatingResult extends PlayRating {
  /** True when the play_ratings table/row could not be read (backend missing). */
  missing: boolean
}

const DEFAULT_RATING: PlayRating = {
  elo: PLAY_BASELINE_ELO,
  peakElo: PLAY_BASELINE_ELO,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
}

/** Read the signed-in user's Play rating (defaults for a brand-new player). */
export async function readPlayRating(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReadRatingResult> {
  const { data, error } = await supabase
    .from("play_ratings")
    .select("elo, peak_elo, games_played, wins, losses, draws")
    .eq("user_id", userId)
    .maybeSingle()
  if (error && looksLikeMissingTable(error)) {
    return { ...DEFAULT_RATING, missing: true }
  }
  return {
    elo: data?.elo ?? PLAY_BASELINE_ELO,
    peakElo: data?.peak_elo ?? data?.elo ?? PLAY_BASELINE_ELO,
    gamesPlayed: data?.games_played ?? 0,
    wins: data?.wins ?? 0,
    losses: data?.losses ?? 0,
    draws: data?.draws ?? 0,
    missing: false,
  }
}

export interface ApplyResultInput {
  /** Opponent Elo to rate against (bot nominal Elo, or live opponent snapshot). */
  opponentElo: number
  outcome: MatchOutcome
}

export interface ApplyResultOutcome {
  persisted: boolean
  reason?: "signed-out" | "no-backend" | "error"
  eloBefore: number
  eloAfter: number
  eloDelta: number
  outcome: MatchOutcome
}

/**
 * Apply a finished Play game to the user's own play_ratings row and return the
 * Elo change. Used by the Bot mode (vs the bot's nominal Elo) and as the
 * per-side writer for live games. Pure-Elo math is shared with Solitaire.
 */
export async function applyPlayResult(input: ApplyResultInput): Promise<ApplyResultOutcome> {
  const offline: ApplyResultOutcome = {
    persisted: false,
    eloBefore: PLAY_BASELINE_ELO,
    eloAfter: PLAY_BASELINE_ELO,
    eloDelta: 0,
    outcome: input.outcome,
  }
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ...offline, reason: "signed-out" }

    const rating = await readPlayRating(supabase, user.id)
    if (rating.missing) return { ...offline, reason: "no-backend" }

    const h2h = computeHeadToHead({
      playerElo: rating.elo,
      gamesPlayed: rating.gamesPlayed,
      opponentElo: input.opponentElo,
      outcome: input.outcome,
    })

    const { error: upErr } = await supabase.from("play_ratings").upsert(
      {
        user_id: user.id,
        elo: h2h.eloAfter,
        peak_elo: Math.max(rating.peakElo, h2h.eloAfter),
        games_played: rating.gamesPlayed + 1,
        wins: rating.wins + (input.outcome === "win" ? 1 : 0),
        losses: rating.losses + (input.outcome === "loss" ? 1 : 0),
        draws: rating.draws + (input.outcome === "draw" ? 1 : 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    if (upErr) return { ...offline, reason: looksLikeMissingTable(upErr) ? "no-backend" : "error" }

    return {
      persisted: true,
      eloBefore: h2h.eloBefore,
      eloAfter: h2h.eloAfter,
      eloDelta: h2h.delta,
      outcome: input.outcome,
    }
  } catch {
    return { ...offline, reason: "error" }
  }
}

/** Ensure the signed-in user has a play_ratings row (creates a baseline one). */
export async function ensurePlayRating(): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const rating = await readPlayRating(supabase, user.id)
    if (rating.missing) return
    if (rating.gamesPlayed === 0) {
      await supabase
        .from("play_ratings")
        .upsert(
          { user_id: user.id, elo: PLAY_BASELINE_ELO, peak_elo: PLAY_BASELINE_ELO },
          { onConflict: "user_id", ignoreDuplicates: true },
        )
    }
  } catch {
    /* ignore */
  }
}
