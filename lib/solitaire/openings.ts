// lib/solitaire/openings.ts
// A small catalogue of well-known openings the engine-game generator can start
// from. Each opening is expressed as a SAN move list from the standard start;
// `fenForOpening` replays those moves to get the position the engine begins
// playing from. "Standard start position" has no moves (the initial position).

import { Chess } from "chess.js"
import { STANDARD_START_FEN } from "./engine"

export interface Opening {
  id: string
  name: string
  /** ECO code (best-effort, for display). Empty for the standard start. */
  eco: string
  /** SAN moves from the standard start reaching this opening's main-line position. */
  moves: string[]
}

export const OPENINGS: Opening[] = [
  { id: "standard", name: "Standard start position", eco: "", moves: [] },
  { id: "ruy-lopez", name: "Ruy Lopez", eco: "C60", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { id: "italian", name: "Italian Game", eco: "C50", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { id: "sicilian", name: "Sicilian Defense", eco: "B20", moves: ["e4", "c5"] },
  { id: "french", name: "French Defense", eco: "C00", moves: ["e4", "e6"] },
  { id: "caro-kann", name: "Caro-Kann Defense", eco: "B10", moves: ["e4", "c6"] },
  { id: "queens-gambit", name: "Queen's Gambit", eco: "D06", moves: ["d4", "d5", "c4"] },
  { id: "kings-indian", name: "King's Indian Defense", eco: "E60", moves: ["d4", "Nf6", "c4", "g6"] },
  { id: "english", name: "English Opening", eco: "A10", moves: ["c4"] },
  { id: "scandinavian", name: "Scandinavian Defense", eco: "B01", moves: ["e4", "d5"] },
  { id: "london", name: "London System", eco: "D02", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
]

export function getOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id)
}

/** Replay an opening's moves to get the FEN the engine should start playing from. */
export function fenForOpening(opening: Opening): string {
  if (opening.moves.length === 0) return STANDARD_START_FEN
  const chess = new Chess()
  for (const m of opening.moves) chess.move(m)
  return chess.fen()
}
