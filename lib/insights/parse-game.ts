// lib/insights/parse-game.ts
// Robust, dependency-light parsing of a user-supplied game into the PlayedMove[]
// shape the review/insights pipeline already understands. chess.js is the single
// source of truth for legality (same as the rest of the app). Two strategies:
//   1. Full PGN via chess.js loadPgn — handles tag headers, comments, NAGs, and
//      a custom [FEN "…"] start position.
//   2. Bare movetext fallback — strips numbers/comments/variations/results and
//      replays the SAN tokens one by one, surfacing the first unreadable token.
// Throws GameParseError with a friendly message; never throws anything else.

import { Chess, type Move } from "chess.js"
import { START_FEN } from "@/lib/play/game"
import type { PieceColor, PlayedMove } from "@/lib/play/types"

export class GameParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GameParseError"
  }
}

export interface ParsedGame {
  moves: PlayedMove[]
  /** Position the game starts from (custom for FEN-start games). */
  startFen: string
  /** True when the game begins from the standard initial position. */
  fromStandardStart: boolean
  headers: Record<string, string>
  whiteLabel: string
  blackLabel: string
  /** Human result line, e.g. "White won", "Draw", or "Game". */
  resultLabel: string
  /** Short title for the review header. */
  title: string
}

const RESULT_LABELS: Record<string, string> = {
  "1-0": "White won",
  "0-1": "Black won",
  "1/2-1/2": "Draw",
  "*": "Game",
}

/** Parse PGN / FEN-start / bare movetext into a reviewable game. */
export function parseGame(raw: string): ParsedGame {
  const input = raw.trim()
  if (!input) {
    throw new GameParseError("Paste a PGN or list of moves to review.")
  }

  const viaPgn = tryLoadPgn(input)
  const parsed = viaPgn ?? parseMovetext(input)
  if (parsed.moves.length === 0) {
    throw new GameParseError(
      "No legal moves were found. Double-check the PGN or move list and try again.",
    )
  }
  return parsed
}

/** Strategy 1: let chess.js parse a full PGN (tolerant, non-strict). */
function tryLoadPgn(input: string): ParsedGame | null {
  try {
    const chess = new Chess()
    chess.loadPgn(input, { strict: false })
    const verbose = chess.history({ verbose: true }) as Move[]
    if (verbose.length === 0) return null
    const headers = normalizeHeaders(chess.getHeaders())
    const startFen = verbose[0].before || headers.FEN || START_FEN
    return finalize(toPlayedMoves(verbose), startFen, headers)
  } catch {
    return null
  }
}

/** Strategy 2: clean bare movetext and replay SAN tokens individually. */
function parseMovetext(input: string): ParsedGame {
  const headers = normalizeHeaders(extractHeaders(input))
  const startFen = headers.FEN?.trim() || START_FEN

  let chess: Chess
  try {
    chess = new Chess(startFen)
  } catch {
    throw new GameParseError("The start position (FEN) is invalid.")
  }

  let body = input
    .replace(/\[[^\]]*\]/g, " ") // tag headers
    .replace(/\{[^}]*\}/g, " ") // { comments }
    .replace(/;[^\n]*/g, " ") // ; line comments
  body = stripVariations(body)
  body = body
    .replace(/\$\d+/g, " ") // NAGs ($1, $13…)
    .replace(/\d+\.(\.\.)?/g, " ") // move numbers: "12." and "12..."
    .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ") // result tokens

  const tokens = body.split(/\s+/).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0) {
    throw new GameParseError("No moves were found. Paste a PGN or a list of moves like 1. e4 e5 2. Nf3.")
  }

  const moves: PlayedMove[] = []
  for (const tok of tokens) {
    let mv: Move | null = null
    try {
      mv = chess.move(tok, { strict: false })
    } catch {
      mv = null
    }
    if (!mv) {
      throw new GameParseError(
        `Couldn't read "${tok}" (move ${moves.length + 1}). Check the notation near there.`,
      )
    }
    moves.push(toPlayedMove(mv, moves.length))
  }

  return finalize(moves, startFen, headers)
}

/** Iteratively remove (possibly nested) parenthesized variations. */
function stripVariations(s: string): string {
  let prev: string
  do {
    prev = s
    s = s.replace(/\([^()]*\)/g, " ")
  } while (s !== prev)
  return s
}

function extractHeaders(input: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const re = /\[\s*(\w+)\s+"([^"]*)"\s*\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input)) !== null) {
    headers[m[1]] = m[2]
  }
  return headers
}

/** chess.js fills missing tags with placeholders ("?", "????.??.??") — drop them. */
function isPlaceholder(v: string): boolean {
  const t = v.trim()
  return t === "" || t === "?" || /^[?.]+$/.test(t)
}

function normalizeHeaders(headers: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v != null && !isPlaceholder(v)) out[k] = v
  }
  return out
}

function toPlayedMoves(verbose: Move[]): PlayedMove[] {
  return verbose.map((m, i) => toPlayedMove(m, i))
}

function toPlayedMove(m: Move, ply: number): PlayedMove {
  const color: PieceColor = m.color === "w" ? "white" : "black"
  let fenAfter = m.after
  if (!fenAfter) {
    // Defensive: replay before→after if `after` is somehow missing.
    try {
      const c = new Chess(m.before)
      c.move(m.san)
      fenAfter = c.fen()
    } catch {
      fenAfter = m.before
    }
  }
  return {
    ply,
    san: m.san,
    uci: `${m.from}${m.to}${m.promotion ?? ""}`,
    fenAfter,
    color,
  }
}

function finalize(
  moves: PlayedMove[],
  startFen: string,
  headers: Record<string, string>,
): ParsedGame {
  const whiteLabel = headers.White?.trim() || "White"
  const blackLabel = headers.Black?.trim() || "Black"
  const resultLabel = RESULT_LABELS[headers.Result?.trim() ?? "*"] ?? "Game"

  let title: string
  if (headers.White || headers.Black) {
    title = `${whiteLabel} vs ${blackLabel}`
  } else if (headers.Event) {
    title = headers.Event
  } else {
    title = "Uploaded game"
  }

  return {
    moves,
    startFen,
    fromStandardStart: startFen === START_FEN,
    headers,
    whiteLabel,
    blackLabel,
    resultLabel,
    title,
  }
}
