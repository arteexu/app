import type { MoveQuality } from "./move-quality"

// ─── Board Annotations ────────────────────────────────────────────────────────

export interface BoardArrow {
  from: string   // e.g. "e2"
  to: string     // e.g. "e4"
  color?: string // defaults to "#f6a623"
}

export interface BoardAnnotations {
  arrows?: BoardArrow[]
  highlightSquares?: Record<string, string> // square → css color
}

// ─── Step Types ───────────────────────────────────────────────────────────────

export type StepType =
  | "concept"
  | "puzzle"
  | "continuation"
  | "play-vs-bot"
  | "multiple-choice"
  | "identify"

// ─── Concept Step ─────────────────────────────────────────────────────────────
// Read-only visual explanation. Always the first step in a lesson. Not graded.

export interface ConceptStage {
  body: string           // plain text with **bold** support
  fen?: string           // optional override; inherits step.fen when omitted
  annotations?: BoardAnnotations
  buttonLabel?: string   // defaults to "Next →" or "Got it →" on the final stage
}

export interface ConceptStep {
  type: "concept"
  id: string
  title: string
  body: string           // plain text with **bold** support (ignored when stages is set)
  fen?: string           // optional board position to display
  annotations?: BoardAnnotations
  analogy?: string       // optional alternative framing
  stages?: ConceptStage[] // when set, learner clicks through each stage before continuing
}

// ─── Puzzle Step ──────────────────────────────────────────────────────────────
// The learner plays moves on the board to solve a position. Graded move by move.

export type PuzzleSubType =
  | "checkmate-in-n"    // forced mate in N moves
  | "best-move"         // find the single best move
  | "mate-threat"       // create an unstoppable mate threat
  | "find-refutation"   // given a bad move, find the refutation

export interface PuzzleLine {
  // Alternating moves: [white_move, black_response, white_move, ...]
  // From the learner's perspective — they play the odd-indexed moves (0, 2, 4…)
  moves: string[]   // SAN notation: ["Qh5", "Nc6", "Qxf7#"]
  // Optional: for each learner move index, a map of wrong-move SAN → explanation
  wrongMoveExplanations?: Record<number, Record<string, string>>
  // Optional: show a refutation line for a specific wrong move
  refutationLines?: Record<number, Record<string, string[]>>  // step → wrong move → refutation moves
  // Optional: for each learner move index, a map of SAN → feedback for moves that
  // are recognized as good/correct but are NOT the intended solution. These are
  // neither accepted (the puzzle does not advance) nor treated as plain wrong
  // moves — the learner is encouraged to keep looking for the best move.
  alternatives?: Record<number, Record<string, string>>
}

// The position and move BEFORE the puzzle starts — lets the learner step back
// to see what the opponent just played and why it was a blunder.
export interface PuzzlePreMove {
  fen: string                          // position before the opponent's move
  san: string                          // e.g. "Rxb1" — displayed on the toggle button
  annotation?: string                  // optional explanation of why it was a blunder
  arrows?: BoardArrow[]                // arrows showing the opponent's move
  highlightSquares?: Record<string, string>  // squares to highlight in that view
}

export interface PuzzleStep {
  type: "puzzle"
  id: string
  subType: PuzzleSubType
  question: string          // e.g. "White to move. Find checkmate in 2."
  fen: string               // starting position in FEN
  orientation?: "white" | "black"  // whose perspective (default: white)
  solution: PuzzleLine
  annotations?: BoardAnnotations   // shown before the learner starts
  successMessage?: string          // shown on completion
  explanation: string              // shown after solving (or after all retries)
  preMovePosition?: PuzzlePreMove  // optional: opponent's previous move, for context
  keyConceptId?: string            // unlocks a key concept when this step is solved
  keyConceptIds?: string[]         // unlocks multiple key concepts when this step is solved
  tacticalPatternId?: string       // unlocks a tactical pattern when this step is solved
  tacticalPatternIds?: string[]    // unlocks multiple tactical patterns when this step is solved
  /** When set, unlock tacticalPatternId as soon as the learner correctly plays this move index (0-based). */
  tacticalPatternUnlockMoveIndex?: number
  /** move index in solution.moves → tactical pattern unlocked when that learner move is played correctly. */
  tacticalPatternUnlocks?: Record<number, string>
  /** move index in solution.moves → quality marker (notation color + piece badge). */
  moveQualities?: Record<number, MoveQuality>
  /** Delay in ms before the opponent reply after each learner move (0-based index). Default 400. */
  responseDelayMs?: Record<number, number>
}

// ─── Continuation Step ────────────────────────────────────────────────────────
// Non-graded. Learner steps through a predefined line to see how it unfolds.

export interface ContinuationStep {
  type: "continuation"
  id: string
  title: string
  description: string
  fen: string               // starting position
  orientation?: "white" | "black"
  moves: string[]           // SAN moves in order
  moveAnnotations?: Record<number, string>  // move index → explanation shown at that move
  /** move index → board arrows/highlights shown while stepping at that move. */
  moveBoardAnnotations?: Record<number, BoardAnnotations>
  /** move index → quality marker (notation color + piece badge when that move is shown). */
  moveQualities?: Record<number, MoveQuality>
  annotations?: BoardAnnotations
  tacticalPatternId?: string
  tacticalPatternIds?: string[]
}

// ─── Play vs Bot Step ─────────────────────────────────────────────────────────
// Learner plays from a position against a random-legal-mover bot.

export interface PlayVsBotStep {
  type: "play-vs-bot"
  id: string
  question: string
  fen: string
  orientation?: "white" | "black"
  objective: string              // shown to learner: "Deliver checkmate"
  maxMoves?: number              // optional move limit
  successCondition: "checkmate" | "material-gain" | "any-capture"
  explanation: string
}

// ─── Multiple Choice Step ─────────────────────────────────────────────────────
// Strategic/conceptual question. No board interaction required.

export interface MultipleChoiceOption {
  text: string
  explanation: string  // shown after selection
}

export interface MultipleChoiceStep {
  type: "multiple-choice"
  id: string
  question: string
  fen?: string         // optional board to display alongside options
  annotations?: BoardAnnotations
  options: MultipleChoiceOption[]
  correctIndex: number
  hint?: string
}

// ─── Identify Step ────────────────────────────────────────────────────────────
// Learner clicks a square or piece to answer a factual tactical question.

export interface IdentifyStep {
  type: "identify"
  id: string
  question: string          // e.g. "Click the piece that is pinned."
  fen: string
  orientation?: "white" | "black"
  correctSquare: string     // e.g. "f3"
  explanation: string
  hint?: string
}

// ─── Move Multiple Choice Step ────────────────────────────────────────────────
// Shows 4 candidate moves as buttons. Clicking one plays it on the board with
// a highlight, then shows per-move feedback. Correct move only: play it and
// show "Correct". Incorrect moves: show feedback + optional "Reveal explanation".

export interface MoveCandidate {
  san: string
  isCorrect: boolean
  shortFeedback: string   // shown immediately (e.g. "Very forcing, but black holds.")
  explanation?: string    // shown after "Reveal explanation" is clicked
  continuation?: string[] // bot moves to auto-play after correct (e.g. black's response)
}

export interface MoveMultipleChoice {
  type: "move-multiple-choice"
  id: string
  question: string
  fen: string
  orientation?: "white" | "black"
  candidates: MoveCandidate[]
  successMessage?: string
  keyConceptId?: string
  keyConceptIds?: string[]
}

// ─── Find All Checkmates Step ─────────────────────────────────────────────────
// Board-vision exercise: find every mating move from the given position.
// The board resets after each found checkmate until all are discovered.

export interface FindAllCheckmates {
  type: "find-all-checkmates"
  id: string
  question: string
  fen: string
  orientation?: "white" | "black"
  checkmates: string[]      // all target mating moves in SAN (e.g. ["Qf8#", "Qg8#"])
  explanation: string       // shown when all are found
  successMessage?: string
  keyConceptId?: string
  keyConceptIds?: string[]
}

export type Step =
  | ConceptStep
  | PuzzleStep
  | ContinuationStep
  | PlayVsBotStep
  | MultipleChoiceStep
  | IdentifyStep
  | FindAllCheckmates
  | MoveMultipleChoice

// ─── Course Structure ─────────────────────────────────────────────────────────

export interface Lesson {
  id: string
  title: string
  description: string
  estimatedMinutes: number
  steps: Step[]
  keyConceptIds?: string[]
  tacticalPatternIds?: string[]
}

export interface Section {
  id: string
  title: string
  lessons: Lesson[]
}

export interface Chapter {
  id: string
  title: string
  description: string
  lessons: Lesson[]
  /** Optional grouped lessons shown under section headings within a chapter. */
  sections?: Section[]
}

export interface Course {
  id: string
  title: string
  description: string
  subject: string
  chapters: Chapter[]
}

// ─── Progress / DB ────────────────────────────────────────────────────────────

export interface UserProgress {
  userId: string
  courseId: string
  lessonId: string
  completedStepIds: string[]
  isLessonComplete: boolean
  completedAt?: string
}

export interface UserStreak {
  userId: string
  currentStreak: number
  longestStreak: number
  lastActivityDate: string
}

export interface LessonAttempt {
  userId: string
  lessonId: string
  stepId: string
  isCorrect: boolean
  attemptedAt: string
}
