// lib/annotated/games.ts
// Typed loader over the pre-parsed annotated games. The JSON is bundled
// directly (no runtime PGN parsing) so both server and client code read it
// without a round-trip. Add a new game by ingesting it (see the
// `annotated-pgn-to-lesson` skill) and importing it into the GAMES array below.

import ccGame01 from "@/content/annotated-games/carlsen-caruana-2018-game-01.json"
import ccGame02 from "@/content/annotated-games/carlsen-caruana-2018-game-02.json"
import ccGame03 from "@/content/annotated-games/carlsen-caruana-2018-game-03.json"
import ccGame04 from "@/content/annotated-games/carlsen-caruana-2018-game-04.json"
import ccGame05 from "@/content/annotated-games/carlsen-caruana-2018-game-05.json"
import ccGame06 from "@/content/annotated-games/carlsen-caruana-2018-game-06.json"
import ccGame07 from "@/content/annotated-games/carlsen-caruana-2018-game-07.json"
import ccGame08 from "@/content/annotated-games/carlsen-caruana-2018-game-08.json"
import ccGame09 from "@/content/annotated-games/carlsen-caruana-2018-game-09.json"
import ccGame10 from "@/content/annotated-games/carlsen-caruana-2018-game-10.json"
import ccGame11 from "@/content/annotated-games/carlsen-caruana-2018-game-11.json"
import ccGame12 from "@/content/annotated-games/carlsen-caruana-2018-game-12.json"
import ccTiebreak1 from "@/content/annotated-games/carlsen-caruana-2018-tiebreak-1.json"
import ccTiebreak2 from "@/content/annotated-games/carlsen-caruana-2018-tiebreak-2.json"
import carlsenCaruana2018 from "@/content/annotated-games/carlsen-caruana-2018-tiebreak.json"
import type { AnnotatedGame, ConceptCheck } from "./types"

// The full 2018 Carlsen–Caruana World Championship, in match order: 12 classical
// games (all drawn) followed by the rapid tiebreak Carlsen swept 3–0. The final
// entry is tiebreak game 3, the clinching game.
const GAMES: AnnotatedGame[] = [
  ccGame01 as AnnotatedGame,
  ccGame02 as AnnotatedGame,
  ccGame03 as AnnotatedGame,
  ccGame04 as AnnotatedGame,
  ccGame05 as AnnotatedGame,
  ccGame06 as AnnotatedGame,
  ccGame07 as AnnotatedGame,
  ccGame08 as AnnotatedGame,
  ccGame09 as AnnotatedGame,
  ccGame10 as AnnotatedGame,
  ccGame11 as AnnotatedGame,
  ccGame12 as AnnotatedGame,
  ccTiebreak1 as AnnotatedGame,
  ccTiebreak2 as AnnotatedGame,
  carlsenCaruana2018 as AnnotatedGame,
]

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
