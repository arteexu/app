// lib/commentary/gcc-eval.ts
// GCC-Eval: GPT-based Chess Commentary Evaluation (Kim et al., NAACL 2025 §3.2,
// Appendix A). A rubric judge that scores a comment on four dimensions —
// relevance, completeness, clarity, fluency — each 1-5. Faithful to the paper:
//   - relevance/completeness get an EXPERT (engine) hint; clarity/fluency don't.
//   - Auto-CoT, "score ONLY" output.
//   - Weighted summation over the token probabilities of "1".."5" (Eq. 1) →
//     smooth non-integer scores. We implement this from chat-model logprobs, with
//     a single-integer parse as a fallback when logprobs are unavailable.
// This file is prompt/format logic only (no network); the route does the I/O.

import type { GccEvalDimension } from "./config"
import { GCC_EVAL_DIMENSIONS } from "./config"
import { buildEngineEvalHint } from "./prompt"
import type { ConceptRecord } from "./types"

export type { GccEvalDimension } from "./config"

/** Whether the dimension is augmented with the expert (engine) evaluation hint. */
const USES_ENGINE_HINT: Record<GccEvalDimension, boolean> = {
  relevance: true,
  completeness: true,
  clarity: false,
  fluency: false,
}

const CRITERIA: Record<GccEvalDimension, string> = {
  relevance:
    "Relevance (1-5) - Relevance of a target comment. The comment should include only " +
    "information relevant to the chess move or reasoning for taking or not taking the chess " +
    "move. An engine evaluation result is given as a hint.",
  completeness:
    "Completeness (1-5) - Completeness of a comment. The comment should cover all critical " +
    "points on the chess board, ensuring that no important factors are overlooked. An engine " +
    "evaluation result is given as a hint.",
  clarity:
    "Clarity (1-5) - Clarity of a comment. The comment should be clear and detailed, without " +
    "vague or ambiguous statements.",
  fluency:
    "Fluency (1-5) - Fluency of a comment. The comment should be coherently organized with " +
    "well-structured language and coherent transitions between sentences.",
}

const STEPS: Record<GccEvalDimension, string> = {
  relevance:
    "1. Read the comment carefully.\n2. Assess how well the comment addresses the important " +
    "information about the chess move, and how relevant it is.\n3. Assign a Relevance score from 1 to 5.",
  completeness:
    "1. Read the comment carefully.\n2. Assess how well the comment addresses the important " +
    "information, and how well the comment covers the entire important information without " +
    "missing any.\n3. Assign a Completeness score from 1 to 5.",
  clarity:
    "1. Read the comment carefully.\n2. Assess how the comment is clear and detailed, without " +
    "vague or ambiguous statements.\n3. Assign a Clarity score from 1 to 5.",
  fluency:
    "1. Read the comment carefully.\n2. Assess whether the sentences of the comment are " +
    "coherently organized.\n3. Assign a Fluency score from 1 (not readable) to 5 (very fluent).",
}

export interface GccEvalPrompt {
  system: string
  user: string
}

/** Build the GCC-Eval scoring prompt for one dimension (paper Appendix A shape). */
export function buildGccEvalPrompt(
  dimension: GccEvalDimension,
  r: ConceptRecord,
  comment: string,
): GccEvalPrompt {
  const moverNum = r.side === "w" ? "" : "..." // cosmetic only
  const moveLine = `move: ${moverNum}${r.moveSan}`

  const system = [
    "You will be given a single comment about a chess move.",
    "Your task is to rate the comment on one metric.",
    "Please make sure you read and understand these instructions carefully.",
    "",
    "Evaluation Criteria:",
    CRITERIA[dimension],
    "",
    "Evaluation Steps:",
    STEPS[dimension],
  ].join("\n")

  const userLines: string[] = []
  if (dimension !== "fluency") {
    // fluency in the paper is judged on the text alone; others show the position.
    userLines.push(`position: ${r.fenBefore}`)
    userLines.push(moveLine)
  }
  userLines.push(`target comment: ${comment}`)
  if (USES_ENGINE_HINT[dimension]) {
    userLines.push(`engine evaluation: ${buildEngineEvalHint(r)}`)
  }
  userLines.push("Score(1-5, score ONLY):")

  return { system, user: userLines.join("\n") }
}

export interface DimensionScore {
  dimension: GccEvalDimension
  /** Weighted-summation score in [1,5] (Eq. 1), or the parsed integer fallback. */
  score: number
  /** True when computed from token logprobs (smooth); false = integer fallback. */
  weighted: boolean
}

export interface GccEvalResult {
  scores: DimensionScore[]
  /** Mean of the four dimensions, in [1,5]. */
  overall: number
  /** Same, rescaled to [0,1] to match the paper's reported tables. */
  overallNormalized: number
  source: "llm" | "fallback"
  model?: string
  reason?: string
}

/** A single logprob entry from the OpenAI chat completions API. */
export interface TopLogprob {
  token: string
  logprob: number
}

/**
 * Weighted summation (Eq. 1): score = Σ_{s∈1..5} s · p(s | x), using the model's
 * top logprobs for the FIRST generated token. Probabilities are renormalized over
 * just the digits 1-5 that appear. Returns null if no digit token is present.
 */
export function scoreFromLogprobs(top: TopLogprob[]): number | null {
  const probByDigit = new Map<number, number>()
  for (const { token, logprob } of top) {
    const t = token.trim()
    if (/^[1-5]$/.test(t)) {
      const d = Number(t)
      probByDigit.set(d, (probByDigit.get(d) ?? 0) + Math.exp(logprob))
    }
  }
  if (probByDigit.size === 0) return null
  let mass = 0
  let weighted = 0
  for (const [digit, p] of probByDigit) {
    mass += p
    weighted += digit * p
  }
  if (mass <= 0) return null
  return weighted / mass
}

/** Last-resort: parse a bare integer 1-5 from the model's text output. */
export function parseIntegerScore(text: string): number | null {
  const m = text.match(/[1-5]/)
  return m ? Number(m[0]) : null
}

/** Aggregate per-dimension scores into the overall result shape. */
export function aggregate(
  scores: DimensionScore[],
  source: GccEvalResult["source"],
  model?: string,
  reason?: string,
): GccEvalResult {
  const overall = scores.length
    ? scores.reduce((a, s) => a + s.score, 0) / scores.length
    : 0
  return {
    scores,
    overall: round(overall),
    overallNormalized: round((overall - 1) / 4), // [1,5] → [0,1]
    source,
    model,
    reason,
  }
}

/**
 * Deterministic heuristic fallback used when there's no API key (so the UI still
 * works offline). NOT the paper's method — clearly labeled as a fallback. Rewards
 * concreteness (squares, SAN, evals) and length-appropriate detail.
 */
export function heuristicScores(r: ConceptRecord, comment: string): GccEvalResult {
  const text = comment.trim()
  const words = text.split(/\s+/).filter(Boolean).length
  const squares = (text.match(/\b[a-h][1-8]\b/g) ?? []).length
  const sanMoves = (text.match(/\b(?:O-O-O|O-O|[KQRBN]?x?[a-h][1-8](?:=[QRBN])?)[+#]?\b/g) ?? [])
    .length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length

  const clamp = (n: number) => Math.max(1, Math.min(5, n))
  const concreteness = Math.min(3, squares + sanMoves)
  const relevance = clamp(2.5 + concreteness * 0.5 - (words > 80 ? 0.5 : 0))
  const completeness = clamp(1.5 + Math.min(2.5, words / 25) + concreteness * 0.3)
  const clarity = clamp(2.5 + concreteness * 0.4 + (sentences >= 2 ? 0.5 : 0))
  const fluency = clamp(words >= 6 ? 4 + (sentences >= 2 ? 0.5 : 0) : 2.5)

  const scores: DimensionScore[] = [
    { dimension: "relevance", score: round(relevance), weighted: false },
    { dimension: "completeness", score: round(completeness), weighted: false },
    { dimension: "clarity", score: round(clarity), weighted: false },
    { dimension: "fluency", score: round(fluency), weighted: false },
  ]
  return aggregate(scores, "fallback", undefined, "no-key-heuristic")
}

export { GCC_EVAL_DIMENSIONS }

function round(n: number): number {
  return Math.round(n * 100) / 100
}
