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

export interface ConceptStep {
  type: "concept"
  id: string
  title: string
  body: string           // plain text with **bold** support
  fen?: string           // optional board position to display
  annotations?: BoardAnnotations
  analogy?: string       // optional alternative framing
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
  annotations?: BoardAnnotations
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

export type Step =
  | ConceptStep
  | PuzzleStep
  | ContinuationStep
  | PlayVsBotStep
  | MultipleChoiceStep
  | IdentifyStep

// ─── Course Structure ─────────────────────────────────────────────────────────

export interface Lesson {
  id: string
  title: string
  description: string
  estimatedMinutes: number
  steps: Step[]
}

export interface Chapter {
  id: string
  title: string
  description: string
  lessons: Lesson[]
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
