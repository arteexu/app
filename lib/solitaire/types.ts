// lib/solitaire/types.ts
// Core data model for Solitaire Chess (follow a master game and guess the moves).
// Kept deliberately small and serializable so the same shapes flow from the
// curated JSON → loader → gameplay → scoring → persistence.

export type Side = "white" | "black"

export type GameResult = "1-0" | "0-1" | "1/2-1/2"

/** Chronological era buckets for grouping games by year. */
export type Era = "Classics" | "Legend Era" | "Engine Era" | "Modern"

/**
 * A single curated master game. The `moves` array is the full SAN move list,
 * validated (every ply legal) through chess.js at build time.
 *
 * Designed to be extensible toward the "all users + difficulty-based scoring"
 * future: `difficulty` is a stored field (1–5) that a smarter heuristic or an
 * AI rater can overwrite later without changing any consumer.
 */
export interface SolitaireGame {
  id: string
  title: string
  opening: string
  eco: string
  white: string
  black: string
  event: string | null
  year: number | null
  result: GameResult
  /** 1 (gentle) – 5 (master). Stored so it can be recomputed/improved later. */
  difficulty: number
  /**
   * Optional per-game cap on how far the learner may skip ahead: the latest
   * FULL MOVE number at which they may begin guessing their side's move. The
   * start-ply selector's upper bound becomes min(default upper bound, this cap),
   * so the learner can start anywhere up to and including move `maxStartMove`,
   * never past it. Omit for no extra cap.
   */
  maxStartMove?: number
  note: string
  /**
   * Optional starting position (FEN) the `moves` are played from. Omit for games
   * that begin from the standard initial position (the curated master games all
   * do). Used by engine-generated games that start from a chosen opening or a
   * custom FEN — `moves` then lists the engine's play from this position, and the
   * side-to-move / move-number helpers derive their offset from this FEN.
   */
  startFen?: string
  /**
   * True for transient engine-vs-engine games produced by the "Generate a game"
   * flow (see lib/solitaire/generate.ts). The curated master games omit this.
   * The play screen uses it to offer a "Skip to end" shortcut that jumps straight
   * to the results/final position without solving the whole line.
   */
  isGenerated?: boolean
  /** Full game in SAN, e.g. ["e4", "c5", "Nf3", …]. Every entry is legal. */
  moves: string[]
  /**
   * Optional per-move authored annotations, keyed by ply index (0-based).
   *
   * RESERVED for verifiable, human-authored content — the curated games
   * currently ship WITHOUT this (the source PGNs were bare gamescores and we
   * never fabricate analysis). All fields are optional and rendered only when
   * present, so games without annotations work unchanged. This is distinct from
   * the always-correct, auto-generated mechanical facts in describeMove().
   *
   * See content/solitaire/README.md for the authoring guide. Example shape
   * (ply 24 = White's move 13 in some game):
   *
   *   "annotations": {
   *     "24": {
   *       "comment": "The point of the whole combination.",
   *       "explanation": "Rxd7 removes the only defender of e5; after …Rxd7 the back rank collapses.",
   *       "alternatives": [
   *         { "san": "Qxb7", "label": "Tempting", "note": "Wins a pawn, but lets Black consolidate with …Rd8." }
   *       ]
   *     }
   *   }
   */
  annotations?: Record<number, MoveAnnotation>
}

/**
 * Authored annotation for one ply (half-move). Every field is optional; the
 * play UI shows whatever is present and nothing when the move is unannotated.
 */
export interface MoveAnnotation {
  /** Short inline note shown with the move feedback once it's played. */
  comment?: string
  /** Longer authored note, revealed on demand via a "Reveal explanation" button. */
  explanation?: string
  /** Recognized strong-but-not-best moves that get tailored feedback if guessed. */
  alternatives?: MoveAlternative[]
}

/** A "close second" move the author wants to acknowledge with custom feedback. */
export interface MoveAlternative {
  /** SAN of the alternative (matched ignoring +, #, ! and ? decorations). */
  san: string
  /** Optional short tag, e.g. "Strong alternative" or "Tempting". */
  label?: string
  /** Why it's only a close second / what the grandmaster's move does better. */
  note: string
}

/** A fully-resolved configuration produced by the setup screen. */
export interface SolitaireSetup {
  game: SolitaireGame
  side: Side
  /** Number of half-moves already played before the learner's first guess. */
  startPly: number
}
