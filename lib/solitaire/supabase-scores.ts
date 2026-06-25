// lib/solitaire/supabase-scores.ts
// Best-effort write of a Solitaire score to a (future) `solitaire_scores` table.
//
// The Supabase project is read-only via MCP for us, so the table may not exist
// yet. This module feature-detects the table at runtime and NEVER throws: if
// the table is absent (or the user is signed out, or anything fails), it
// silently reports back without crashing the results screen. A migration to
// create the table ships in supabase/migrations/002_solitaire_scores.sql.

import { createClient } from "@/lib/supabase/client"
import type { StoredScore } from "./storage"

export type PersistResult = "saved" | "no-table" | "skipped"

function looksLikeMissingTable(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ""
  const msg = (error.message ?? "").toLowerCase()
  return (
    code === "42P01" || // postgres: undefined_table
    code === "PGRST205" || // postgrest: table not found in schema cache
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  )
}

export async function persistScoreToSupabase(score: StoredScore): Promise<PersistResult> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return "skipped"

    const { error } = await supabase.from("solitaire_scores").insert({
      user_id: user.id,
      game_id: score.gameId,
      side: score.side,
      score: score.score,
      accuracy: score.accuracy,
      moves_matched: score.matched,
      total_moves: score.totalMoves,
      best_streak: score.bestStreak,
      difficulty: score.difficulty,
    })

    if (error) {
      return looksLikeMissingTable(error) ? "no-table" : "skipped"
    }
    return "saved"
  } catch {
    // Network / config / unexpected — never let persistence break the UI.
    return "skipped"
  }
}
