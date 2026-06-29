// lib/commentary/engine-node.ts
// SERVER-ONLY Stockfish wrapper (Node, nodejs runtime). Runs the `stockfish`
// npm package's WASM engine in a dedicated CHILD PROCESS and talks UCI over
// stdin/stdout.
//
// Why a child process instead of loading the WASM in-process: the `stockfish`
// package ships an Emscripten build that, when instantiated inside Next's
// server runtime, fails with a WASM LinkError ("memory import must be a
// WebAssembly.Memory object"). The exact same engine loads and runs perfectly
// in a plain Node process. Each engine flavor's bin file (e.g.
// stockfish-18-lite-single.js) is itself a runnable Node UCI program: run as
// `node <bin>.js` it starts a readline loop that reads UCI commands from stdin
// and writes engine output to stdout. We spawn that, which sidesteps the
// runtime's WASM quirks entirely while keeping the engine isolated and easy to
// terminate.
//
// We default to the "lite-single" flavor (~7MB wasm, single-threaded → no
// SharedArrayBuffer / worker_threads needed). `serverExternalPackages:
// ["stockfish"]` in next.config.ts keeps the package external; we resolve the
// engine bin path via the runtime require so the bundler never traces the WASM.
//
// DEPLOYMENT HONESTY: this is designed for local dev and a long-running Node
// server. On serverless (e.g. Vercel functions) deep analysis can exceed the
// function's execution-time/memory limits, and the single shared engine process
// won't persist across cold-started invocations. Keep depth/movetime modest
// there (or run this on a dedicated worker/server). See the route for env knobs.

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { Chess } from "chess.js"
import type { EngineLine } from "@/lib/engine/stockfish"
import {
  assembleCommentaryAnalysis,
  parseUciInfoLine,
  terminalAfterLine,
  type AssembledAnalysis,
} from "./analysis-shared"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __non_webpack_require__: any

/** Runtime CommonJS require, avoiding bundler tracing of the WASM engine. */
function runtimeRequire(): NodeRequire {
  return typeof __non_webpack_require__ !== "undefined"
    ? __non_webpack_require__
    : // eslint-disable-next-line no-eval
      (eval("require") as NodeRequire)
}

/** Map a flavor keyword to the engine bin filename suffix. */
const FLAVOR_SUFFIX: Record<string, string> = {
  "lite-single": "-lite-single",
  "single-lite": "-lite-single",
  lite: "-lite",
  single: "-single",
  full: "",
  asm: "-asm",
}

/** Resolve the absolute path to the engine bin JS file for a flavor. */
function resolveEnginePath(flavor: string): string {
  const req = runtimeRequire()
  const pkg = req("stockfish/package.json") as { buildVersion?: string; version?: string }
  const version = pkg.buildVersion || (pkg.version ? pkg.version.split(".")[0] : "18")
  const suffix = FLAVOR_SUFFIX[flavor.toLowerCase()] ?? "-lite-single"
  return req.resolve(`stockfish/bin/stockfish-${version}${suffix}.js`)
}

/** A spawned engine: send UCI commands, receive lines, terminate. */
interface SfEngine {
  send: (cmd: string) => void
  setListener: (fn: ((line: string) => void) | null) => void
  kill: () => void
  child: ChildProcessWithoutNullStreams
}

let enginePromise: Promise<SfEngine> | null = null

function spawnEngine(): SfEngine {
  const flavor = process.env.COMMENTARY_SERVER_ENGINE || "lite-single"
  const enginePath = resolveEnginePath(flavor)
  const child = spawn(process.execPath, [enginePath], {
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams

  let listener: ((line: string) => void) | null = null
  let buf = ""

  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    buf += chunk
    let idx: number
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "")
      buf = buf.slice(idx + 1)
      if (line.length > 0) listener?.(line)
    }
  })
  // Engine diagnostics go to stderr; swallow to avoid noisy server logs but
  // keep them reachable if something goes wrong during init.
  child.stderr.setEncoding("utf8")

  const engine: SfEngine = {
    child,
    send: (cmd) => {
      if (child.stdin.writable) child.stdin.write(cmd + "\n")
    },
    setListener: (fn) => {
      listener = fn
    },
    kill: () => {
      try {
        child.stdin.end()
      } catch {
        /* noop */
      }
      try {
        child.kill()
      } catch {
        /* noop */
      }
    },
  }

  // If the engine process dies, drop the cached instance so the next request
  // respawns a fresh one.
  const onDeath = () => {
    if (enginePromise && currentEngine === engine) enginePromise = null
  }
  child.on("exit", onDeath)
  child.on("error", onDeath)

  return engine
}

let currentEngine: SfEngine | null = null

function getEngine(): Promise<SfEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const engine = spawnEngine()
      currentEngine = engine
      await handshake(engine)
      return engine
    })().catch((err) => {
      enginePromise = null
      throw err
    })
  }
  return enginePromise
}

function handshake(engine: SfEngine): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let stage = 0
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      engine.child.removeListener("exit", onExit)
      engine.setListener(null)
      if (err) {
        engine.kill()
        reject(err)
      } else {
        resolve()
      }
    }
    const onExit = () =>
      finish(new Error("engine process exited during handshake"))
    engine.child.once("exit", onExit)

    engine.setListener((line) => {
      const t = line.trim()
      if (stage === 0 && t === "uciok") {
        stage = 1
        engine.send("isready")
      } else if (stage === 1 && t === "readyok") {
        finish()
      }
    })
    engine.send("uci")
    const timer = setTimeout(
      () => finish(new Error("engine handshake timed out")),
      10000,
    )
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
          engine.child.removeListener("exit", onExit)
          engine.setListener(null)
          resolve([...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l))
        }
        const onExit = () => finish()
        engine.child.once("exit", onExit)

        const timer = setTimeout(() => {
          // Ask the engine to stop; give it a brief grace to emit bestmove.
          engine.send("stop")
          setTimeout(finish, 300)
        }, timeoutMs)

        engine.setListener((line) => {
          const info = parseUciInfoLine(line)
          if (info) {
            byIdx.set(info.multipv ?? 1, info)
            return
          }
          if (line.startsWith("bestmove")) finish()
        })

        engine.send("stop")
        engine.send(`setoption name MultiPV value ${multiPv}`)
        engine.send(`position fen ${fen}`)
        engine.send(movetime ? `go movetime ${movetime}` : `go depth ${depth}`)
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
