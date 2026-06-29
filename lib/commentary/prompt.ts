// lib/commentary/prompt.ts
// Assembles a ConceptRecord into the grounded coach prompt (system + user).
// Mirrors CCC: "use ONLY the listed facts", enumerated legal attacks to prevent
// hallucination, CoT, rating-conditioned depth/vocabulary, optional exemplars
// and the learner's recurring mistakes.

import { getKeyConcept } from "@/lib/key-concepts"
import { getTacticalPattern } from "@/lib/tactical-patterns"
import type { ConceptRecord } from "./types"
import { prioritizeSignals } from "./prioritize"
import { COMMENTARY_FILLER_PHRASES, COMMENTARY_STRICT_SKELETON } from "./config"

export interface PromptOptions {
  exemplars?: string[] // retrieved annotations in your voice (few-shot tone)
  recurringMistakes?: string[]
  /** Master mode: every concrete claim must cite a provided engine line. */
  requireLineCitation?: boolean
  /** Impose the Idea/Main line/Refutation/Assessment skeleton + filler ban. */
  strictSkeleton?: boolean
}

/** Format a centipawn / mate eval (mover POV) as a short string, e.g. "+3.10", "M5". */
function fmtEval(cp: number, mate: number | null): string {
  if (mate !== null) return mate >= 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  const p = cp / 100
  return `${p >= 0 ? "+" : ""}${p.toFixed(2)}`
}

function ratingBand(r?: number): { label: string; guidance: string } {
  if (r == null) return { label: "club", guidance: "Use plain language; briefly define any tactic you name." }
  if (r < 1000)
    return {
      label: "beginner",
      guidance: "Use simple words. Define every tactic (fork, pin). Cover one idea at a time.",
    }
  if (r < 1600)
    return {
      label: "intermediate",
      guidance: "Assume basic tactics are known. Explain the plan and the key line.",
    }
  return { label: "advanced", guidance: "Be concise and precise. Focus on subtle ideas, not basics." }
}

function evalToWords(cp: number): string {
  const p = cp / 100
  if (p > 5) return "winning"
  if (p > 1) return "clearly better"
  if (p > 0.3) return "slightly better"
  if (p > -0.3) return "roughly equal"
  if (p > -1) return "slightly worse"
  if (p > -5) return "clearly worse"
  return "losing"
}

/** Relation of a candidate's eval (mover POV) to the played move's eval. */
function relationToActual(candidateCp: number, playedCp: number): string {
  const d = candidateCp - playedCp
  if (Math.abs(d) <= 30) return "similar to actual move"
  return d > 0 ? "better than actual move" : "worse than actual move"
}

/**
 * The CCC engine-evaluation hint, in the paper's exact shape (Appendix A), e.g.
 * "actual move - Bd2+ 232cp, expected reply - f4g3, best move - Bd2+ similar to
 * actual move, second best move - Nc5 similar to actual move". Reused by GCC-Eval.
 */
export function buildEngineEvalHint(r: ConceptRecord): string {
  const playedCp = r.evalAfterCp
  const parts = [`actual move - ${r.moveSan} ${playedCp}cp`]

  const playedRefutation = (r.refutations ?? []).find((f) => f.ofMoveSan === r.moveSan)
  const reply = playedRefutation?.pvSan?.[1] ?? r.topPvSan?.[1]
  if (reply) parts.push(`expected reply - ${reply}`)

  if (r.bestMoveSan) {
    const bestCp = r.candidates?.[0]?.endEvalCp ?? r.evalBeforeCp
    parts.push(`best move - ${r.bestMoveSan} ${relationToActual(bestCp, playedCp)}`)
  }
  const second = r.candidates?.[1]
  if (second) {
    parts.push(`second best move - ${second.san} ${relationToActual(second.endEvalCp, playedCp)}`)
  }
  return parts.join(", ")
}

export function buildCommentaryPrompt(r: ConceptRecord, opts: PromptOptions = {}) {
  const band = ratingBand(r.userRating)
  const signals = prioritizeSignals(r)
  const requireLineCitation = !!opts.requireLineCitation && (r.candidates?.length ?? 0) > 0
  const strictSkeleton = requireLineCitation && (opts.strictSkeleton ?? COMMENTARY_STRICT_SKELETON)

  const attacks = r.legalAttacks.length
    ? r.legalAttacks
        .map(
          (a) =>
            `- ${a.byPiece} on ${a.bySquare} attacks ${a.targetPiece} on ${a.targetSquare}` +
            `${a.givesCheck ? " (CHECK)" : ""}${a.defended ? " (defended)" : " (undefended)"}`,
        )
        .join("\n")
    : "- (none)"

  const hanging = r.hangingPieces.length
    ? r.hangingPieces
        .map(
          (h) =>
            `- ${h.color === r.side ? "OWN" : "ENEMY"} ${h.piece} on ${h.square} ` +
            `(attacked by ${h.attackedBy.join(",") || "—"}; defended by ${h.defendedBy.join(",") || "none"})`,
        )
        .join("\n")
    : "- (none)"

  const patterns =
    r.matchedTacticalPatternIds
      .map((id) => {
        const p = getTacticalPattern(id)
        return p ? `- ${p.title}: ${p.description}` : ""
      })
      .filter(Boolean)
      .join("\n") || "- (none auto-detected — only mention a tactic if the facts clearly show it)"

  const concepts =
    r.matchedKeyConceptIds
      .map((id) => {
        const k = getKeyConcept(id)
        return k ? `- ${k.title}: ${k.description}` : ""
      })
      .filter(Boolean)
      .join("\n") || "- (none auto-detected)"

  // CCC concept guidance: the engine-derived concept families this move changed the
  // most (ranked by before→after delta). This is the "concept-guided" focus.
  const prioritizedConcepts =
    (r.prioritizedConcepts ?? []).length > 0
      ? r.prioritizedConcepts!
          .map(
            (pc) =>
              `- ${pc.label}: ${pc.direction} for ${r.side === "w" ? "White" : "Black"}` +
              ` (Δ ${pc.delta >= 0 ? "+" : ""}${pc.delta})`,
          )
          .join("\n")
      : "- (no dominant concept shift)"

  const engineHint = buildEngineEvalHint(r)

  const candidates =
    (r.candidates ?? []).length > 0
      ? r.candidates
          .map(
            (c, i) =>
              `${i + 1}. ${c.san} (${fmtEval(c.endEvalCp, c.mate)}): ${c.pvSan.join(" ") || c.san}`,
          )
          .join("\n")
      : "- (none provided)"

  const refutations =
    (r.refutations ?? []).length > 0
      ? r.refutations
          .map((f) => `- ${f.ofMoveSan}: ${f.pvSan.join(" ")} → ${fmtEval(f.endEvalCp, null)}`)
          .join("\n")
      : "- (none provided)"

  const citationRules = requireLineCitation
    ? [
        ``,
        `LINE-CITATION REQUIREMENTS (MASTER MODE — strict):`,
        `- Every concrete claim (a move is strong/weak, a tactic works, material is won, a` +
          ` threat exists) MUST cite a specific line copied VERBATIM from CANDIDATE MOVES or`,
        `  WHY ALTERNATIVES FAIL below, written in SAN and ending with that line's eval —`,
        `  e.g. "after Nf5 gxf5 Qg4+ Kh8 Qxf5 White is winning (+3.10)".`,
        `- You may NOT state any move sequence that is not present in those lists.`,
        `- Any positional/strategic point NOT backed by a listed line must be phrased as a`,
        `  general assessment tied to the engine eval trend ("positionally, ...") and must`,
        `  NEVER assert a concrete tactic, threat, or variation.`,
        `- Prefer citing the principal (first) candidate line. Quote evals exactly as given.`,
      ].join("\n")
    : ""

  const fillerList = COMMENTARY_FILLER_PHRASES.map((p) => `"${p}"`).join(", ")
  const antiVagueness = strictSkeleton
    ? [
        ``,
        `ANTI-VAGUENESS (MASTER MODE — an automatic verifier rejects violations):`,
        `- These filler phrases are BANNED as standalone claims: ${fillerList}.`,
        `  You may use such a phrase ONLY if the SAME sentence ALSO cites a concrete line`,
        `  (SAN + eval) or names concrete square(s)/pawn(s)/piece(s) or a concrete plan in moves.`,
        `- NO bare adjectives. Every positional claim must name the specific square, pawn, or`,
        `  piece and a concrete plan expressed in moves — never just "active" / "better" / "solid".`,
        ``,
        `STRUCTURE the comment as these concise sentences (plain prose, no literal headers):`,
        `  1) IDEA: one concrete sentence on what ${r.moveSan} actually does — a square it hits, a`,
        `     piece it wins/defends, a pawn break, or a plan in moves.`,
        `  2) MAIN LINE: cite the principal line in SAN ending with its eval, e.g.`,
        `     "${r.candidates?.[0]?.pvSan.slice(0, 5).join(" ") || r.moveSan} (${
          r.candidates?.[0] ? fmtEval(r.candidates[0].endEvalCp, r.candidates[0].mate) : "+0.00"
        })".`,
        `  3) WHY THE ALTERNATIVE FAILS: take the most natural alternative from the lists above`,
        `     and give its line in SAN + eval.`,
        `  4) ASSESSMENT: state the concrete resulting imbalance (extra material; a specific weak`,
        `     square/pawn; the king exposed on a named file/diagonal) tied to the eval — not adjectives.`,
        `- Be concise: rigor over length. Omit step 3 only when there is genuinely no alternative` +
          ` (e.g. a forced recapture).`,
      ].join("\n")
    : ""

  const jsonShape = requireLineCitation
    ? `   {"comment": "<concise, concrete explanation with cited line(s)>", "referencedBestMove": "<SAN or null>", "citedLines": ["<SAN line you quoted>", ...]}`
    : `   {"comment": "<1-3 sentence explanation>", "referencedBestMove": "<SAN you relied on, or null>"}`

  const system = [
    `You are ChessMind, a ${requireLineCitation ? "master-level" : "friendly"} chess coach explaining ONE move to a ${band.label}-level student.`,
    band.guidance,
    `RULES:`,
    `1. Explain WHY the move is "${r.classification}" using ONLY the facts provided below.`,
    `   Anchor the explanation on the PRIORITIZED CONCEPTS (these are the engine-derived` +
      ` themes the move most affects); do not chase concepts that are not listed there.`,
    `2. Do NOT mention any piece, square, attack, capture, or move that is not in the facts.`,
    `   The "Legal attacks after move" list is exhaustive — do not invent threats beyond it.`,
    `3. If a fact is not given, do not guess it. It is better to say less than to be wrong.`,
    citationRules,
    antiVagueness,
    `4. Think step by step privately, then output ONLY a JSON object with this exact shape:`,
    jsonShape,
  ]
    .filter(Boolean)
    .join("\n")

  const user = [
    `POSITION (FEN before): ${r.fenBefore}`,
    `MOVE PLAYED: ${r.moveSan} (${r.moveUci}), by ${r.side === "w" ? "White" : "Black"}, phase: ${r.phase}`,
    ``,
    `ENGINE EVALUATION (mover's perspective):`,
    `- before: ${(r.evalBeforeCp / 100).toFixed(2)} (${evalToWords(r.evalBeforeCp)})`,
    `- after:  ${(r.evalAfterCp / 100).toFixed(2)} (${evalToWords(r.evalAfterCp)})`,
    `- change: ${(r.evalDeltaCp / 100).toFixed(2)}; classification: ${r.classification}; cpLoss: ${r.cpLoss}`,
    `- engine best move: ${r.bestMoveSan ?? "?"}; played-is-best: ${r.playedIsBest}`,
    `- best line: ${r.topPvSan.slice(0, 6).join(" ") || "—"}`,
    `- material change for mover: ${r.materialDelta >= 0 ? "+" : ""}${r.materialDelta}`,
    `- engine hint (CCC): ${engineHint}`,
    ``,
    `PRIORITIZED CONCEPTS (engine-derived; the families this move changed most — focus on these):`,
    prioritizedConcepts,
    ``,
    `CANDIDATE MOVES (engine MultiPV; eval = mover POV at end of line):`,
    candidates,
    ``,
    `WHY ALTERNATIVES FAIL / CONSEQUENCE LINES:`,
    refutations,
    ``,
    `LEGAL ATTACKS AFTER MOVE (exhaustive):`,
    attacks,
    ``,
    `HANGING / LOOSE PIECES:`,
    hanging,
    ``,
    `DETECTED TACTICAL PATTERNS:`,
    patterns,
    ``,
    `RELEVANT KEY CONCEPTS:`,
    concepts,
    ``,
    `MOST IMPORTANT SIGNALS (focus here): ${signals.map((sig) => sig.text).join("; ")}`,
    opts.recurringMistakes?.length
      ? `\nSTUDENT'S RECURRING MISTAKES (reference if relevant): ${opts.recurringMistakes.join("; ")}`
      : "",
    opts.exemplars?.length
      ? `\nSTYLE EXEMPLARS — match their DENSITY, SPECIFICITY, and VOICE (concrete squares + ` +
        `cited lines, zero filler). Aim for this level of rigor. Do NOT copy their facts:\n${opts.exemplars
          .map((e, i) => `EXEMPLAR ${i + 1}:\n"""${e.trim()}"""`)
          .join("\n")}`
      : "",
  ].join("\n")

  return { system, user }
}
