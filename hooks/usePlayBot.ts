"use client"
// hooks/usePlayBot.ts
// Owns a dedicated Stockfish worker for Play vs Bot and weakens it to a chosen
// strength via UCI `Skill Level` (+ `UCI_LimitStrength`/`UCI_Elo` where honored).
// Exposes requestMove(fen) → the engine's move as { from, to, promotion } so the
// caller can apply it with chess.js. Reuses the existing StockfishEngine wrapper
// and public/engine assets (no new engine).

import { useCallback, useEffect, useRef, useState } from "react"
import { StockfishEngine, type EngineLine } from "@/lib/engine/stockfish"
import type { BotLevel } from "@/lib/play/types"

export interface BotMove {
  from: string
  to: string
  promotion?: string
}

export interface UsePlayBotResult {
  ready: boolean
  error: string | null
  /** Ask the engine for its move in the given position (null if game over). */
  requestMove: (fen: string) => Promise<BotMove | null>
  /** Quick eval (centipawns, relative to the side to move) for draw decisions. */
  evaluate: (fen: string) => Promise<number | null>
}

export function usePlayBot(level: BotLevel): UsePlayBotResult {
  const engineRef = useRef<StockfishEngine | null>(null)
  const levelRef = useRef(level)
  levelRef.current = level

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Engine failed to initialize"),
      )
    return () => {
      engine?.destroy()
      engineRef.current = null
    }
  }, [])

  // (Re)apply strength options whenever the engine becomes ready or level changes.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !ready) return
    engine.setOption("Skill Level", level.skill)
    if (level.uciElo != null) {
      engine.setOption("UCI_LimitStrength", true)
      engine.setOption("UCI_Elo", level.uciElo)
    } else {
      engine.setOption("UCI_LimitStrength", false)
    }
  }, [ready, level])

  // Stable identities (they only read from refs) so consumers can safely list
  // these in effect deps without the effect re-running on every render. This
  // matters for the Play-vs-Bot move loop: an unstable requestMove would make
  // its effect re-run on each clock tick and cancel the in-flight engine
  // request via cleanup, so the bot's move would never be applied.
  const requestMove = useCallback(async (fen: string): Promise<BotMove | null> => {
    const engine = engineRef.current
    if (!engine) return null
    const uci = await engine.getBestMove(fen, { movetime: levelRef.current.moveTimeMs })
    if (!uci || uci.length < 4) return null
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    }
  }, [])

  const evaluate = useCallback(async (fen: string): Promise<number | null> => {
    const engine = engineRef.current
    if (!engine) return null
    let cp: number | null = null
    await engine.analyze(
      fen,
      { depth: 12 },
      {
        onLine: (line: EngineLine) => {
          if (line.scoreMate != null) cp = line.scoreMate > 0 ? 100000 : -100000
          else if (line.scoreCp != null) cp = line.scoreCp
        },
      },
    )
    return cp
  }, [])

  return { ready, error, requestMove, evaluate }
}
