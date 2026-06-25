// lib/solitaire-scoring.ts
// Tunable scoring for Solitaire Chess. Encapsulated here so the formula can be
// changed in one place. MVP model: exact-match, full points for a first-try
// correct guess, decaying partial credit for correct-after-retry, zero for a
// revealed/skipped move, all weighted by the game's difficulty.
//
// Extensible toward the "all users + difficulty-based scoring" future:
//   - difficultyMultiplier() centralizes how difficulty inflates the score.
//   - computeDifficulty() is a heuristic that a future pipeline can use to
//     (re)assign SolitaireGame.difficulty without touching gameplay code.

import type { SolitaireGame } from "./solitaire/types"
import { getCutoffPly } from "./solitaire/engine"

export type MoveOutcome = "first-try" | "retry" | "revealed" | "skipped"

export interface MoveResult {
  ply: number
  expectedSan: string
  /** Total guesses the learner made on this move (wrong guesses + the correct one). */
  attempts: number
  outcome: MoveOutcome
}

export interface ScoreConfig {
  /** Points a perfect (first-try) move is worth before the difficulty weight. */
  basePerMove: number
  /** Multiplier by attempt count: index 0 → 1st try, 1 → 2nd, 2 → 3rd, … */
  attemptMultipliers: number[]
  /** Floor multiplier for a matched move solved beyond the listed attempts. */
  retryFloor: number
  /** Difficulty (1–5) → score weight. */
  difficultyMultiplier: (difficulty: number) => number
}

function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(5, Math.round(d)))
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  basePerMove: 100,
  // 1st try → full, then decays. Any attempt beyond the list uses retryFloor.
  attemptMultipliers: [1, 0.6, 0.4, 0.25],
  retryFloor: 0.15,
  // d1 → 1.0×, d2 → 1.125×, …, d5 → 1.5×
  difficultyMultiplier: (d) => 1 + (clampDifficulty(d) - 1) * 0.125,
}

/**
 * Points earned for one move, before the difficulty weight.
 *
 * Guessing is unlimited, so `attempts` can be arbitrarily large. The multiplier
 * follows `attemptMultipliers` for the first few tries, then settles at the
 * `retryFloor` for any number of further tries — it decays monotonically and is
 * clamped to never drop below the floor or go negative. Revealed/skipped → 0.
 */
export function movePoints(result: MoveResult, config: ScoreConfig = DEFAULT_SCORE_CONFIG): number {
  if (result.outcome === "revealed" || result.outcome === "skipped") return 0
  const idx = Math.max(0, result.attempts - 1)
  const raw = config.attemptMultipliers[idx] ?? config.retryFloor
  const mult = Math.max(0, Math.max(config.retryFloor, raw))
  return config.basePerMove * mult
}

export interface ScoreSummary {
  totalMoves: number
  matched: number
  firstTry: number
  retried: number
  revealed: number
  skipped: number
  /** Sum of every guess the learner made (wrong + correct). */
  totalGuesses: number
  /** One per matched move. */
  correctGuesses: number
  /** correctGuesses / totalGuesses, 0–100 (the spec's headline accuracy). */
  accuracy: number
  /** matched / totalMoves, 0–100. */
  matchRate: number
  /** Longest run of consecutive first-try guesses. */
  bestStreak: number
  difficulty: number
  difficultyMultiplier: number
  /** Sum of movePoints before difficulty weight. */
  basePoints: number
  /** Final, difficulty-weighted score. */
  score: number
  /** Score if every move had been a first-try guess (for context/percent). */
  maxScore: number
  stars: 1 | 2 | 3
}

function longestFirstTryRun(results: MoveResult[]): number {
  let best = 0
  let run = 0
  for (const r of results) {
    if (r.outcome === "first-try") {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

export function starsFor(accuracy: number, matchRate: number): 1 | 2 | 3 {
  if (accuracy >= 85 && matchRate >= 90) return 3
  if (accuracy >= 60 && matchRate >= 60) return 2
  return 1
}

export function scoreSession(
  results: MoveResult[],
  difficulty: number,
  config: ScoreConfig = DEFAULT_SCORE_CONFIG
): ScoreSummary {
  const totalMoves = results.length
  let firstTry = 0
  let retried = 0
  let revealed = 0
  let skipped = 0
  let totalGuesses = 0
  let correctGuesses = 0
  let basePoints = 0

  for (const r of results) {
    totalGuesses += r.attempts
    if (r.outcome === "first-try") {
      firstTry += 1
      correctGuesses += 1
    } else if (r.outcome === "retry") {
      retried += 1
      correctGuesses += 1
    } else if (r.outcome === "revealed") {
      revealed += 1
    } else {
      skipped += 1
    }
    basePoints += movePoints(r, config)
  }

  const matched = firstTry + retried
  const accuracy = totalGuesses > 0 ? Math.round((correctGuesses / totalGuesses) * 100) : 0
  const matchRate = totalMoves > 0 ? Math.round((matched / totalMoves) * 100) : 0
  const difficultyMultiplier = config.difficultyMultiplier(difficulty)
  const score = Math.round(basePoints * difficultyMultiplier)
  const maxScore = Math.round(totalMoves * config.basePerMove * difficultyMultiplier)

  return {
    totalMoves,
    matched,
    firstTry,
    retried,
    revealed,
    skipped,
    totalGuesses,
    correctGuesses,
    accuracy,
    matchRate,
    bestStreak: longestFirstTryRun(results),
    difficulty: clampDifficulty(difficulty),
    difficultyMultiplier,
    basePoints,
    score,
    maxScore,
    stars: starsFor(accuracy, matchRate),
  }
}

const DIFFICULTY_LABELS = ["", "Gentle", "Easy", "Intermediate", "Hard", "Master"]

export function difficultyLabel(difficulty: number): string {
  return DIFFICULTY_LABELS[clampDifficulty(difficulty)] ?? "Intermediate"
}

/**
 * Heuristic difficulty (1–5) for a game, intended for a future auto-rating
 * pipeline. Not used by the MVP UI (games ship with a hand-set difficulty),
 * but provided so difficulty can be recomputed without code changes elsewhere.
 * Blends game length (longer = harder to follow) with branching/sharpness
 * (captures + checks per move as a rough proxy for tactical density).
 */
export function computeDifficulty(game: SolitaireGame): number {
  const cutoff = getCutoffPly(game)
  const moves = game.moves.slice(0, cutoff)
  if (moves.length === 0) return 1
  const sharp = moves.filter((m) => /[x+#]/.test(m)).length / moves.length
  const lengthScore = Math.min(1, cutoff / 80) // 0–1, saturates near move 40
  const blended = 0.55 * lengthScore + 0.45 * sharp
  return Math.max(1, Math.min(5, Math.round(1 + blended * 4)))
}
