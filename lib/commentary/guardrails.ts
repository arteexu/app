// lib/commentary/guardrails.ts
// Factual post-checks on an LLM comment against the grounded ConceptRecord.
// Phase 2 adds a LINE VERIFIER: any multi-move SAN sequence the comment cites
// must be a contiguous slice of a provided candidate/refutation PV, and any eval
// it quotes must match a provided line's eval within tolerance. Non-empty result
// ⇒ regenerate (once) or fall back to the template.

import type { ConceptRecord } from "./types"
import { COMMENTARY_FILLER_PHRASES } from "./config"

export interface VerifyOptions {
  /** Master mode: require ≥1 cited line for non-trivial moves; enforce strictly. */
  requireLineCitation?: boolean
  /** Enforce the anti-vagueness (banned filler) check. */
  strictSkeleton?: boolean
}

const EVAL_TOLERANCE_PAWNS = 0.3

// A single SAN token (move), optionally with check/mate/promotion decoration.
const SAN_TOKEN = /^(?:O-O-O|O-O|(?:[KQRBN][a-h]?[1-8]?|[a-h])x?[a-h][1-8](?:=[QRBN])?)[+#]?$/
// In-prose detectors (not anchored) for concrete evidence within a sentence.
const SQUARE_RE = /\b[a-h][1-8]\b/
const EVAL_RE = /[+-]?\d+\.\d+|\bM\d+\b|#/
const SAN_INPROSE_RE =
  /\b(?:O-O-O|O-O|(?:[KQRBN][a-h]?[1-8]?|[a-h])x?[a-h][1-8](?:=[QRBN])?)[+#]?\b/

function stripDecor(san: string): string {
  return san.replace(/[+#]/g, "")
}

/** Extract runs (length ≥ 2) of consecutive SAN tokens from prose. */
function extractSanRuns(comment: string): string[][] {
  const runs: string[][] = []
  let cur: string[] = []
  for (let raw of comment.split(/\s+/)) {
    // Strip wrapping punctuation/quotes and leading move numbers ("24.", "23...").
    let w = raw.replace(/^[("'“”]+/, "").replace(/[)"'“”.,;:!?]+$/, "")
    w = w.replace(/^\d+\.(\.\.)?/, "")
    if (w === "") continue // move-number-only token: keep the run going
    if (SAN_TOKEN.test(w)) {
      cur.push(stripDecor(w))
    } else if (cur.length) {
      runs.push(cur)
      cur = []
    }
  }
  if (cur.length) runs.push(cur)
  return runs.filter((r) => r.length >= 2)
}

/** True if `run` is a contiguous slice of `line` (both arrays of bare SAN). */
function isContiguousSlice(run: string[], line: string[]): boolean {
  if (run.length > line.length) return false
  for (let start = 0; start + run.length <= line.length; start++) {
    let ok = true
    for (let i = 0; i < run.length; i++) {
      if (run[i] !== line[i + start]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

export function validateComment(
  comment: string,
  r: ConceptRecord,
  opts: VerifyOptions = {},
): string[] {
  const fails: string[] = []
  const text = comment.toLowerCase()

  // 1. If it names a "best move", it must match the real engine best move.
  const bestMatch = comment.match(/best move (?:is|was)\s+([A-Za-z][A-Za-z0-9+#=x-]*)/i)
  if (bestMatch && r.bestMoveSan) {
    const claimed = bestMatch[1].replace(/[.,]$/, "")
    if (stripDecor(claimed) !== stripDecor(r.bestMoveSan)) {
      fails.push(`names wrong best move "${claimed}" (actual: ${r.bestMoveSan})`)
    }
  }

  // 2. Eval direction must match classification.
  const saysGood = /(strong|excellent|winning|great|brilliant|accurate|best move|good move)/.test(text)
  const saysBad = /(blunder|mistake|weak|bad move|loses|inaccura|poor|error)/.test(text)
  if (r.classification === "blunder" && saysGood && !saysBad) fails.push("calls a blunder good")
  if ((r.classification === "best" || r.classification === "brilliant") && saysBad && !saysGood) {
    fails.push("calls a best/brilliant move bad")
  }

  // 3. Square-grounding: concrete attack/capture talk must reference known squares.
  const allowedSquares = new Set<string>([
    ...r.legalAttacks.map((a) => a.targetSquare),
    ...r.legalAttacks.map((a) => a.bySquare),
    ...r.hangingPieces.map((h) => h.square),
    r.moveUci.slice(0, 2),
    r.moveUci.slice(2, 4),
    // Any square that appears in a provided line is also grounded.
    ...providedLines(r).flatMap((line) => line.flatMap(sanSquares)),
  ])
  const wantsGrounding = /(attack|threat|win|hang|captur|takes|fork|pin|skewer)/.test(text)
  if (wantsGrounding) {
    for (const sq of comment.match(/\b[a-h][1-8]\b/g) ?? []) {
      if (!allowedSquares.has(sq)) fails.push(`mentions square ${sq} not in the grounded facts`)
    }
  }

  // 4. LINE VERIFIER: every cited multi-move sequence must be in a provided line.
  const lines = providedLines(r)
  const citedRuns = extractSanRuns(comment)
  if (lines.length > 0) {
    for (const run of citedRuns) {
      const ok = lines.some((line) => isContiguousSlice(run, line))
      if (!ok) fails.push(`cites line "${run.join(" ")}" not found in the provided engine lines`)
    }
  }

  // 5. EVAL TOLERANCE: any quoted numeric eval must match a provided line eval.
  const providedEvals = collectProvidedEvals(r)
  if (providedEvals.length > 0) {
    for (const m of comment.match(/[+-]?\d+\.\d+/g) ?? []) {
      const v = Number(m)
      if (!Number.isFinite(v)) continue
      const supported = providedEvals.some(
        (e) => Math.abs(e - v) <= EVAL_TOLERANCE_PAWNS && Math.sign(e) === Math.sign(v),
      )
      if (!supported) fails.push(`quotes eval ${m} not supported by any provided line`)
    }
  }

  // 6. Master mode: require ≥1 cited line for every NON-TRIVIAL move.
  //    Trivial (allowed without a line): only one engine candidate exists
  //    (e.g. a forced recapture / only move).
  if (opts.requireLineCitation && lines.length > 0) {
    const trivial = (r.candidates?.length ?? 0) <= 1
    if (!trivial && citedRuns.length === 0) {
      fails.push("no concrete line cited (rigorous mode requires a SAN line for non-trivial moves)")
    }
  }

  // 7. Anti-vagueness: banned filler must share its sentence with concrete
  //    evidence (a cited line, a square, an eval, or a SAN move).
  if (opts.strictSkeleton) {
    for (const sentence of splitSentences(comment)) {
      const lower = sentence.toLowerCase()
      const filler = COMMENTARY_FILLER_PHRASES.find((p) => lower.includes(p))
      if (!filler) continue
      const concrete =
        SQUARE_RE.test(sentence) || EVAL_RE.test(sentence) || SAN_INPROSE_RE.test(sentence)
      if (!concrete) {
        fails.push(`vague filler "${filler}" not backed by a concrete line/square/eval in its sentence`)
      }
    }
  }

  return fails
}

/** Split a comment into sentences (best-effort; keeps SAN dots from over-splitting). */
function splitSentences(comment: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace + capital/quote,
  // so eval like "+3.10" and move numbers like "24." don't fragment sentences.
  return comment
    .split(/(?<=[.!?])\s+(?=[A-Z"“(])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** All provided PVs as arrays of bare SAN (candidates + refutations + top PV). */
function providedLines(r: ConceptRecord): string[][] {
  const out: string[][] = []
  for (const c of r.candidates ?? []) out.push(c.pvSan.map(stripDecor))
  for (const f of r.refutations ?? []) out.push(f.pvSan.map(stripDecor))
  if (r.topPvSan?.length) out.push(r.topPvSan.map(stripDecor))
  return out.filter((l) => l.length > 0)
}

/** Provided eval values (in pawns) the comment is allowed to quote. */
function collectProvidedEvals(r: ConceptRecord): number[] {
  const cps = [
    r.evalBeforeCp,
    r.evalAfterCp,
    ...(r.candidates ?? []).map((c) => c.endEvalCp),
    ...(r.refutations ?? []).map((f) => f.endEvalCp),
  ]
  return cps.map((cp) => cp / 100)
}

/** Destination square(s) referenced by a bare SAN token (best-effort). */
function sanSquares(san: string): string[] {
  return san.match(/[a-h][1-8]/g) ?? []
}
