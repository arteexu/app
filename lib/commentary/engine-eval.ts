// lib/commentary/engine-eval.ts
// Browser-only helpers: drive StockfishEngine to get evals for a move. Two paths:
//   - computeMoveEvals: light, single-PV before/after (Phase 1 / FeedbackPanel).
//   - computeCommentaryAnalysis: rigorous, deep MultiPV candidates + refutations
//     with end-of-line evals (Phase 2 / master mode). Stockfish runs in a Web
//     Worker, so these must only be called client-side.

import { Chess } from "chess.js"
import { StockfishEngine, type EngineLine } from "@/lib/engine/stockfish"
import { MATE_CP } from "./classify"
import {
  assembleCommentaryAnalysis,
  terminalAfterLine,
  type AssembledAnalysis,
} from "./analysis-shared"

/** Resolve the deepest single-PV EngineLine for a FEN (last `info` before bestmove). */
async function analyzeFen(
  engine: StockfishEngine,
  fen: string,
  depth: number,
  timeoutMs = 15000,
): Promise<EngineLine> {
  let last: EngineLine | null = null
  const run = engine.analyze(fen, { depth }, { onLine: (line) => { last = line } })
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  await Promise.race([run, timeout])
  if (!last) throw new Error(`No engine evaluation for ${fen}`)
  return last
}

/**
 * MultiPV analysis: returns the deepest line per MultiPV index, sorted best-first.
 * On timeout, returns whatever depth was reached so far (still valid lines).
 */
async function analyzeMultiPv(
  engine: StockfishEngine,
  fen: string,
  depth: number,
  multiPv: number,
  timeoutMs = 30000,
): Promise<EngineLine[]> {
  const byIdx = new Map<number, EngineLine>()
  const run = engine.analyze(fen, { depth, multiPv }, {
    onLine: (line) => byIdx.set(line.multipv ?? 1, line),
  })
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  await Promise.race([run, timeout])
  if (byIdx.size === 0) throw new Error(`No engine evaluation for ${fen}`)
  return [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line)
}

export interface MoveEvals {
  before: EngineLine
  after: EngineLine
  fenAfter: string
}

/** Light path: single-PV before/after evals (Phase 1). */
export async function computeMoveEvals(
  fenBefore: string,
  moveSan: string,
  depth: number,
): Promise<MoveEvals> {
  const probe = new Chess(fenBefore)
  const mv = probe.move(moveSan)
  if (!mv) throw new Error(`Illegal move ${moveSan} for ${fenBefore}`)
  const fenAfter = probe.fen()

  const engine = new StockfishEngine()
  try {
    await engine.whenReady()
    const before = await analyzeFen(engine, fenBefore, depth)
    const after = await analyzeAfter(engine, probe, fenAfter, depth)
    return { before, after, fenAfter }
  } finally {
    engine.destroy()
  }
}

/** After-move eval, synthesizing terminal (mate/stalemate) positions. */
async function analyzeAfter(
  engine: StockfishEngine,
  probeAfterMove: Chess,
  fenAfter: string,
  depth: number,
): Promise<EngineLine> {
  return terminalAfterLine(probeAfterMove) ?? analyzeFen(engine, fenAfter, depth)
}

export type CommentaryAnalysis = AssembledAnalysis

/**
 * Rigorous BROWSER path: deep MultiPV at fenBefore → candidate + refutation
 * lines, assembled with the shared helper (identical to the server path).
 * Capped by the browser worker's single-thread speed + the analyze timeout.
 */
export async function computeCommentaryAnalysis(
  fenBefore: string,
  moveSan: string,
  depth: number,
  multiPv: number,
): Promise<CommentaryAnalysis> {
  const probe = new Chess(fenBefore)
  const mv = probe.move(moveSan)
  if (!mv) throw new Error(`Illegal move ${moveSan} for ${fenBefore}`)
  const fenAfter = probe.fen()

  const engine = new StockfishEngine()
  try {
    await engine.whenReady()
    const lines = await analyzeMultiPv(engine, fenBefore, depth, multiPv)
    const after = await analyzeAfter(engine, probe, fenAfter, depth)
    return assembleCommentaryAnalysis({ fenBefore, moveSan, fenAfter, lines, after })
  } finally {
    engine.destroy()
  }
}

export { MATE_CP }
