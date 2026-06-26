// lib/multiplayer/elo.ts
// ─────────────────────────────────────────────────────────────────────────────
// Elo rating system for competitive (asynchronous) Solitaire Chess.
//
// HOW A "MATCH" IS SCORED
// -----------------------
// Competitive Solitaire is asynchronous: players don't face each other live,
// they each play the SAME shared engine game and are scored with the identical
// formula from lib/solitaire-scoring.ts. We turn one completed game into one
// rated "match against the field":
//
//   * The "opponent" is the field of every OTHER player who has played that game.
//   * The opponent's rating is the AVERAGE Elo of those players (fieldRating).
//     With no other players yet (you're first), we fall back to BASELINE_RATING
//     (1200) so the very first attempt is still ratable.
//   * "Par" is the score to beat: the AVERAGE of the other players' best scores
//     on that game. With no other players, par is derived from the game itself
//     (PAR_FRACTION of a flawless run — see baselinePar()), so a first player is
//     graded against the game's own ceiling rather than a free win.
//
// EXPECTED vs ACTUAL
// ------------------
//   Expected E = 1 / (1 + 10^((fieldRating − playerElo) / 400))     [standard Elo]
//
//   Actual   S = clamp01( 0.5 + (score − par) / (2 · par) )
//     A continuous performance score in [0, 1]:
//       score == par      → 0.5   (you matched the field — a "draw")
//       score == 2 · par  → 1.0   (you doubled par — a clear "win")
//       score == 0        → 0.0   (a clear "loss")
//     Using a continuous S (instead of pure win/draw/loss) rewards the MARGIN by
//     which you beat or missed par, which is fairer for a score-based contest.
//
// UPDATE
// ------
//   newElo = round( playerElo + K · (S − E) )
//
// K-FACTOR SCHEDULE (provisional → stable), keyed on games already played:
//   < 10 games  → K = 40   (provisional: move fast to find the true rating)
//   < 30 games  → K = 24
//   otherwise   → K = 16   (stable)
//
// All ratings are clamped to [MIN_ELO, MAX_ELO] for sanity. Pure + deterministic
// so it is trivially unit-testable and is the single source of truth for the
// rating math (the UI and persistence layer call into here).

export const BASELINE_RATING = 1200
export const MIN_ELO = 100
export const MAX_ELO = 4000

/** Fraction of a flawless run that counts as "par" when you're first on a game. */
export const PAR_FRACTION = 0.6

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function clamp01(n: number): number {
  return clamp(n, 0, 1)
}

/** K-factor for a player who has completed `gamesPlayed` rated games. */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 40
  if (gamesPlayed < 30) return 24
  return 16
}

/** Standard Elo expected score for `playerElo` against `opponentElo`. */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400))
}

/**
 * Map a raw Solitaire score to a [0,1] match result against `par`.
 * par<=0 degrades gracefully to a win for any positive score.
 */
export function actualScore(score: number, par: number): number {
  if (par <= 0) return score > 0 ? 1 : 0.5
  return clamp01(0.5 + (score - par) / (2 * par))
}

/**
 * "Par" score for a player who is the FIRST to play a game (no field to compare
 * against). Derived from the game's own ceiling: PAR_FRACTION of a flawless run.
 * `maxScore` is the difficulty-weighted score of an all-first-try game (see
 * ScoreSummary.maxScore from lib/solitaire-scoring.ts).
 */
export function baselinePar(maxScore: number): number {
  return Math.round(maxScore * PAR_FRACTION)
}

export interface EloInput {
  /** The player's current Elo (BASELINE_RATING for a brand-new player). */
  playerElo: number
  /** How many rated games the player has already completed (for the K schedule). */
  gamesPlayed: number
  /** The player's just-earned, difficulty-weighted score on this game. */
  score: number
  /** Score to beat: average of other players' best scores (or baselinePar). */
  par: number
  /** Average Elo of the other players on this game (BASELINE_RATING if none). */
  fieldRating: number
}

export interface EloResult {
  eloBefore: number
  eloAfter: number
  delta: number
  /** Expected result E (0–1). */
  expected: number
  /** Actual result S (0–1). */
  actual: number
  kFactor: number
}

/** Compute the rating change for one completed competitive game. */
export function computeElo(input: EloInput): EloResult {
  const before = clamp(Math.round(input.playerElo), MIN_ELO, MAX_ELO)
  const k = kFactor(Math.max(0, input.gamesPlayed))
  const expected = expectedScore(before, input.fieldRating)
  const actual = actualScore(input.score, input.par)
  const after = clamp(Math.round(before + k * (actual - expected)), MIN_ELO, MAX_ELO)
  return {
    eloBefore: before,
    eloAfter: after,
    delta: after - before,
    expected,
    actual,
    kFactor: k,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAD-TO-HEAD Elo (used by ranked matchmaking)
// ─────────────────────────────────────────────────────────────────────────────
// Matchmaking pits a player against a single opponent (a live user, a ghost of
// another user's recorded attempt, or a par bot). Both solve the SAME game; the
// higher solitaire-scoring score wins, equal scores draw. This is the standard,
// textbook Elo pairwise update:
//
//   Expected E = 1 / (1 + 10^((opponentElo − playerElo) / 400))
//   Actual   S = 1 (win) | 0.5 (draw) | 0 (loss)
//   newElo     = round( playerElo + K · (S − E) )
//
// K-factor uses the SAME provisional→stable schedule as above (40 / 24 / 16 by
// games_played). In a LIVE match both players are updated symmetrically (each
// vs the other's Elo snapshot at match creation). In a GHOST/BOT match only the
// live player's rating changes — the opponent's stored Elo is used as a fixed
// reference and is never modified (they already played at their own time).

export type MatchOutcome = "win" | "loss" | "draw"

/** Decide the match outcome for `myScore` against `opponentScore` (tie = draw). */
export function outcomeFor(myScore: number, opponentScore: number): MatchOutcome {
  if (myScore > opponentScore) return "win"
  if (myScore < opponentScore) return "loss"
  return "draw"
}

export interface HeadToHeadInput {
  /** The player's current Elo (BASELINE_RATING for a brand-new player). */
  playerElo: number
  /** Rated games already played (drives the K schedule). */
  gamesPlayed: number
  /** The opponent's Elo (their snapshot at match time for live/ghost; 1200 bot). */
  opponentElo: number
  /** The match result from this player's perspective. */
  outcome: MatchOutcome
}

/** Standard pairwise Elo update for one head-to-head match. */
export function computeHeadToHead(input: HeadToHeadInput): EloResult {
  const before = clamp(Math.round(input.playerElo), MIN_ELO, MAX_ELO)
  const k = kFactor(Math.max(0, input.gamesPlayed))
  const expected = expectedScore(before, Math.round(input.opponentElo))
  const actual = input.outcome === "win" ? 1 : input.outcome === "draw" ? 0.5 : 0
  const after = clamp(Math.round(before + k * (actual - expected)), MIN_ELO, MAX_ELO)
  return {
    eloBefore: before,
    eloAfter: after,
    delta: after - before,
    expected,
    actual,
    kFactor: k,
  }
}
