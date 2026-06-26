// lib/solitaire/engine.ts
// Pure chess helpers for Solitaire Chess: positions, the move-50 / end-of-game
// cutoff, SAN comparison, and start-position bounds. No React, no side effects.

import { Chess, type Move } from "chess.js"
import type { SolitaireGame, Side } from "./types"

/** Full move 50 = 100 half-moves. We never play beyond this. */
export const MOVE_50_PLY_CAP = 100

/** The standard chess starting position as a FEN. */
export const STANDARD_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/** Prefer leaving at least this many guesses when defaulting the start move. */
export const MIN_GUESSES = 3

/**
 * Last ply (exclusive) we will play: the earlier of the recorded game's end
 * (resignation / decisive result) and full move 50.
 */
export function getCutoffPly(game: SolitaireGame): number {
  return Math.min(game.moves.length, MOVE_50_PLY_CAP)
}

/** 0-indexed ply → 1-based full move number. */
export function fullMoveNumber(ply: number): number {
  return Math.floor(ply / 2) + 1
}

/** White plays even plies (0,2,…); Black plays odd plies (1,3,…). */
export function sideToMoveAt(ply: number): Side {
  return ply % 2 === 0 ? "white" : "black"
}

export function isUserPly(ply: number, side: Side): boolean {
  return sideToMoveAt(ply) === side
}

// ── Custom-start-aware variants ──────────────────────────────────────────────
// Curated master games start from the standard position, so ply parity alone
// tells you the side to move and the full-move number. Engine-generated games
// may instead start from a `startFen` (an opening's position or a pasted FEN),
// where ply 0 can be Black to move and the move counter need not begin at 1.
// These helpers offset by the start FEN so the play/results screens stay correct
// for both kinds of game; they reduce to the parity helpers above when there is
// no startFen.

/** Side to move at the game's starting position (White unless `startFen` says otherwise). */
export function startSideOf(game: SolitaireGame): Side {
  if (!game.startFen) return "white"
  return game.startFen.split(/\s+/)[1] === "b" ? "black" : "white"
}

/** Starting full-move number (1 unless `startFen` carries a different counter). */
function startFullMoveOf(game: SolitaireGame): number {
  if (!game.startFen) return 1
  const n = Number(game.startFen.split(/\s+/)[5])
  return Number.isFinite(n) && n > 0 ? n : 1
}

/** Side to move at `ply`, accounting for a custom start FEN. */
export function sideAtPly(game: SolitaireGame, ply: number): Side {
  const base = startSideOf(game) === "white" ? 0 : 1
  return (base + ply) % 2 === 0 ? "white" : "black"
}

/** 1-based full-move number at `ply`, accounting for a custom start FEN. */
export function moveNumberAtPly(game: SolitaireGame, ply: number): number {
  const blackStart = startSideOf(game) === "black" ? 1 : 0
  return startFullMoveOf(game) + Math.floor((ply + blackStart) / 2)
}

/** Whether `ply` belongs to `side`, accounting for a custom start FEN. */
export function isUserPlyIn(game: SolitaireGame, ply: number, side: Side): boolean {
  return sideAtPly(game, ply) === side
}

/** A fresh Chess instance advanced through the first `ply` half-moves. */
export function chessAt(game: SolitaireGame, ply: number): Chess {
  const chess = game.startFen ? new Chess(game.startFen) : new Chess()
  const limit = Math.min(ply, game.moves.length)
  for (let i = 0; i < limit; i++) chess.move(game.moves[i])
  return chess
}

/** FEN after replaying the first `ply` half-moves. */
export function fenAfter(game: SolitaireGame, ply: number): string {
  return chessAt(game, ply).fen()
}

/** Indices (plies) the learner is responsible for, within the cutoff. */
export function userPlies(game: SolitaireGame, side: Side, startPly = 0): number[] {
  const cutoff = getCutoffPly(game)
  const plies: number[] = []
  for (let p = startPly; p < cutoff; p++) if (isUserPlyIn(game, p, side)) plies.push(p)
  return plies
}

export interface StartPlyBounds {
  /** Earliest start (the very first half-move of the game). */
  minPly: number
  /** Latest start that still leaves enough of the learner's moves to guess. */
  maxPly: number
  /** Default start ply (move 1). */
  defaultPly: number
}

/**
 * Bounds for the single-ply start selector. The learner may begin on ANY
 * half-move from the opening up to a ply that still leaves at least one guess
 * (ideally MIN_GUESSES). The start ply may belong to either side — if it is the
 * opponent's move, the play screen auto-plays it first. The default is move 1.
 *
 * A per-game `maxStartMove` cap (a full-move number) further lowers the upper
 * bound to the ply at which `side` plays that move, so the learner can start up
 * to and including move N, never past it.
 */
export function getStartPlyBounds(game: SolitaireGame, side: Side): StartPlyBounds {
  const plies = userPlies(game, side, 0)
  if (plies.length === 0) return { minPly: 0, maxPly: 0, defaultPly: 0 }
  const target = Math.min(MIN_GUESSES, plies.length)
  let maxPly = plies[plies.length - target]

  // Per-game cap: the latest ply at which `side` makes full move `maxStartMove`.
  if (game.maxStartMove != null) {
    const capPly = (game.maxStartMove - 1) * 2 + (side === "black" ? 1 : 0)
    maxPly = Math.min(maxPly, Math.max(0, capPly))
  }
  maxPly = Math.max(0, maxPly)

  return { minPly: 0, maxPly, defaultPly: 0 }
}

/** How many guesses the learner will make for a given start configuration. */
export function guessCount(game: SolitaireGame, side: Side, startPly: number): number {
  return userPlies(game, side, startPly).length
}

const ANNOTATION = /[+#!?]/g

/** Strip check/mate/annotation glyphs so "Nf6", "Nf6+", "Nf6!" all compare equal. */
export function normalizeSan(san: string): string {
  return san.replace(ANNOTATION, "")
}

/** Compare two SAN strings ignoring +, #, ! and ? decorations. */
export function sanMatches(a: string, b: string): boolean {
  return normalizeSan(a) === normalizeSan(b)
}

/** Which side won, derived from the recorded result. */
export function winnerOf(result: SolitaireGame["result"]): Side | null {
  if (result === "1-0") return "white"
  if (result === "0-1") return "black"
  return null
}

/**
 * The side the learner plays: always the winning side. Draws / non-decisive
 * results have no winner, so we fall back to White.
 */
export function playableSide(game: SolitaireGame): Side {
  return winnerOf(game.result) ?? "white"
}

// ── Mechanical move facts ────────────────────────────────────────────────────
// Plain, *factual* descriptions of what a move did, derived directly from the
// chess.js Move object. These are mechanical truths (a capture is a capture),
// NOT chess analysis or move-quality judgments — so they are always correct and
// safe to show learners. They intentionally do NOT assign "!"/"?" quality NAGs,
// which would require (and risk) subjective analysis.

const PIECE_NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * A short factual description of a move (e.g. "Bishop captures the knight, with
 * check", "Castles kingside", "Checkmate!"). Returns null for quiet moves with
 * nothing notable to report, so the UI stays uncluttered.
 */
export function describeMove(move: Move): string | null {
  const isMate = move.san.includes("#")
  const isCheck = move.san.includes("+")
  const piece = PIECE_NAMES[move.piece] ?? "piece"
  const captured = move.captured ? PIECE_NAMES[move.captured] ?? "piece" : null
  const promo = move.promotion ? PIECE_NAMES[move.promotion] ?? "queen" : null

  let action: string | null = null
  if (move.flags.includes("k")) {
    action = "Castles kingside"
  } else if (move.flags.includes("q")) {
    action = "Castles queenside"
  } else if (promo) {
    action = captured
      ? `Pawn captures the ${captured} and promotes to a ${promo}`
      : `Pawn promotes to a ${promo}`
  } else if (move.flags.includes("e")) {
    action = "Pawn captures en passant"
  } else if (captured) {
    action = `${capitalize(piece)} captures the ${captured}`
  }

  if (isMate) {
    return action ? `${action} — checkmate!` : `${capitalize(piece)} delivers checkmate!`
  }
  if (isCheck) {
    return action ? `${action}, with check` : `${capitalize(piece)} gives check`
  }
  return action
}

/** Build the chess.js Move object for a given ply (for describeMove, etc.). */
export function moveAt(game: SolitaireGame, ply: number): Move | null {
  if (ply < 0 || ply >= game.moves.length) return null
  const board = chessAt(game, ply)
  try {
    return board.move(game.moves[ply])
  } catch {
    return null
  }
}

/** Convenience: the factual description for a given ply (or null). */
export function moveFactAt(game: SolitaireGame, ply: number): string | null {
  const mv = moveAt(game, ply)
  return mv ? describeMove(mv) : null
}
