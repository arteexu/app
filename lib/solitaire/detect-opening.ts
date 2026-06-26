// lib/solitaire/detect-opening.ts
// Rudimentary opening detector. Matches the LONGEST known opening line that is a
// prefix of a game's SAN moves, so more specific variations win over generic
// ones (e.g. "…Bb5 a6" → Ruy Lopez, Morphy Defense beats plain Ruy Lopez).
//
// The lookup table is built from the shared openings catalogue (openings.ts) plus
// a set of extra main-line / variation prefixes here, keeping a single source of
// truth for the catalogue entries while still covering common openings.

import type { SolitaireGame } from "./types"
import { STANDARD_START_FEN, normalizeSan } from "./engine"
import { OPENINGS } from "./openings"

export interface OpeningLine {
  name: string
  /** Leading SAN moves (from the standard start) that identify the opening. */
  moves: string[]
}

// Extra lines beyond the catalogue: popular openings and a few key variations.
// Order doesn't matter — detection always picks the longest matching prefix.
const EXTRA_OPENING_LINES: OpeningLine[] = [
  // 1.e4 e5 — open games
  { name: "Vienna Game", moves: ["e4", "e5", "Nc3"] },
  { name: "King's Gambit", moves: ["e4", "e5", "f4"] },
  { name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { name: "Petrov (Russian) Defense", moves: ["e4", "e5", "Nf3", "Nf6"] },
  { name: "Philidor Defense", moves: ["e4", "e5", "Nf3", "d6"] },
  { name: "Four Knights Game", moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
  { name: "Italian Game, Giuoco Piano", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { name: "Italian Game, Two Knights Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
  { name: "Ruy Lopez, Morphy Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] },
  { name: "Ruy Lopez, Berlin Defense", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },

  // 1.e4 — semi-open games
  { name: "Sicilian Defense, Closed", moves: ["e4", "c5", "Nc3"] },
  {
    name: "Sicilian Defense, Najdorf Variation",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  },
  {
    name: "Sicilian Defense, Dragon Variation",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"],
  },
  { name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6", "Nc3", "g6"] },
  { name: "Modern Defense", moves: ["e4", "g6"] },
  { name: "Alekhine Defense", moves: ["e4", "Nf6"] },

  // 1.d4 — closed games
  { name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"] },
  { name: "Queen's Gambit Accepted", moves: ["d4", "d5", "c4", "dxc4"] },
  { name: "Slav Defense", moves: ["d4", "d5", "c4", "c6"] },
  { name: "Nimzo-Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { name: "Queen's Indian Defense", moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
  { name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { name: "Benoni Defense", moves: ["d4", "Nf6", "c4", "c5"] },
  { name: "Dutch Defense", moves: ["d4", "f5"] },

  // Flank openings
  { name: "Réti Opening", moves: ["Nf3", "d5", "c4"] },
  { name: "Bird's Opening", moves: ["f4"] },
]

/**
 * Single detection table: catalogue openings (excluding the empty "standard
 * start" entry) plus the extras above. Catalogue entries stay the source of
 * truth for the openings shown in the generate picker.
 */
const OPENING_LINES: OpeningLine[] = [
  ...OPENINGS.filter((o) => o.moves.length > 0).map((o) => ({ name: o.name, moves: o.moves })),
  ...EXTRA_OPENING_LINES,
]

/** Number of opening lines the detector knows about. */
export const KNOWN_OPENING_COUNT = OPENING_LINES.length

/**
 * Detect the opening from a raw SAN move list (assumed to start from the standard
 * initial position). Returns the name of the longest matching opening prefix, or
 * null when nothing matches. Moves are normalized (check/mate/annotation glyphs
 * stripped) so comparison is robust.
 */
export function detectOpeningFromMoves(moves: string[]): string | null {
  if (!moves || moves.length === 0) return null
  const normalized = moves.map(normalizeSan)

  let best: OpeningLine | null = null
  for (const line of OPENING_LINES) {
    if (line.moves.length > normalized.length) continue
    let isPrefix = true
    for (let i = 0; i < line.moves.length; i++) {
      if (normalizeSan(line.moves[i]) !== normalized[i]) {
        isPrefix = false
        break
      }
    }
    if (isPrefix && (best === null || line.moves.length > best.moves.length)) {
      best = line
    }
  }
  return best ? best.name : null
}

/**
 * Detect the opening of a Solitaire game. Games that start from a non-standard
 * position (a custom/opening `startFen`) can't be matched against standard-start
 * lines, so they return null rather than risk a misdetection.
 */
export function detectOpening(game: SolitaireGame): string | null {
  if (game.startFen && game.startFen !== STANDARD_START_FEN) return null
  return detectOpeningFromMoves(game.moves)
}

const GENERIC_OPENING_NAMES = new Set(["Custom Position", "Standard start position"])

/** Opening label for display: use stored name unless generic, then detect from moves. */
export function resolveOpeningLabel(game: SolitaireGame): string {
  const name = game.opening?.trim()
  if (name && !GENERIC_OPENING_NAMES.has(name)) return name
  const detected = detectOpening(game)
  return detected ?? name ?? "Unknown"
}
