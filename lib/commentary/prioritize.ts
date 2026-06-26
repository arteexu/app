// lib/commentary/prioritize.ts
// CCC-style top-k selection of "what this move is about", by eval impact +
// which tags fired. Used to focus the LLM (and shown in the eval page).

import type { ConceptRecord } from "./types"

export interface Signal {
  kind: string
  text: string
  weight: number
}

export function prioritizeSignals(r: ConceptRecord, k = 4): Signal[] {
  const s: Signal[] = []

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
