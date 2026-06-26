// lib/solitaire/generate.ts
// Engine-vs-engine game generation. Given a starting FEN and a per-move think
// time, drives a Stockfish worker to play BOTH sides move-by-move until the game
// ends NATURALLY (checkmate / stalemate / threefold / insufficient material /
// 50-move, via chess.js isGameOver()), then converts the produced line into the
// standard SolitaireGame shape so it can be handed to the existing Solitaire
// player. A very high ply guard exists only as a defensive safety net. Pure of
// React — the worker lifecycle lives in hooks/useGameGenerator.ts.

import { Chess } from "chess.js"
import type { StockfishEngine } from "@/lib/engine/stockfish"
import { STANDARD_START_FEN } from "./engine"
import { detectOpeningFromMoves } from "./detect-opening"
import type { GameResult, SolitaireGame } from "./types"

/** Engine strength / speed presets. `movetime` is per-move budget in ms. */
export interface SpeedPreset {
  id: SpeedId
  label: string
  movetime: number
  blurb: string
}

export type SpeedId = "fast" | "medium" | "high"

export const SPEED_PRESETS: Record<SpeedId, SpeedPreset> = {
  fast: { id: "fast", label: "Fast", movetime: 1000, blurb: "~1s per move — quick, casual play." },
  medium: { id: "medium", label: "Medium", movetime: 3000, blurb: "~3s per move — solid moves." },
  high: { id: "high", label: "High", movetime: 10000, blurb: "10s per move — strongest, but slow." },
}

/**
 * Pure safety net against a pathological non-terminating loop — NOT the expected
 * stopping point. Every normal engine-vs-engine game ends well before this via
 * chess.js end-of-game detection (`isGameOver()` covers checkmate, stalemate,
 * threefold repetition, insufficient material, and the 50-move rule), so shuffly
 * drawn games still terminate as draws. This guard only exists so a bug could
 * never hang the worker forever.
 */
export const MAX_PLIES_SAFETY = 1000

export interface GenProgress {
  /** SAN moves produced so far. */
  plies: string[]
  /** FEN of the current position. */
  fen: string
  /** Last move's squares, for board highlighting. */
  lastMove: { from: string; to: string } | null
}

export interface GenResult {
  moves: string[]
  result: GameResult
  finalFen: string
  /** True when the game reached a natural end (not the safety guard / cancel). */
  ended: boolean
}

/** Decide the recorded result from a finished/uncertain position. */
function deriveResult(chess: Chess): GameResult {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" : "1-0"
  // Any other game-over state is a draw: stalemate, threefold repetition,
  // insufficient material, or the 50-move rule (all covered by isGameOver()).
  // The safety-guard fallback (should never trigger) is likewise scored a draw.
  return "1/2-1/2"
}

/**
 * Play an engine-vs-engine game from `startFen`, asking the engine for a move at
 * `movetime` ms each turn. Reports progress after every move and bails out early
 * whenever `shouldCancel()` becomes true (the caller stops/destroys the worker).
 */
export async function generateGame(
  engine: StockfishEngine,
  startFen: string,
  movetime: number,
  onProgress: (p: GenProgress) => void,
  shouldCancel: () => boolean,
): Promise<GenResult> {
  const chess = new Chess(startFen)
  const moves: string[] = []

  // Primary stop condition is chess.isGameOver() (checkmate / stalemate /
  // threefold / insufficient material / 50-move). The ply guard is only a
  // defensive fallback and is not expected to ever be the reason we stop.
  while (!chess.isGameOver() && moves.length < MAX_PLIES_SAFETY) {
    if (shouldCancel()) break

    const fen = chess.fen()
    const best = await new Promise<string | null>((resolve) => {
      void engine.analyze(fen, { movetime }, { onBestMove: (b) => resolve(b) })
    })

    if (shouldCancel()) break
    if (!best) break // (none) or stopped — treat as end of generation

    const from = best.slice(0, 2)
    const to = best.slice(2, 4)
    const promotion = best.length > 4 ? best[4] : undefined

    let mv
    try {
      mv = chess.move({ from, to, promotion })
    } catch {
      break // illegal move from the engine should never happen; fail safe
    }
    if (!mv) break

    moves.push(mv.san)
    onProgress({ plies: [...moves], fen: chess.fen(), lastMove: { from: mv.from, to: mv.to } })
  }

  return {
    moves,
    result: deriveResult(chess),
    finalFen: chess.fen(),
    ended: chess.isGameOver(),
  }
}

export interface BuildGameOptions {
  moves: string[]
  result: GameResult
  /** Position the engine started from. */
  startFen: string
  openingName: string
  eco?: string
  movetime: number
  speedLabel: string
  ended: boolean
}

/**
 * Convert a generated line into a transient SolitaireGame. Standard-start games
 * omit `startFen` (so they behave exactly like the curated games); opening /
 * custom-FEN games carry it so the player and helpers offset correctly.
 */
export function buildGeneratedGame(opts: BuildGameOptions): SolitaireGame {
  const isStandard = opts.startFen === STANDARD_START_FEN
  const now = new Date()
  const cap = opts.ended ? "" : " Reached the move cap before a natural finish."

  // The opening-picker already supplies a real opening name; for the
  // "Custom Position" / "Standard start position" paths the name isn't a known
  // opening, so try to detect one from the moves (only meaningful for a standard
  // start — custom-FEN games can't be matched and keep their fallback name).
  const KNOWN = opts.openingName !== "Custom Position" && opts.openingName !== "Standard start position"
  const detected = !KNOWN && isStandard ? detectOpeningFromMoves(opts.moves) : null
  const opening = KNOWN ? opts.openingName : detected ?? opts.openingName

  return {
    id: `engine-${now.getTime()}`,
    title: `Engine Game — ${opening}`,
    opening,
    eco: opts.eco && opts.eco.length > 0 ? opts.eco : "ENG",
    white: "Engine",
    black: "Engine",
    event: "Computer vs Computer",
    year: now.getFullYear(),
    result: opts.result,
    difficulty: 3,
    note:
      `Generated by Stockfish at ${opts.speedLabel} strength (${opts.movetime} ms/move) ` +
      `on ${now.toLocaleDateString()}.${cap}`,
    startFen: isStandard ? undefined : opts.startFen,
    isGenerated: true,
    moves: opts.moves,
  }
}
