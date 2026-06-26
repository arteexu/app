"use client"
// hooks/useGameGenerator.ts
// React wrapper around the engine-vs-engine generator. Owns the Stockfish worker
// lifecycle: it spawns a fresh worker per generation run, streams live progress
// (move list, board FEN, move count, elapsed time) into reactive state, supports
// cancellation, and always terminates the worker on cancel / completion / unmount.

import { useCallback, useEffect, useRef, useState } from "react"
import { StockfishEngine } from "@/lib/engine/stockfish"
import {
  buildGeneratedGame,
  generateGame,
  type GenProgress,
} from "@/lib/solitaire/generate"
import type { GameResult, SolitaireGame } from "@/lib/solitaire/types"

export type GenStatus = "idle" | "starting" | "running" | "done" | "cancelled" | "error"

export interface GenState {
  status: GenStatus
  plies: string[]
  fen: string | null
  lastMove: { from: string; to: string } | null
  moveCount: number
  elapsedMs: number
  result: GameResult | null
  error: string | null
  /** The finished, ready-to-play game (only set when status === "done"). */
  game: SolitaireGame | null
}

export interface RunConfig {
  /** Position the engine plays from. */
  startFen: string
  openingName: string
  eco?: string
  movetime: number
  speedLabel: string
}

const INITIAL: GenState = {
  status: "idle",
  plies: [],
  fen: null,
  lastMove: null,
  moveCount: 0,
  elapsedMs: 0,
  result: null,
  error: null,
  game: null,
}

export function useGameGenerator() {
  const engineRef = useRef<StockfishEngine | null>(null)
  const cancelledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const [state, setState] = useState<GenState>(INITIAL)

  const stopTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const teardownEngine = useCallback(() => {
    engineRef.current?.destroy()
    engineRef.current = null
  }, [])

  // Always release the worker + timer if the component unmounts mid-run.
  useEffect(() => {
    return () => {
      cancelledRef.current = true
      stopTimer()
      teardownEngine()
    }
  }, [stopTimer, teardownEngine])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    // Nudge the engine to emit a quick bestmove so the in-flight analyze()
    // resolves; the generation loop then sees the cancel flag and bails out,
    // after which the run() finally-block tears the worker down.
    engineRef.current?.stop()
    setState((s) =>
      s.status === "running" || s.status === "starting" ? { ...s, status: "cancelled" } : s,
    )
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = true
    stopTimer()
    teardownEngine()
    setState(INITIAL)
  }, [stopTimer, teardownEngine])

  const generate = useCallback(
    async (cfg: RunConfig) => {
      // Start clean: tear down any prior worker, reset flags + state.
      cancelledRef.current = false
      stopTimer()
      teardownEngine()
      setState({ ...INITIAL, status: "starting", fen: cfg.startFen })

      let engine: StockfishEngine
      try {
        engine = new StockfishEngine()
      } catch (e) {
        setState((s) => ({
          ...s,
          status: "error",
          error: e instanceof Error ? e.message : "Failed to start the engine.",
        }))
        return
      }
      engineRef.current = engine

      try {
        await engine.whenReady()
      } catch (e) {
        teardownEngine()
        setState((s) => ({
          ...s,
          status: "error",
          error: e instanceof Error ? e.message : "Engine failed to initialize.",
        }))
        return
      }

      if (cancelledRef.current) {
        teardownEngine()
        setState((s) => ({ ...s, status: "cancelled" }))
        return
      }

      startedAtRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setState((s) =>
          s.status === "running" ? { ...s, elapsedMs: Date.now() - startedAtRef.current } : s,
        )
      }, 200)
      setState((s) => ({ ...s, status: "running" }))

      try {
        const res = await generateGame(
          engine,
          cfg.startFen,
          cfg.movetime,
          (p: GenProgress) =>
            setState((s) => ({
              ...s,
              plies: p.plies,
              fen: p.fen,
              lastMove: p.lastMove,
              moveCount: p.plies.length,
            })),
          () => cancelledRef.current,
        )

        stopTimer()

        if (cancelledRef.current) {
          teardownEngine()
          setState((s) => ({ ...s, status: "cancelled" }))
          return
        }

        const game = buildGeneratedGame({
          moves: res.moves,
          result: res.result,
          startFen: cfg.startFen,
          openingName: cfg.openingName,
          eco: cfg.eco,
          movetime: cfg.movetime,
          speedLabel: cfg.speedLabel,
          ended: res.ended,
        })

        teardownEngine()
        setState((s) => ({
          ...s,
          status: "done",
          game,
          result: res.result,
          plies: res.moves,
          fen: res.finalFen,
          moveCount: res.moves.length,
          elapsedMs: Date.now() - startedAtRef.current,
        }))
      } catch (e) {
        stopTimer()
        teardownEngine()
        setState((s) => ({
          ...s,
          status: "error",
          error: e instanceof Error ? e.message : "Generation failed.",
        }))
      }
    },
    [stopTimer, teardownEngine],
  )

  return { state, generate, cancel, reset }
}
