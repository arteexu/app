// lib/multiplayer/types.ts
// Serializable shapes for Multiplayer Mode (async competitive Solitaire).

import type { SolitaireGame, Side } from "@/lib/solitaire/types"

/** A game in the shared, cross-user pool everyone can compete on. */
export interface SharedGame {
  /** The full playable game (stable id shared by every user). */
  game: SolitaireGame
  /** Where it came from. Curated master games vs promoted engine self-play. */
  source: "curated" | "generated"
  /** The side a competitor plays (always the winning side, like single-player). */
  side: Side
  /** ISO timestamp the game entered the pool (curated games sort last/oldest). */
  createdAt: string | null
}

/** One row of a per-game leaderboard (each player's best on a game). */
export interface GameLeaderboardRow {
  userId: string
  displayName: string
  side: Side
  score: number
  accuracy: number
  matchRate: number
  movesMatched: number
  totalMoves: number
  bestStreak: number
  difficulty: number
  createdAt: string
  /** 1-based rank within the game (computed client-side). */
  rank: number
  /** True when this row belongs to the signed-in user. */
  isMe: boolean
}

/** One row of the global Elo leaderboard. */
export interface RatingLeaderboardRow {
  userId: string
  displayName: string
  elo: number
  peakElo: number
  gamesPlayed: number
  rank: number
  isMe: boolean
}

/** A user's current competitive rating. */
export interface UserRating {
  elo: number
  peakElo: number
  gamesPlayed: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Matchmaking (ranked head-to-head)
// ─────────────────────────────────────────────────────────────────────────────

export type OpponentKind = "live" | "ghost" | "bot"

/** A paired match plus the game to play, returned by findMatch(). */
export interface MatchAndGame {
  matchId: string
  /** The shared game both players solve (same id for both). */
  game: SolitaireGame
  /** The side to solve (the game's winning side), same for both players. */
  side: Side
  /** Which side of the match the current user is (initiator = "a"). */
  role: "a" | "b"
  opponentKind: OpponentKind
  /** Display name of the opponent (or a bot/ghost label). */
  opponentLabel: string
  /** Opponent's score if already known (ghost/bot); null while a live opp plays. */
  opponentScore: number | null
  /** Opponent's Elo snapshot used for the head-to-head update. */
  opponentEloBefore: number
  /** The current user's Elo before this match. */
  myEloBefore: number
}

/** Result of submitting a score to a match. */
export interface MatchResultOutcome {
  /** "complete" when both scores are in (or ghost/bot); "pending" if waiting. */
  status: "complete" | "pending"
  /** Whether the result/rating persisted to Supabase. */
  persisted: boolean
  reason?: "signed-out" | "no-backend" | "error"
  opponentKind: OpponentKind
  opponentLabel: string
  myScore: number
  /** Opponent's score (null while waiting for a live opponent). */
  opponentScore: number | null
  /** win/loss/draw from the current user's perspective (null while pending). */
  outcome: "win" | "loss" | "draw" | null
  eloBefore: number
  eloAfter: number
  eloDelta: number
}

/** Outcome of recording one competitive attempt. */
export interface CompetitiveResult {
  /** Whether the score + rating were persisted to Supabase. */
  persisted: boolean
  /** Reason persistence was skipped, if any (signed-out / no backend tables). */
  reason?: "signed-out" | "no-backend" | "error"
  eloBefore: number
  eloAfter: number
  eloDelta: number
  /** Score to beat used for this match. */
  par: number
  /** How many OTHER players had played this game (the field size). */
  fieldSize: number
  /** The player's 1-based rank on this game after submitting (1 = best). */
  rank: number
  /** Total competitors on this game (including the player). */
  totalPlayers: number
}
