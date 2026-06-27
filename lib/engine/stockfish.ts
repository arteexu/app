// lib/engine/stockfish.ts
// Thin, framework-agnostic wrapper around the vendored Stockfish WASM engine
// running in a Web Worker. We use the *lite single-threaded* build
// (public/engine/stockfish-18-lite-single.js + .wasm) because it does NOT
// require SharedArrayBuffer / cross-origin isolation (no COOP/COEP headers),
// so it loads reliably under the Next.js app router and works offline.
//
// The engine speaks UCI over postMessage. This module spawns the worker,
// performs the uci/isready handshake, and exposes analyze()/stop() with parsed
// `info` (depth, score, pv) and `bestmove` callbacks. It is browser-only —
// callers must guard against SSR (see useStockfish / the analysis page).

export const ENGINE_URL = "/engine/stockfish-18-lite-single.js"

/** A single principal-variation line as reported by `info ... pv ...`. */
export interface EngineLine {
  depth: number
  /** Score in centipawns, relative to the side to move. Null when it's a mate. */
  scoreCp: number | null
  /** Mate distance (in moves), relative to the side to move. Null otherwise. */
  scoreMate: number | null
  /** Principal variation as UCI moves, e.g. ["e2e4", "e7e5"]. */
  pv: string[]
  /** MultiPV rank (1 = best). Undefined when the engine didn't report it. */
  multipv?: number
  /** Nodes/sec, when reported. */
  nps?: number
}

export interface AnalyzeOptions {
  /** Fixed search depth. Ignored when `movetime` is given. */
  depth?: number
  /** Search time budget in ms. Takes precedence over `depth` when set. */
  movetime?: number
  /** Number of principal variations to report (MultiPV). Defaults to 1. */
  multiPv?: number
}

interface AnalyzeHandlers {
  onLine?: (line: EngineLine) => void
  onBestMove?: (bestMove: string | null, ponder: string | null) => void
}

type Listener = (line: string) => void

/** Parse a UCI `info` line into an EngineLine, or null if it carries no score. */
export function parseInfoLine(text: string): EngineLine | null {
  if (!text.startsWith("info ")) return null
  // Only consider lines that actually report a principal variation + score.
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
    if (tok === "depth") {
      depth = Number(tokens[i + 1]) || 0
    } else if (tok === "multipv") {
      multipv = Number(tokens[i + 1]) || undefined
    } else if (tok === "nps") {
      nps = Number(tokens[i + 1]) || undefined
    } else if (tok === "score") {
      const kind = tokens[i + 1]
      const val = Number(tokens[i + 2])
      if (kind === "cp") scoreCp = val
      else if (kind === "mate") scoreMate = val
    } else if (tok === "pv") {
      pv = tokens.slice(i + 1)
      break // pv is always last
    }
  }

  if (scoreCp === null && scoreMate === null) return null
  if (pv.length === 0) return null
  return { depth, scoreCp, scoreMate, pv, multipv, nps }
}

export class StockfishEngine {
  private worker: Worker
  // Transient listeners used only for the uci/isready handshake.
  private bootListeners = new Set<Listener>()
  // The single active analysis consumer. Routing through one pointer (rather
  // than per-call listeners) means a stale `bestmove` from a just-stopped
  // search can never steal the next search's stream — it's simply delivered to
  // whatever the current handlers are, which keeps live updates flowing.
  private handlers: AnalyzeHandlers | null = null
  private ready: Promise<void>
  private destroyed = false

  constructor(url: string = ENGINE_URL) {
    if (typeof window === "undefined") {
      throw new Error("StockfishEngine can only be created in the browser")
    }
    this.worker = new Worker(url)
    this.worker.onmessage = (e: MessageEvent) => {
      const data = typeof e.data === "string" ? e.data : String(e.data ?? "")
      for (const l of this.bootListeners) l(data)

      const h = this.handlers
      if (!h) return
      const info = parseInfoLine(data)
      if (info) {
        h.onLine?.(info)
        return
      }
      if (data.startsWith("bestmove")) {
        const parts = data.split(/\s+/)
        const best = parts[1] && parts[1] !== "(none)" ? parts[1] : null
        const ponderIdx = parts.indexOf("ponder")
        const ponder = ponderIdx >= 0 ? parts[ponderIdx + 1] ?? null : null
        h.onBestMove?.(best, ponder)
      }
    }
    this.ready = this.handshake()
  }

  /** Resolves once the engine answered `uciok` and `readyok`. */
  whenReady(): Promise<void> {
    return this.ready
  }

  private send(cmd: string) {
    if (this.destroyed) return
    this.worker.postMessage(cmd)
  }

  /** Wait until a line satisfying `match` arrives (or reject on timeout). */
  private waitFor(match: (line: string) => boolean, timeoutMs = 20000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.bootListeners.delete(listener)
        reject(new Error("Stockfish handshake timed out"))
      }, timeoutMs)
      const listener: Listener = (line) => {
        if (match(line)) {
          clearTimeout(timer)
          this.bootListeners.delete(listener)
          resolve()
        }
      }
      this.bootListeners.add(listener)
    })
  }

  private async handshake(): Promise<void> {
    this.send("uci")
    await this.waitFor((l) => l.trim() === "uciok")
    this.send("isready")
    await this.waitFor((l) => l.trim() === "readyok")
    this.send("ucinewgame")
  }

  /**
   * Analyze a position. Sends `stop` first so any in-flight search is cancelled,
   * then `position fen` + `go`. Resolves once a `bestmove` arrives for this
   * search. Pass handlers to stream depth/score/pv updates as it deepens.
   */
  async analyze(fen: string, opts: AnalyzeOptions, handlers: AnalyzeHandlers = {}): Promise<void> {
    await this.ready
    if (this.destroyed) return

    await new Promise<void>((resolve) => {
      this.handlers = {
        onLine: handlers.onLine,
        onBestMove: (best, ponder) => {
          handlers.onBestMove?.(best, ponder)
          resolve()
        },
      }
      // Cancel any current search, then reconfigure and search the new position.
      // Always (re)set MultiPV so single-PV callers reset a prior higher value.
      this.send("stop")
      this.send(`setoption name MultiPV value ${Math.max(1, Math.round(opts.multiPv ?? 1))}`)
      this.send(`position fen ${fen}`)
      if (opts.movetime && opts.movetime > 0) {
        this.send(`go movetime ${Math.round(opts.movetime)}`)
      } else {
        this.send(`go depth ${opts.depth ?? 16}`)
      }
    })
  }

  /**
   * Set a UCI option (e.g. "Skill Level", "UCI_LimitStrength", "UCI_Elo").
   * Used by Play vs Bot to weaken the engine to a chosen strength. Safe to call
   * any time after the engine is ready; persists until changed.
   */
  setOption(name: string, value: string | number | boolean) {
    this.send(`setoption name ${name} value ${value}`)
  }

  /**
   * Search the given position and resolve with the engine's chosen move (UCI),
   * or null if there is none (game over). Unlike analyze(), this is fire-and-get:
   * it ignores the streaming info lines and just returns the final `bestmove`.
   * Honors the engine's currently configured strength options.
   */
  async getBestMove(fen: string, opts: AnalyzeOptions = {}): Promise<string | null> {
    await this.ready
    if (this.destroyed) return null
    return new Promise<string | null>((resolve) => {
      this.handlers = {
        onBestMove: (best) => resolve(best),
      }
      this.send("stop")
      this.send("setoption name MultiPV value 1")
      this.send(`position fen ${fen}`)
      if (opts.movetime && opts.movetime > 0) {
        this.send(`go movetime ${Math.round(opts.movetime)}`)
      } else {
        this.send(`go depth ${opts.depth ?? 12}`)
      }
    })
  }

  /** Stop the current search (engine will still emit a final `bestmove`). */
  stop() {
    this.send("stop")
  }

  /** Terminate the worker and release all listeners. */
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.handlers = null
    try {
      this.worker.postMessage("quit")
    } catch {
      /* ignore */
    }
    this.bootListeners.clear()
    this.worker.terminate()
  }
}
