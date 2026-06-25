// lib/annotated/games.ts
// Typed loader over the pre-parsed annotated games. The JSON is bundled
// directly (no runtime PGN parsing) so both server and client code read it
// without a round-trip. Add a new game by ingesting it (see the
// `annotated-pgn-to-lesson` skill) and importing it into the GAMES array below.

import carlsenCaruana2018 from "@/content/annotated-games/carlsen-caruana-2018-tiebreak.json"
import type { AnnotatedGame, ConceptCheck } from "./types"

const GAMES: AnnotatedGame[] = [carlsenCaruana2018 as AnnotatedGame]

export function getAllAnnotatedGames(): AnnotatedGame[] {
  return GAMES
}

export function getAnnotatedGame(id: string): AnnotatedGame | undefined {
  return GAMES.find((g) => g.id === id)
}

/** The standard chess starting position (before any ply). */
export const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

/** FEN at a given step: 0 = start, k = after the kth ply. */
export function fenAtStep(game: AnnotatedGame, step: number): string {
  if (step <= 0) return INITIAL_FEN
  const ply = game.plies[Math.min(step, game.plies.length) - 1]
  return ply.fen
}

/** Index concept checks by the ply they are attached to. */
export function conceptChecksByPly(game: AnnotatedGame): Map<number, ConceptCheck> {
  const map = new Map<number, ConceptCheck>()
  for (const cc of game.conceptChecks ?? []) map.set(cc.ply, cc)
  return map
}

/** Pretty move label, e.g. "1.e4" or "5...Bc5". */
export function plyLabel(moveNumber: number, side: "white" | "black", san: string): string {
  return side === "white" ? `${moveNumber}.${san}` : `${moveNumber}...${san}`
}
