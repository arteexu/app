// lib/commentary/config.ts
// Feature flags + tunables for the commentary layer. Model names are resolved
// server-side in the API route:
//   - COMMENTARY_MODEL           default model (chat models, e.g. gpt-4o-mini)
//   - COMMENTARY_MODEL_RIGOROUS  model for rigorous/master mode (e.g. gpt-5.5)
//   - COMMENTARY_REASONING_EFFORT  effort for reasoning models (gpt-5.x/o-series):
//       none | minimal | low | medium | high | xhigh  (defaults to "high")
// The route auto-detects reasoning models and drops unsupported params
// (temperature/top_p) while adding reasoning_effort.
// Depth/MultiPV are client-side constants because Stockfish runs in the browser
// (env vars don't reach the worker unless NEXT_PUBLIC_*; these are the source of truth).

/** Master switch for the AI "Coach's take" UI. Flip to false to disable everywhere. */
export const COMMENTARY_FEATURE_ENABLED = true

/** Shallow depth for the light/default on-demand path (FeedbackPanel button). */
export const COMMENTARY_ANALYSIS_DEPTH = 12

/**
 * Deeper search for "rigorous"/master mode (eval page, line-cited commentary).
 * Capped in practice by the per-analysis timeout — if the lite single-thread
 * WASM engine can't reach this depth in time, the deepest lines so far are used.
 */
export const COMMENTARY_RIGOROUS_DEPTH = 20

/** Number of candidate lines (MultiPV) requested in rigorous mode. */
export const COMMENTARY_MULTIPV = 4

/**
 * CCC concept prioritization: how many of the 12 concept families (Material,
 * Pawns, Kingsafety, …) to surface to the LLM, ranked by the magnitude of their
 * before→after change. The paper's examples use ~2–3; we default to 4.
 */
export const COMMENTARY_TOP_K_CONCEPTS = 4

/**
 * GCC-Eval (rubric judge) settings. Weighted-summation scoring (Eq. 1) needs token
 * logprobs, which CHAT models expose but reasoning models do not under JSON mode,
 * so the evaluator defaults to a chat model. Override with COMMENTARY_EVAL_MODEL.
 */
export const DEFAULT_COMMENTARY_EVAL_MODEL = "gpt-4o-mini"

/** GCC-Eval rubric dimensions. relevance/completeness get an engine-eval hint. */
export const GCC_EVAL_DIMENSIONS = ["relevance", "completeness", "clarity", "fluency"] as const
export type GccEvalDimension = (typeof GCC_EVAL_DIMENSIONS)[number]

/**
 * Default server-side search depth for rigorous mode when run on the server
 * (overridable via the COMMENTARY_SERVER_DEPTH env var, read in the API route).
 * The server engine isn't capped by the browser, so this can be deeper.
 */
export const COMMENTARY_SERVER_DEPTH = 24

/** Default model when COMMENTARY_MODEL env var is unset. */
export const DEFAULT_COMMENTARY_MODEL = "gpt-4o-mini"

/**
 * Rigorous mode: impose the fixed Idea/Main line/Refutation/Assessment skeleton
 * and enforce the anti-vagueness verifier. Lenient (false) for the light path.
 */
export const COMMENTARY_STRICT_SKELETON = true

/**
 * Filler phrases that are BANNED as standalone claims in rigorous mode. They may
 * only appear in a sentence that also cites a concrete line (SAN + eval) or names
 * concrete squares/pawns/pieces/plan. Shared by the prompt and the verifier.
 */
export const COMMENTARY_FILLER_PHRASES = [
  "good move",
  "strong move",
  "great move",
  "maintains pressure",
  "keeps the initiative",
  "keeps the pressure",
  "improves the position",
  "improving the position",
  "active piece",
  "more active",
  "better position",
  "creates threats",
  "creates threat",
  "creating threats",
  "solid",
  "interesting",
  "comfortable position",
  "nice move",
] as const
