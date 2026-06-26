// lib/commentary/analysis-shared.ts
// Pure, runtime-agnostic helpers shared by the BROWSER engine path
// (engine-eval.ts) and the SERVER engine path (engine-node.ts). Importing this
// must NOT pull in the browser StockfishEngine (Web Worker) — only the
// EngineLine *type* is referenced (type-only import, erased at runtime).

import { Chess } from "chess.js"
import { uciPvToSan, uciToSan } from "@/lib/engine/format"
import { lineToCp } from "./classify"
import type { EngineLine } from "@/lib/engine/stockfish"
import type { CandidateLine, RefutationLine } from "./types"

/**
 * Parse a UCI `info` line into an EngineLine (with MultiPV index), or null if it
 * carries no scored principal variation. Mirrors stockfish.ts#parseInfoLine but
 * lives here so server code never imports the browser worker module.
 */
export function parseUciInfoLine(text: string): EngineLine | null {
  if (!text.startsWith("info ")) return null
  if (!text.includes(" pv ") || !text.includes(" score ")) return null

  const tokens = text.split(/\s+/)
  let depth = 0
  let scoreCp: number | null = null
  let scoreMate: number | null = null
  let nps: number | undefined
  let multipv: number | undefined
  let pv: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok === "depth") depth = Number(tokens[i + 1]) || 0
    else if (tok === "multipv") multipv = Number(tokens[i + 1]) || undefined
    else if (tok === "nps") nps = Number(tokens[i + 1]) || undefined
    else if (tok === "score") {
      const kind = tokens[i + 1]
      const val = Number(tokens[i + 2])
      if (kind === "cp") scoreCp = val
      else if (kind === "mate") scoreMate = val
    } else if (tok === "pv") {
      pv = tokens.slice(i + 1)
      break
    }
  }

  if (scoreCp === null && scoreMate === null) return null
  if (pv.length === 0) return null
  return { depth, scoreCp, scoreMate, pv, multipv, nps }
}

/** Synthesize the "after" eval for a terminal position (engine returns no score). */
export function terminalAfterLine(probeAfterMove: Chess): EngineLine | null {
  if (probeAfterMove.isCheckmate()) {
    // Side to move (the opponent) is mated → from their POV it's a loss.
    return { depth: 0, scoreCp: null, scoreMate: 0, pv: [] }
  }
  if (probeAfterMove.isGameOver()) {
    return { depth: 0, scoreCp: 0, scoreMate: null, pv: [] }
  }
  return null
}

export interface AssembledAnalysis {
  before: EngineLine // best line at fenBefore (for classification)
  after: EngineLine // eval after the played move (opponent to move)
  fenAfter: string
  candidates: CandidateLine[]
  refutations: RefutationLine[]
}

/**
 * Turn raw engine results into candidate + refutation lines (SAN, mover-POV
 * evals). `lines` are the MultiPV lines at `fenBefore` (best-first); `after` is
 * the eval after the played move (opponent to move, possibly synthesized).
 */
export function assembleCommentaryAnalysis(args: {
  fenBefore: string
  moveSan: string
  fenAfter: string
  lines: EngineLine[]
  after: EngineLine
}): AssembledAnalysis {
  const { fenBefore, fenAfter, lines, after } = args
  if (lines.length === 0) throw new Error("No candidate lines to assemble")

  const probe = new Chess(fenBefore)
  const mv = probe.move(args.moveSan)
  if (!mv) throw new Error(`Illegal move ${args.moveSan} for ${fenBefore}`)

  const before = lines[0]

  const candidates: CandidateLine[] = lines.map((l) => {
    const pvSan = uciPvToSan(fenBefore, l.pv)
    const evalCp = lineToCp(l) // mover POV (side to move at fenBefore)
    return {
      san: pvSan[0] ?? uciToSan(fenBefore, l.pv[0] ?? null) ?? "?",
      evalCp,
      mate: l.scoreMate,
      pvSan,
      endEvalCp: evalCp, // engine PV score IS the backed-up end-of-line eval
    }
  })

  const bestSan = candidates[0]?.san ?? null
  const bestEval = candidates[0]?.endEvalCp ?? 0
  const playedIsBest = bestSan != null && bestSan === mv.san

  const refutations: RefutationLine[] = []
  if (!playedIsBest && after.pv.length > 0) {
    refutations.push({
      ofMoveSan: mv.san,
      pvSan: [mv.san, ...uciPvToSan(fenAfter, after.pv)],
      endEvalCp: -lineToCp(after), // mover POV
    })
  }
  for (const c of candidates) {
    if (c.san === mv.san || c.san === bestSan) continue
    if (bestEval - c.endEvalCp > 50) {
      refutations.push({ ofMoveSan: c.san, pvSan: c.pvSan, endEvalCp: c.endEvalCp })
    }
  }

  return { before, after, fenAfter, candidates, refutations }
}
