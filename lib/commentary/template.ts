// lib/commentary/template.ts
// Deterministic, always-correct (if plainer) commentary built straight from the
// ConceptRecord. Used as the offline path (no API key) and the final fallback
// when the LLM output fails guardrails. Mirrors Jhamtani's "TEMP" baseline.

import { getKeyConcept } from "@/lib/key-concepts"
import { getTacticalPattern } from "@/lib/tactical-patterns"
import type { ConceptRecord } from "./types"

const CLASSIFICATION_PHRASE: Record<ConceptRecord["classification"], string> = {
  brilliant: "is a brilliant move",
  best: "is the best move",
  good: "is a good move",
  inaccuracy: "is a slight inaccuracy",
  mistake: "is a mistake",
  blunder: "is a blunder",
}

export function buildTemplateComment(r: ConceptRecord): string {
  const parts: string[] = []
  const moverName = r.side === "w" ? "White" : "Black"

  if (r.moveSan.includes("#")) {
    parts.push(`${r.moveSan} is checkmate — the game is over.`)
    return parts.join(" ")
  }

  parts.push(`${r.moveSan} ${CLASSIFICATION_PHRASE[r.classification]}.`)

  // Concrete grounded facts.
  const undefendedHits = r.legalAttacks.filter(
    (a) => a.bySquare === r.moveUci.slice(2, 4) && !a.defended,
  )
  const checkHit = r.legalAttacks.find(
    (a) => a.givesCheck && a.bySquare === r.moveUci.slice(2, 4),
  )
  if (checkHit) parts.push(`It gives check.`)
  if (undefendedHits.some((a) => a.targetPiece !== "k" && a.targetPiece !== "p")) {
    const tgt = undefendedHits.find((a) => a.targetPiece !== "k" && a.targetPiece !== "p")!
    parts.push(`It attacks the undefended ${pieceName(tgt.targetPiece)} on ${tgt.targetSquare}.`)
  }

  const pattern = r.matchedTacticalPatternIds.map((id) => getTacticalPattern(id)).find(Boolean)
  if (pattern) parts.push(`Pattern: ${pattern.title.toLowerCase()} — ${pattern.description}`)

  const concept = r.matchedKeyConceptIds.map((id) => getKeyConcept(id)).find(Boolean)
  if (concept && !pattern) parts.push(`${concept.title}: ${concept.description}`)

  if (!r.playedIsBest && r.bestMoveSan && (r.classification === "mistake" || r.classification === "blunder")) {
    parts.push(`A stronger try was ${r.bestMoveSan}.`)
  }

  // Eval summary as a fallback when nothing concrete fired.
  if (parts.length === 1) {
    const dir =
      r.evalDeltaCp <= -100
        ? `${moverName}'s position got worse`
        : r.evalDeltaCp >= 50
          ? `${moverName} improved the position`
          : `the position stays about the same`
    parts.push(`After it, ${dir} (engine: ${(r.evalAfterCp / 100).toFixed(2)}).`)
  }

  return parts.join(" ")
}

function pieceName(letter: string): string {
  return (
    { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" }[letter] ?? "piece"
  )
}
