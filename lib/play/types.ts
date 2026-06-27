// lib/play/types.ts
// Shared serializable shapes for the full-chess "Play" feature (vs Bot and live
// vs Human). Kept framework-agnostic so both the engine/bot path and the
// Supabase Realtime path reuse the same vocabulary.

export type PieceColor = "white" | "black"

/** Player's chosen side at setup. "random" is resolved to white/black on start. */
export type ColorChoice = PieceColor | "random"

/** How a finished game ended (mirrors the play_games.end_reason check). */
export type EndReason =
  | "checkmate"
  | "resign"
  | "timeout"
  | "stalemate"
  | "draw_agreement"
  | "insufficient_material"
  | "threefold"
  | "fifty_move"
  | "abandon"

/** The decided result of a finished game. */
export interface GameResult {
  winner: PieceColor | "draw"
  reason: EndReason
}

/** PGN result tag for a winner/draw. */
export function resultTag(winner: PieceColor | "draw"): "1-0" | "0-1" | "1/2-1/2" {
  if (winner === "white") return "1-0"
  if (winner === "black") return "0-1"
  return "1/2-1/2"
}

/** A base + increment (Fischer) time control. */
export interface TimeControl {
  /** Stable id, e.g. "5+0". */
  id: string
  /** Human label, e.g. "Blitz". */
  label: string
  /** Starting time per side, in seconds. */
  baseSeconds: number
  /** Increment added after each move, in seconds. */
  incrementSeconds: number
}

/** One labeled bot strength preset. */
export interface BotLevel {
  /** Stable id stored on the game, e.g. "intermediate". */
  id: string
  label: string
  /** A short blurb shown in the picker. */
  blurb: string
  /** UCI "Skill Level" (0–20). Lower = weaker / more mistakes. */
  skill: number
  /**
   * When set, the engine is run with UCI_LimitStrength + UCI_Elo for a more
   * calibrated strength. Some lite builds ignore it; skill is the fallback.
   */
  uciElo?: number
  /** Per-move think budget (ms). Weaker levels think less. */
  moveTimeMs: number
  /** Nominal Elo used for the head-to-head Play-rating update. */
  nominalElo: number
}

/** A single played half-move, enough to render a move list + step back. */
export interface PlayedMove {
  ply: number
  san: string
  uci: string
  fenAfter: string
  color: PieceColor
}

/** The play_ratings row for a user (separate from the Solitaire ladder). */
export interface PlayRating {
  elo: number
  peakElo: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
}

export const PLAY_BASELINE_ELO = 1200
