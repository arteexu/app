// lib/commentary/types.ts
// Shared types for the CCC-style concept-grounded commentary layer.
// See the design spec: engine features + taxonomy tags → grounded LLM prompt.

import type { KeyConceptId } from "@/lib/key-concepts"
import type { TacticalPatternId } from "@/lib/tactical-patterns"
import type { ConceptScore, PrioritizedConcept } from "./concepts"

export type { KeyConceptId, TacticalPatternId }
export type { ConceptScore, PrioritizedConcept } from "./concepts"

export type Side = "w" | "b"
export type GamePhase = "opening" | "middlegame" | "endgame"

export type MoveClassification =
  | "brilliant" // (near-)best AND a sound sacrifice
  | "best"      // matches engine best move
  | "good"      // small cp loss
  | "inaccuracy"
  | "mistake"
  | "blunder"

/** A single enemy piece attacked after the move (for the anti-hallucination list). */
export interface AttackFact {
  bySquare: string // the attacking piece's square, e.g. "c7"
  byPiece: string // uppercase piece letter, e.g. "N"
  targetSquare: string // e.g. "a8"
  targetPiece: string // lowercase piece letter, e.g. "r"
  givesCheck: boolean // target is the enemy king
  defended: boolean // target has at least one defender
}

export interface HangingFact {
  square: string
  piece: string // lowercase piece letter
  color: Side
  attackedBy: string[] // squares of enemy attackers
  defendedBy: string[] // squares of own defenders
}

/** An engine candidate move (from MultiPV), mover-perspective evals. */
export interface CandidateLine {
  san: string // the candidate move in SAN
  evalCp: number // backed-up eval of the line, mover POV (centipawns)
  mate: number | null // mate distance (mover POV) if the line is a forced mate
  pvSan: string[] // full principal variation in SAN
  endEvalCp: number // eval at the end of the PV (== backed-up line eval), mover POV
}

/** A line showing why a move is bad / what the consequence is, mover-perspective. */
export interface RefutationLine {
  ofMoveSan: string // the move being refuted / evaluated
  pvSan: string[] // the line in SAN (starts with ofMoveSan)
  endEvalCp: number // eval at the end of the line, mover POV
}

export type CommentaryMode = "default" | "rigorous"

/** All grounded features for ONE move — the unit fed to the LLM. */
export interface ConceptRecord {
  // Position / move identity
  fenBefore: string
  fenAfter: string
  moveSan: string
  moveUci: string
  side: Side // who played the move (= sideToMove(fenBefore))
  phase: GamePhase

  // Evaluation — all from the MOVER's perspective (positive = good for mover).
  evalBeforeCp: number // best-play eval before the move
  evalAfterCp: number // eval after the played move
  evalDeltaCp: number // evalAfterCp - evalBeforeCp (negative = move worsened it)
  mateBefore: number | null // mover POV mate distance (null when not a mate)
  mateAfter: number | null
  cpLoss: number // max(0, -evalDeltaCp), used for classification

  classification: MoveClassification

  // Engine context
  bestMoveSan: string | null
  bestMoveUci: string | null
  playedIsBest: boolean
  topPvSan: string[] // principal variation from fenBefore, in SAN

  // Phase 2: verified candidate lines (MultiPV) + refutation/consequence lines.
  candidates: CandidateLine[]
  refutations: RefutationLine[]

  // Tactical grounding (computed with chess.js on fenAfter)
  materialDelta: number // mover material balance change (pawns), + = gained
  legalAttacks: AttackFact[] // enumerated to prevent hallucinated pieces/attacks
  hangingPieces: HangingFact[]

  // Taxonomy tags (real ids)
  matchedTacticalPatternIds: TacticalPatternId[]
  matchedKeyConceptIds: KeyConceptId[]

  // CCC concept taxonomy (Stockfish-style families) + concept-delta prioritization.
  // Optional for back-compat with prebuilt client records that predate this field.
  conceptScores?: ConceptScore[]
  prioritizedConcepts?: PrioritizedConcept[]

  // Personalization
  userRating?: number
}

export type CommentarySource = "llm" | "template"

/** Response shape returned by POST /api/commentary. */
export interface CommentaryResponse {
  comment: string
  source: CommentarySource
  classification: MoveClassification
  referencedBestMove?: string | null
  guardrail: { passed: boolean; failures: string[] }
  /** Why the template path was taken, when applicable (e.g. "no-key"). */
  reason?: string
  /** Present when the server built the ConceptRecord (server-side analysis). */
  record?: ConceptRecord
  /** Search depth actually reached by the analysis that produced `record`. */
  analysisDepth?: number
  /** Where the deep analysis ran. */
  analysisSource?: "client" | "server"
}

export interface CommentaryRequestBody {
  /** Prebuilt record (browser/client analysis). Optional when serverAnalysis. */
  record?: ConceptRecord
  exemplars?: string[]
  recurringMistakes?: string[]
  /** "rigorous" → stronger model + mandatory line-citation + line verification. */
  mode?: CommentaryMode
  /** When true (rigorous, no record), the server runs the deep analysis itself. */
  serverAnalysis?: boolean
  /** Minimal inputs for server-side analysis (used when `record` is absent). */
  fenBefore?: string
  moveSan?: string
  userRating?: number
}
