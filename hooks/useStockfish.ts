"use client"
// hooks/useStockfish.ts
// React hook around StockfishEngine. Spawns the worker once (browser-only),
// performs the UCI handshake, and re-runs a debounced analysis whenever the
// position (FEN), depth, MultiPV, or enabled flag changes. Exposes reactive
// analysis state already normalized to White's perspective with SAN best move +
// PV. Supports MultiPV (collecting info lines by rank) and resilient startup:
// the handshake auto-retries a couple of times (surfacing a transient
// "reconnecting" state) and a manual retry() re-initializes the worker. Any
// engine error auto-clears once the engine becomes ready / analysis resumes.

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
  /** MultiPV rank (1 = best line). */
  multipv: number
}

interface Options {
  fen: string
  enabled: boolean
  depth?: number
  /** Number of principal variations to compute/return (1–3). Defaults to 1. */
  multiPv?: number
  debounceMs?: number
}

export interface UseStockfishResult {
  /** Best line (MultiPV rank 1), kept for single-line consumers. */
  analysis: EngineAnalysis | null
  /** All current lines, ordered by MultiPV rank (rank 1 first). */
  lines: EngineAnalysis[]
  ready: boolean
  running: boolean
  error: string | null
  /** True while the engine is automatically re-attempting its handshake. */
  reconnecting: boolean
  /** Manually tear down + re-initialize the engine worker. */
  retry: () => void
}

const MAX_AUTO_RETRIES = 2
const RETRY_DELAY_MS = 700

export function useStockfish({
  fen,
  enabled,
  depth = 16,
  multiPv = 1,
  debounceMs = 250,
}: Options): UseStockfishResult {
  const engineRef = useRef<StockfishEngine | null>(null)
  const analyzingFenRef = useRef<string | null>(null)
  // Per-search accumulator: MultiPV rank -> latest line for that rank.
  const linesByRankRef = useRef<Map<number, EngineAnalysis>>(new Map())

  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const [analysis, setAnalysis] = useState<EngineAnalysis | null>(null)
  const [lines, setLines] = useState<EngineAnalysis[]>([])
  // Bump to force a fresh worker (manual retry).
  const [initAttempt, setInitAttempt] = useState(0)

  function retry() {
    setReady(false)
    setError(null)
    setReconnecting(true)
    setInitAttempt((n) => n + 1)
  }

  // Spawn the worker (browser only) with an auto-retrying handshake; tear it
  // down on unmount or when a manual retry bumps `initAttempt`.
  useEffect(() => {
    if (typeof window === "undefined") return
    let engine: StockfishEngine | null = null
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function boot(triesLeft: number) {
      if (cancelled) return
      try {
        engine = new StockfishEngine()
      } catch (e) {
        if (triesLeft > 0) {
          setReconnecting(true)
          retryTimer = setTimeout(() => boot(triesLeft - 1), RETRY_DELAY_MS)
          return
        }
        setReconnecting(false)
        setError(e instanceof Error ? e.message : "Failed to start engine")
        return
      }
      engineRef.current = engine
      engine
        .whenReady()
        .then(() => {
          if (cancelled) return
          setReady(true)
          setReconnecting(false)
          setError(null)
        })
        .catch((e: unknown) => {
          if (cancelled) return
          // Drop the failed worker before retrying so we don't leak workers.
          engine?.destroy()
          if (engineRef.current === engine) engineRef.current = null
          if (triesLeft > 0) {
            setReconnecting(true)
            retryTimer = setTimeout(() => boot(triesLeft - 1), RETRY_DELAY_MS)
          } else {
            setReconnecting(false)
            setError(e instanceof Error ? e.message : "Engine failed to initialize")
          }
        })
    }

    boot(MAX_AUTO_RETRIES)

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      engine?.destroy()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [initAttempt])

  // Debounced (re)analysis whenever the position / depth / MultiPV / toggle changes.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !ready || !enabled) return

    let cancelled = false
    const runFen = fen
    const pvCount = Math.min(3, Math.max(1, Math.round(multiPv)))

    const timer = setTimeout(() => {
      if (cancelled) return
      setRunning(true)
      analyzingFenRef.current = runFen
      linesByRankRef.current = new Map()
      void engine
        .analyze(
          runFen,
          { depth, multiPv: pvCount },
          {
            onLine: (line: EngineLine) => {
              if (cancelled || analyzingFenRef.current !== runFen) return
              const { whiteCp, whiteMate } = toWhitePerspective(line, runFen)
              const bestUci = line.pv[0] ?? null
              const rank = line.multipv ?? 1
              const entry: EngineAnalysis = {
                depth: line.depth,
                cp: line.scoreCp,
                mate: line.scoreMate,
                whiteCp,
                whiteMate,
                bestMoveUci: bestUci,
                bestMoveSan: uciToSan(runFen, bestUci),
                pvUci: line.pv,
                pvSan: uciPvToSan(runFen, line.pv),
                multipv: rank,
              }
              const map = linesByRankRef.current
              map.set(rank, entry)
              // Drop any ranks beyond the requested count (e.g. after lowering it).
              for (const key of map.keys()) {
                if (key > pvCount) map.delete(key)
              }
              const ordered = Array.from(map.values()).sort((a, b) => a.multipv - b.multipv)
              setLines(ordered)
              setAnalysis(map.get(1) ?? ordered[0] ?? null)
              // Analysis is flowing — clear any stale handshake/init error.
              setError(null)
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
      // Reset on teardown — also covers enabled → false (effect re-runs early).
      setRunning(false)
    }
  }, [fen, enabled, ready, depth, multiPv, debounceMs])

  return { analysis, lines, ready, running, error, reconnecting, retry }
}
