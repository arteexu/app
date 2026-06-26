// lib/commentary/engine-node.ts
// SERVER-ONLY Stockfish wrapper (Node, nodejs runtime). Runs the `stockfish`
// npm package's WASM engine IN-PROCESS — no child process, no system binary.
//
// How it loads: the `stockfish` package exports initEngine(flavor?) → a Promise
// of an Emscripten Module where `engine.sendCommand(cmd)` sends UCI and
// `engine.listener = (line) => ...` receives UCI output. We load the
// "lite-single" flavor by default (~7MB, single-threaded → no SharedArrayBuffer
// / worker_threads needed, loads reliably under a Node server). We require() it
// via eval to keep Next's bundler from tracing the WASM; `serverExternalPackages:
// ["stockfish"]` in next.config.ts also marks it external.
//
// DEPLOYMENT HONESTY: this is designed for local dev and a long-running Node
// server. On serverless (e.g. Vercel functions) deep analysis can exceed the
// function's execution-time/memory limits, and the single shared engine instance
// won't persist across cold-started invocations. Keep depth/movetime modest there
// (or run this on a dedicated worker/server). See the route for env knobs.

import { Chess } from "chess.js"
import type { EngineLine } from "@/lib/engine/stockfish"
import {
  assembleCommentaryAnalysis,
  parseUciInfoLine,
  terminalAfterLine,
  type AssembledAnalysis,
} from "./analysis-shared"

interface SfEngine {
  listener?: (line: string) => void
  sendCommand: (cmd: string) => void
}
type InitEngine = (flavor?: string) => Promise<SfEngine>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __non_webpack_require__: any

function loadInitEngine(): InitEngine {
  // eval("require") resolves to the runtime CommonJS require, avoiding bundler
  // tracing of the WASM engine. `stockfish` has no types, so cast.
  const req =
    typeof __non_webpack_require__ !== "undefined"
      ? __non_webpack_require__
      : // eslint-disable-next-line no-eval
        (eval("require") as NodeRequire)
  return req("stockfish") as InitEngine
}

let enginePromise: Promise<SfEngine> | null = null

function getEngine(): Promise<SfEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const initEngine = loadInitEngine()
      const flavor = process.env.COMMENTARY_SERVER_ENGINE || "lite-single"
      const engine = await initEngine(flavor)
      await handshake(engine)
      return engine
    })().catch((err) => {
      enginePromise = null // allow retry on next request
      throw err
    })
  }
  return enginePromise
}

function handshake(engine: SfEngine): Promise<void> {
  return new Promise<void>((resolve) => {
    let stage = 0
    const done = () => {
      engine.listener = undefined
      resolve()
    }
    engine.listener = (line) => {
      const t = line.trim()
      if (stage === 0 && t === "uciok") {
        stage = 1
        engine.sendCommand("isready")
      } else if (stage === 1 && t === "readyok") {
        done()
      }
    }
    engine.sendCommand("uci")
    // Safety net: don't hang forever if the engine is quiet.
    setTimeout(() => { if (stage < 2) done() }, 5000)
  })
}

// Serialize analyses: one shared engine, one search at a time.
let chain: Promise<unknown> = Promise.resolve()
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn, fn)
  chain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export interface NodeAnalyzeOptions {
  depth?: number
  multiPv?: number
  movetime?: number // ms; takes precedence over depth when set
  timeoutMs?: number
}

/** Deepest EngineLine per MultiPV index (best-first), server-side. */
export async function analyzePositionNode(
  fen: string,
  opts: NodeAnalyzeOptions = {},
): Promise<EngineLine[]> {
  const engine = await getEngine()
  const multiPv = Math.max(1, Math.round(opts.multiPv ?? 1))
  const movetime = opts.movetime && opts.movetime > 0 ? Math.round(opts.movetime) : undefined
  const depth = opts.depth ?? 22
  const timeoutMs = opts.timeoutMs ?? (movetime ? movetime + 3000 : 15000)

  return runExclusive(
    () =>
      new Promise<EngineLine[]>((resolve) => {
        const byIdx = new Map<number, EngineLine>()
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          engine.listener = undefined
          resolve([...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l))
        }
        const timer = setTimeout(() => {
          // Ask the engine to stop; give it a brief grace to emit bestmove.
          engine.sendCommand("stop")
          setTimeout(finish, 300)
        }, timeoutMs)

        engine.listener = (line) => {
          if (typeof line !== "string") return
          const info = parseUciInfoLine(line)
          if (info) {
            byIdx.set(info.multipv ?? 1, info)
            return
          }
          if (line.startsWith("bestmove")) finish()
        }

        engine.sendCommand("stop")
        engine.sendCommand(`setoption name MultiPV value ${multiPv}`)
        engine.sendCommand(`position fen ${fen}`)
        engine.sendCommand(movetime ? `go movetime ${movetime}` : `go depth ${depth}`)
      }),
  )
}

/**
 * Server equivalent of computeCommentaryAnalysis: deep MultiPV candidates +
 * refutations + end-evals, assembled with the SAME pure helpers as the browser
 * path so SAN/eval normalization matches exactly.
 */
export async function computeCommentaryAnalysisNode(
  fenBefore: string,
  moveSan: string,
  opts: NodeAnalyzeOptions = {},
): Promise<AssembledAnalysis> {
  const probe = new Chess(fenBefore)
  const mv = probe.move(moveSan)
  if (!mv) throw new Error(`Illegal move ${moveSan} for ${fenBefore}`)
  const fenAfter = probe.fen()

  const lines = await analyzePositionNode(fenBefore, opts)
  if (lines.length === 0) throw new Error("Server engine returned no lines")

  let after = terminalAfterLine(probe)
  if (!after) {
    const afterLines = await analyzePositionNode(fenAfter, { ...opts, multiPv: 1 })
    after = afterLines[0]
    if (!after) throw new Error("Server engine returned no after-eval")
  }

  return assembleCommentaryAnalysis({ fenBefore, moveSan, fenAfter, lines, after })
}
