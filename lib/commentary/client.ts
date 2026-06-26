// lib/commentary/client.ts
// Client-side helpers: POST a ConceptRecord to /api/commentary, and a one-call
// convenience that runs the full browser pipeline (engine → record → request).

import type {
  CommentaryMode,
  CommentaryRequestBody,
  CommentaryResponse,
  ConceptRecord,
} from "./types"
import { buildConceptRecord } from "./concept-record"
import { computeMoveEvals, computeCommentaryAnalysis } from "./engine-eval"
import { buildTemplateComment } from "./template"
import {
  COMMENTARY_ANALYSIS_DEPTH,
  COMMENTARY_RIGOROUS_DEPTH,
  COMMENTARY_MULTIPV,
} from "./config"

export interface RequestCommentaryOptions {
  exemplars?: string[]
  recurringMistakes?: string[]
  mode?: CommentaryMode
  signal?: AbortSignal
}

/** Low-level POST to the route. */
async function postCommentary(
  body: CommentaryRequestBody,
  signal?: AbortSignal,
): Promise<CommentaryResponse> {
  const res = await fetch("/api/commentary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    return {
      comment: body.record ? buildTemplateComment(body.record) : "Commentary request failed.",
      source: "template",
      classification: body.record?.classification ?? "good",
      guardrail: { passed: true, failures: [] },
      reason: `http-${res.status}`,
    }
  }
  return (await res.json()) as CommentaryResponse
}

/** POST a prebuilt ConceptRecord (client/browser analysis) and return commentary. */
export async function requestCommentary(
  record: ConceptRecord,
  opts: RequestCommentaryOptions = {},
): Promise<CommentaryResponse> {
  return postCommentary(
    {
      record,
      exemplars: opts.exemplars,
      recurringMistakes: opts.recurringMistakes,
      mode: opts.mode,
    },
    opts.signal,
  )
}

export interface CoachContext {
  fenBefore: string
  moveSan: string
  userRating?: number
  recurringMistakes?: string[]
  /** Few-shot example comments (the FM's own annotations) to match in voice/density. */
  exemplars?: string[]
}

export interface CoachResult {
  response: CommentaryResponse
  /** Null only when server-side analysis failed to produce a record. */
  record: ConceptRecord | null
}

export interface GenerateCoachOptions {
  /** Rigorous/master mode: deep MultiPV + line-citation + verification. */
  rigorous?: boolean
  /** When rigorous, run the deep analysis on the SERVER instead of the browser. */
  serverAnalysis?: boolean
  depth?: number
  multiPv?: number
}

/**
 * Full pipeline for a single move.
 *   - default: shallow single-PV in the browser (cheap; FeedbackPanel).
 *   - rigorous + serverAnalysis: send minimal inputs; the SERVER runs deep
 *     MultiPV (not capped by the browser) and returns the built record.
 *   - rigorous (no serverAnalysis): deep MultiPV in the browser.
 * LLM/guardrail failures degrade to the template via the route.
 */
export async function generateCoachComment(
  ctx: CoachContext,
  opts: GenerateCoachOptions = {},
): Promise<CoachResult> {
  // Server-side deep analysis: skip the browser engine entirely.
  if (opts.rigorous && opts.serverAnalysis) {
    const response = await postCommentary({
      mode: "rigorous",
      serverAnalysis: true,
      fenBefore: ctx.fenBefore,
      moveSan: ctx.moveSan,
      userRating: ctx.userRating,
      recurringMistakes: ctx.recurringMistakes,
      exemplars: ctx.exemplars,
    })
    return { response, record: response.record ?? null }
  }

  let record: ConceptRecord

  if (opts.rigorous) {
    const depth = opts.depth ?? COMMENTARY_RIGOROUS_DEPTH
    const multiPv = opts.multiPv ?? COMMENTARY_MULTIPV
    const { before, after, candidates, refutations } = await computeCommentaryAnalysis(
      ctx.fenBefore,
      ctx.moveSan,
      depth,
      multiPv,
    )
    record = buildConceptRecord({
      fenBefore: ctx.fenBefore,
      moveSan: ctx.moveSan,
      before,
      after,
      userRating: ctx.userRating,
      candidates,
      refutations,
    })
  } else {
    const depth = opts.depth ?? COMMENTARY_ANALYSIS_DEPTH
    const { before, after } = await computeMoveEvals(ctx.fenBefore, ctx.moveSan, depth)
    record = buildConceptRecord({
      fenBefore: ctx.fenBefore,
      moveSan: ctx.moveSan,
      before,
      after,
      userRating: ctx.userRating,
    })
  }

  const response = await requestCommentary(record, {
    recurringMistakes: ctx.recurringMistakes,
    exemplars: ctx.exemplars,
    mode: opts.rigorous ? "rigorous" : "default",
  })
  return { response, record }
}
