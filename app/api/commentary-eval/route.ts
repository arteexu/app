// app/api/commentary-eval/route.ts
// GCC-Eval scoring route (Kim et al., NAACL 2025 §3.2). Given a ConceptRecord +
// a generated comment, score it on the four rubric dimensions (relevance,
// completeness, clarity, fluency) with an LLM judge, using weighted-summation
// over token logprobs (Eq. 1). Degrades gracefully:
//   - feature flag off / no key / errors → deterministic heuristic fallback.
// The OpenAI key never leaves the server. Designed never to 500 on a normal error.

import { NextResponse } from "next/server"
import {
  COMMENTARY_FEATURE_ENABLED,
  DEFAULT_COMMENTARY_EVAL_MODEL,
  GCC_EVAL_DIMENSIONS,
  type GccEvalDimension,
} from "@/lib/commentary/config"
import {
  aggregate,
  buildGccEvalPrompt,
  heuristicScores,
  parseIntegerScore,
  scoreFromLogprobs,
  type DimensionScore,
  type GccEvalResult,
  type TopLogprob,
} from "@/lib/commentary/gcc-eval"
import type { ConceptRecord } from "@/lib/commentary/types"

export const runtime = "nodejs"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const REQUEST_TIMEOUT_MS = 20000

interface EvalRequestBody {
  record?: ConceptRecord
  comment?: string
}

/** Score one dimension via the chat API, reading logprobs for weighted summation. */
async function scoreDimension(
  apiKey: string,
  model: string,
  dimension: GccEvalDimension,
  record: ConceptRecord,
  comment: string,
): Promise<DimensionScore> {
  const { system, user } = buildGccEvalPrompt(dimension, record, comment)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0,
        max_tokens: 1,
        logprobs: true,
        top_logprobs: 20,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 160)}`)
    }
    const data = await res.json()
    const choice = data?.choices?.[0]
    const content: string = choice?.message?.content ?? ""
    const top: TopLogprob[] = choice?.logprobs?.content?.[0]?.top_logprobs ?? []

    const weightedScore = scoreFromLogprobs(top)
    if (weightedScore !== null) {
      return { dimension, score: round(weightedScore), weighted: true }
    }
    const intScore = parseIntegerScore(content)
    return { dimension, score: intScore ?? 3, weighted: false }
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: Request) {
  if (!COMMENTARY_FEATURE_ENABLED) {
    return NextResponse.json({ error: "Commentary feature is disabled" }, { status: 404 })
  }

  let body: EvalRequestBody
  try {
    body = (await req.json()) as EvalRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { record, comment } = body
  if (!record || typeof record.fenBefore !== "string" || typeof comment !== "string" || !comment.trim()) {
    return NextResponse.json({ error: "Provide `record` and a non-empty `comment`" }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(heuristicScores(record, comment) satisfies GccEvalResult)
  }

  const model = process.env.COMMENTARY_EVAL_MODEL ?? DEFAULT_COMMENTARY_EVAL_MODEL

  try {
    const settled = await Promise.allSettled(
      GCC_EVAL_DIMENSIONS.map((d) => scoreDimension(apiKey, model, d, record, comment)),
    )
    const scores: DimensionScore[] = []
    let anyOk = false
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") {
        scores.push(s.value)
        anyOk = true
      } else {
        // Neutral placeholder so the dimension still appears; flagged non-weighted.
        scores.push({ dimension: GCC_EVAL_DIMENSIONS[i], score: 3, weighted: false })
      }
    })
    if (!anyOk) {
      return NextResponse.json(heuristicScores(record, comment) satisfies GccEvalResult)
    }
    return NextResponse.json(aggregate(scores, "llm", model) satisfies GccEvalResult)
  } catch (err) {
    const reason = err instanceof Error ? `error:${err.message}`.slice(0, 120) : "error"
    const fallback = heuristicScores(record, comment)
    return NextResponse.json({ ...fallback, reason } satisfies GccEvalResult)
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
