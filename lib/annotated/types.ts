// lib/annotated/types.ts
// Data model for the "Annotated Master Games" step-through lessons.
//
// An AnnotatedGame is the fully pre-parsed, serializable shape stored under
// content/annotated-games/<id>.json. It is produced offline by
// scripts/ingest-annotated-pgn.mjs (see the `annotated-pgn-to-lesson` skill) so
// the app never parses PGN at runtime — it just renders this JSON.
//
// Every `fen` is computed and every `san` validated with chess.js at ingest
// time, so the player can trust the data is legal and self-consistent.

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*"

export interface AnnotatedGameHeaders {
  event?: string
  site?: string
  /** Raw PGN date string, e.g. "2018.11.28" (kept verbatim for provenance). */
  date?: string
  /** Resolved 4-digit year for display/sorting (may override a bad PGN date). */
  year?: number | null
  round?: string
  white: string
  black: string
  result: GameResult
  eco?: string
  annotator?: string
  /** Source URL from the [Link] / [Source] header, if present. */
  link?: string
}

/** A single move inside a sideline variation. */
export interface VariationMove {
  san: string
  /** FEN after this variation move was played. */
  fen: string
  comment?: string
  /** Display glyphs already mapped from NAG codes, e.g. ["!"], ["!?"]. */
  nags?: string[]
}

/**
 * A sideline: an alternative to the main-line move at ply `startsAfterPly + 1`.
 * The first entry in `moves` is played from the position *after* `startsAfterPly`
 * main-line plies (so its move number / side follow from `startsAfterPly + 1`).
 */
export interface Variation {
  /** Number of main-line plies played before this branch (0 = from the start). */
  startsAfterPly: number
  moves: VariationMove[]
  /** Optional comment introducing the whole line. */
  comment?: string
}

/** One half-move (ply) of the annotated main line. */
export interface AnnotatedPly {
  /** 1-based half-move index: 1 = White's first move. */
  ply: number
  /** 1-based full-move number (1.e4 → 1, 1...c5 → 1, 2.Nf3 → 2). */
  moveNumber: number
  side: "white" | "black"
  /** Canonical SAN with no NAG glyph (e.g. "Bc5", "Qe8+", "O-O"). */
  san: string
  /** FEN after this ply. */
  fen: string
  /** Display glyphs mapped from NAG codes, e.g. ["!"] for $1, ["!?"] for $5. */
  nags?: string[]
  /** The annotator's prose for this move. */
  comment?: string
  /** Sidelines the annotator gave as alternatives to this move. */
  variations?: Variation[]
}

/** A multiple-choice concept check attached to a specific annotated moment. */
export interface ConceptCheckOption {
  text: string
  explanation: string
}

export interface ConceptCheck {
  id: string
  /** The main-line ply this check is about; shown when the learner reaches it. */
  ply: number
  prompt: string
  options: ConceptCheckOption[]
  correctIndex: number
  hint?: string
}

export interface AnnotatedGame {
  id: string
  title: string
  description: string
  headers: AnnotatedGameHeaders
  plies: AnnotatedPly[]
  /** Authored separately from the PGN and merged in at ingest time. */
  conceptChecks?: ConceptCheck[]
}
