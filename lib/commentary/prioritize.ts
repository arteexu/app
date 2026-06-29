// lib/commentary/prioritize.ts
// CCC-style top-k selection of "what this move is about". CCC (Kim et al., §3.1.2)
// prioritizes concepts by the magnitude of their before→after change; we surface
// those concept deltas here AND keep the app's concrete tactical signals (attacks,
// patterns, sacrifices) so the LLM gets both the abstract concept guidance and the
// verified facts. Used to focus the LLM and shown in the eval page.

import type { ConceptRecord } from "./types"
import { COMMENTARY_TOP_K_CONCEPTS } from "./config"

export interface Signal {
  kind: string
  text: string
  weight: number
}

export function prioritizeSignals(r: ConceptRecord, k = COMMENTARY_TOP_K_CONCEPTS): Signal[] {
  const s: Signal[] = []

  // CCC concept-delta signals: the concepts this move changed the most. Weight by
  // normalized importance so they interleave with the concrete tactical signals.
  for (const pc of r.prioritizedConcepts ?? []) {
    s.push({
      kind: "concept",
      text: `${pc.label} ${pc.direction} (Δ ${pc.delta >= 0 ? "+" : ""}${pc.delta})`,
      weight: 120 + Math.min(140, Math.round(pc.importance * 80)),
    })
  }

  // Eval swing is the dominant signal (CCC prioritizes by before→after change).
  s.push({
    kind: "eval",
    text: `${r.classification} (cpLoss ${r.cpLoss}, Δ ${(r.evalDeltaCp / 100).toFixed(2)})`,
    weight: Math.min(1000, Math.abs(r.evalDeltaCp)) + (r.classification === "best" ? 60 : 0),
  })

  if (r.moveSan.includes("#")) s.push({ kind: "mate", text: "delivers checkmate", weight: 1000 })
  else if (r.moveSan.includes("+")) s.push({ kind: "check", text: "gives check", weight: 220 })

  for (const a of r.legalAttacks.filter((x) => !x.defended && x.targetPiece !== "p")) {
    s.push({
      kind: "win-material",
      text: `${a.byPiece}${a.bySquare} attacks undefended ${a.targetPiece}@${a.targetSquare}`,
      weight: 200,
    })
  }

  for (const id of r.matchedTacticalPatternIds) s.push({ kind: "pattern", text: id, weight: 180 })

  if (r.materialDelta < 0 && r.evalAfterCp > 150) {
    s.push({ kind: "sacrifice", text: `gave ${-r.materialDelta} pawn(s) for initiative`, weight: 240 })
  }

  for (const h of r.hangingPieces.filter((x) => x.color === r.side)) {
    s.push({ kind: "own-hanging", text: `own ${h.piece}@${h.square} is loose`, weight: 160 })
  }

  return s.sort((a, b) => b.weight - a.weight).slice(0, k)
}
