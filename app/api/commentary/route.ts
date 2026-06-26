// app/api/commentary/route.ts
// Server route: ConceptRecord → grounded coach comment via OpenAI, with a
// deterministic template fallback. The OpenAI key never leaves the server.
//
// Behavior:
//   - No OPENAI_API_KEY            → return template comment (source: "template").
//   - LLM call ok + guardrails ok  → return LLM comment (source: "llm").
//   - Guardrails fail              → re-prompt ONCE with the reasons.
//   - Still failing / any error    → return template comment.
// It is designed to never 500 on a normal failure.

import { NextResponse } from "next/server"
import { buildCommentaryPrompt } from "@/lib/commentary/prompt"
import { validateComment } from "@/lib/commentary/guardrails"
import { buildTemplateComment } from "@/lib/commentary/template"
import { buildConceptRecord } from "@/lib/commentary/concept-record"
import {
  DEFAULT_COMMENTARY_MODEL,
  COMMENTARY_SERVER_DEPTH,
  COMMENTARY_MULTIPV,
  COMMENTARY_STRICT_SKELETON,
} from "@/lib/commentary/config"
import type {
  CommentaryRequestBody,
  CommentaryResponse,
  ConceptRecord,
} from "@/lib/commentary/types"

export const runtime = "nodejs"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const REQUEST_TIMEOUT_MS = 20000
// Reasoning models (gpt-5.x, o-series) think before answering and are slower,
// so give them a longer budget than chat models.
const REASONING_TIMEOUT_MS = 60000

/**
 * Reasoning models (gpt-5.x and the o-series) reject sampling params like
 * `temperature`/`top_p`, expect `max_completion_tokens` instead of `max_tokens`,
 * and accept a `reasoning_effort` knob. Chat models take `temperature`. We branch
 * the request body on this so a reasoning model can be dropped in via env.
 */
function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    m.startsWith("o5")
  )
}

function templateResponse(record: ConceptRecord, reason: string): CommentaryResponse {
  return {
    comment: buildTemplateComment(record),
    source: "template",
    classification: record.classification,
    guardrail: { passed: true, failures: [] },
    reason,
  }
}

interface LlmComment {
  comment: string
  referencedBestMove?: string | null
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
): Promise<LlmComment> {
  const reasoning = isReasoningModel(model)
  const payload: Record<string, unknown> = {
    model,
    response_format: { type: "json_object" },
    messages,
  }
  if (reasoning) {
    // none | minimal | low | medium | high | xhigh — default high for rigor.
    payload.reasoning_effort = process.env.COMMENTARY_REASONING_EFFORT ?? "high"
  } else {
    payload.temperature = 0.2
  }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    reasoning ? REASONING_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  )
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`)
    }
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(content) as LlmComment
    if (!parsed || typeof parsed.comment !== "string") throw new Error("Malformed LLM JSON")
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: Request) {
  let body: CommentaryRequestBody
  try {
    body = (await req.json()) as CommentaryRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { exemplars, recurringMistakes, mode, serverAnalysis, fenBefore, moveSan, userRating } = body

  // Resolve the ConceptRecord: either prebuilt (client analysis, back-compat) or
  // computed server-side with the Node engine (rigorous + serverAnalysis).
  let record: ConceptRecord | undefined = body.record
  let analysisDepth: number | undefined
  let analysisSource: "client" | "server" | undefined = record ? "client" : undefined

  if (!record) {
    const wantServer = mode === "rigorous" && serverAnalysis === true
    if (!wantServer || typeof fenBefore !== "string" || typeof moveSan !== "string") {
      return NextResponse.json(
        { error: "Provide `record`, or `{ mode:'rigorous', serverAnalysis:true, fenBefore, moveSan }`" },
        { status: 400 },
      )
    }
    try {
      // Lazy import keeps the WASM engine out of the bundle until needed.
      const { computeCommentaryAnalysisNode } = await import("@/lib/commentary/engine-node")
      const depth = Number(process.env.COMMENTARY_SERVER_DEPTH) || COMMENTARY_SERVER_DEPTH
      const movetime = Number(process.env.COMMENTARY_SERVER_MOVETIME) || undefined
      const analysis = await computeCommentaryAnalysisNode(fenBefore, moveSan, {
        depth,
        multiPv: COMMENTARY_MULTIPV,
        movetime,
      })
      record = buildConceptRecord({
        fenBefore,
        moveSan,
        before: analysis.before,
        after: analysis.after,
        candidates: analysis.candidates,
        refutations: analysis.refutations,
        userRating,
      })
      analysisDepth = analysis.before.depth
      analysisSource = "server"
    } catch (err) {
      const reason = err instanceof Error ? `server-engine:${err.message}`.slice(0, 140) : "server-engine-failed"
      return NextResponse.json({
        comment: "Couldn't run deep server-side analysis for this position.",
        source: "template",
        classification: "good",
        guardrail: { passed: false, failures: [reason] },
        reason,
      } satisfies CommentaryResponse)
    }
  }

  if (!record || typeof record.fenBefore !== "string" || typeof record.moveSan !== "string") {
    return NextResponse.json({ error: "Missing or invalid `record`" }, { status: 400 })
  }

  // Helper to attach server-analysis metadata to any response we return.
  const withMeta = (r: CommentaryResponse): CommentaryResponse => ({
    ...r,
    record: analysisSource === "server" ? record : r.record,
    analysisDepth,
    analysisSource,
  })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(withMeta(templateResponse(record, "no-key")))
  }

  const rigorous = mode === "rigorous"
  const requireLineCitation = rigorous && (record.candidates?.length ?? 0) > 0
  const strictSkeleton = requireLineCitation && COMMENTARY_STRICT_SKELETON
  const model = rigorous
    ? process.env.COMMENTARY_MODEL_RIGOROUS ?? process.env.COMMENTARY_MODEL ?? DEFAULT_COMMENTARY_MODEL
    : process.env.COMMENTARY_MODEL ?? DEFAULT_COMMENTARY_MODEL

  const { system, user } = buildCommentaryPrompt(record, {
    exemplars,
    recurringMistakes,
    requireLineCitation,
    strictSkeleton,
  })

  try {
    // First attempt.
    let result = await callOpenAI(apiKey, model, [
      { role: "system", content: system },
      { role: "user", content: user },
    ])
    let failures = validateComment(result.comment, record, { requireLineCitation, strictSkeleton })

    // Re-prompt ONCE with the failure reasons.
    if (failures.length > 0) {
      result = await callOpenAI(apiKey, model, [
        { role: "system", content: system },
        { role: "user", content: user },
        { role: "assistant", content: JSON.stringify(result) },
        {
          role: "user",
          content:
            `Your previous answer was rejected for these reasons: ${failures.join("; ")}. ` +
            `Rewrite the comment using ONLY the provided facts/lines and the same JSON shape.`,
        },
      ])
      failures = validateComment(result.comment, record, { requireLineCitation, strictSkeleton })
    }

    // Still failing → safe template fallback.
    if (failures.length > 0) {
      return NextResponse.json(
        withMeta({
          ...templateResponse(record, "guardrail-failed"),
          guardrail: { passed: false, failures },
        }),
      )
    }

    const response: CommentaryResponse = {
      comment: result.comment,
      source: "llm",
      classification: record.classification,
      referencedBestMove: result.referencedBestMove ?? null,
      guardrail: { passed: true, failures: [] },
    }
    return NextResponse.json(withMeta(response))
  } catch (err) {
    const reason = err instanceof Error ? `error:${err.message}`.slice(0, 120) : "error"
    return NextResponse.json(withMeta(templateResponse(record, reason)))
  }
}
