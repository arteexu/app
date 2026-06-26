"use client"
// hooks/useStockfish.ts
// React hook around StockfishEngine. Spawns the worker once (browser-only),
// performs the UCI handshake, and re-runs a debounced analysis whenever the
// position (FEN), depth, or enabled flag changes. Exposes reactive analysis
// state already normalized to White's perspective with SAN best move + PV.

import { useEffect, useRef, useState } from "react"
import { StockfishEngine, type EngineLine } from "@/lib/engine/stockfish"
import { toWhitePerspective, uciPvToSan, uciToSan } from "@/lib/engine/format"

export interface EngineAnalysis {
  depth: number
  /** Centipawns relative to the side to move (raw engine output). */
  cp: number | null
  /** Mate distance relative to the side to move. */
  mate: number | null
  /** Centipawns from White's perspective (for the eval bar). */
  whiteCp: number | null
  /** Mate distance from White's perspective. */
  whiteMate: number | null
  bestMoveUci: string | null
  bestMoveSan: string | null
  pvUci: string[]
  pvSan: string[]
}

interface Options {
  fen: string
  enabled: boolean
  depth?: number
  debounceMs?: number
}

export interface UseStockfishResult {
  analysis: EngineAnalysis | null
  ready: boolean
  running: boolean
  error: string | null
}

export function useStockfish({ fen, enabled, depth = 16, debounceMs = 250 }: Options): UseStockfishResult {
  const engineRef = useRef<StockfishEngine | null>(null)
  const analyzingFenRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null)

  // Spawn the worker once on mount (browser only); tear it down on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return
    let engine: StockfishEngine | null = null
    try {
      engine = new StockfishEngine()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start engine")
      return
    }
    engineRef.current = engine
    engine
      .whenReady()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Engine failed to initialize"))
    return () => {
      engine?.destroy()
      engineRef.current = null
    }
  }, [])

  // Debounced (re)analysis whenever the position / depth / toggle changes.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !ready) return

    if (!enabled) {
      engine.stop()
      setRunning(false)
      return
    }

    let cancelled = false
    const runFen = fen

    const timer = setTimeout(() => {
      if (cancelled) return
      setRunning(true)
      analyzingFenRef.current = runFen
      void engine
        .analyze(
          runFen,
          { depth },
          {
            onLine: (line: EngineLine) => {
              if (cancelled || analyzingFenRef.current !== runFen) return
              const { whiteCp, whiteMate } = toWhitePerspective(line, runFen)
              const bestUci = line.pv[0] ?? null
              setAnalysis({
                depth: line.depth,
                cp: line.scoreCp,
                mate: line.scoreMate,
                whiteCp,
                whiteMate,
                bestMoveUci: bestUci,
                bestMoveSan: uciToSan(runFen, bestUci),
                pvUci: line.pv,
                pvSan: uciPvToSan(runFen, line.pv),
              })
            },
            onBestMove: () => {
              if (!cancelled) setRunning(false)
            },
          },
        )
        .catch(() => {
          if (!cancelled) setRunning(false)
        })
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
      engine.stop()
    }
  }, [fen, enabled, ready, depth, debounceMs])

  return { analysis, ready, running, error }
}
