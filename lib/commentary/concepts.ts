// lib/commentary/concepts.ts
// CCC concept taxonomy (Kim et al., NAACL 2025), adapted training-free.
//
// The paper extracts concept scores from Stockfish 8's classical evaluation terms
// (Table 6): Material, Imbalance, Pawns, Knights, Bishops, Rooks, Queens, Mobility,
// Kingsafety, Threats, Space, Passedpawns. In the paper these are read out of a
// LeelaChessZero net via linear SVM probes. The labels themselves come from
// Stockfish's classical eval, so we compute the SAME taxonomy directly as
// deterministic chess.js proxies — no training, no probes. All scores are reported
// from the MOVER's point of view (positive = good for the mover), so the
// before→after delta tells us "what this move changed", which is exactly CCC's
// prioritization signal (see prioritizeConcepts).

import { Chess, type Color, type Square } from "chess.js"
import type { Side } from "./types"

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const
const opp = (c: Color): Color => (c === "w" ? "b" : "w")

/** The 12 CCC concept families (paper Table 6), netted to the mover's POV. */
export type ConceptName =
  | "material"
  | "imbalance"
  | "pawns"
  | "knights"
  | "bishops"
  | "rooks"
  | "queens"
  | "mobility"
  | "kingSafety"
  | "threats"
  | "space"
  | "passedPawns"

export const CONCEPT_NAMES: ConceptName[] = [
  "material",
  "imbalance",
  "pawns",
  "knights",
  "bishops",
  "rooks",
  "queens",
  "mobility",
  "kingSafety",
  "threats",
  "space",
  "passedPawns",
]

/** Human labels for the prompt/UI (mirrors the paper's Table 6 wording). */
export const CONCEPT_LABEL: Record<ConceptName, string> = {
  material: "Material",
  imbalance: "Imbalance",
  pawns: "Pawns",
  knights: "Knights",
  bishops: "Bishops",
  rooks: "Rooks",
  queens: "Queens",
  mobility: "Mobility",
  kingSafety: "King safety",
  threats: "Threats",
  space: "Space",
  passedPawns: "Passed pawns",
}

/**
 * Per-concept scale used to normalize deltas so families on different units
 * (material in pawns vs. mobility in squares) are comparable when ranking. Bigger
 * scale = that family needs a bigger raw swing to rank highly.
 */
const CONCEPT_SCALE: Record<ConceptName, number> = {
  material: 1,
  imbalance: 0.5,
  pawns: 1,
  knights: 4,
  bishops: 4,
  rooks: 4,
  queens: 4,
  mobility: 6,
  kingSafety: 3,
  threats: 3,
  space: 4,
  passedPawns: 2,
}

export type ConceptVector = Record<ConceptName, number>

type Board = ReturnType<Chess["board"]>
interface PieceCell {
  square: Square
  type: string
  color: Color
}

function cells(board: Board): PieceCell[] {
  const out: PieceCell[] = []
  for (const row of board) for (const cell of row) if (cell) out.push(cell as PieceCell)
  return out
}

const ALL_SQUARES: Square[] = (() => {
  const out: Square[] = []
  for (const f of FILES) for (let r = 1; r <= 8; r++) out.push(`${f}${r}` as Square)
  return out
})()

/** Count squares attacked by `color` (a mobility/control proxy). */
function controlledSquares(c: Chess, color: Color): number {
  let n = 0
  for (const sq of ALL_SQUARES) if (c.attackers(sq, color).length > 0) n++
  return n
}

/** Controlled squares in the opponent's half (space proxy). White's far half = ranks 5-8. */
function spaceControl(c: Chess, color: Color): number {
  const ranks = color === "w" ? [5, 6, 7, 8] : [1, 2, 3, 4]
  let n = 0
  for (const f of FILES)
    for (const r of ranks) if (c.attackers(`${f}${r}` as Square, color).length > 0) n++
  return n
}

/** Squares controlled specifically by pieces of `type` belonging to `color`. */
function pieceTypeControl(c: Chess, color: Color, type: string): number {
  let n = 0
  for (const target of ALL_SQUARES) {
    for (const from of c.attackers(target, color)) {
      const p = c.get(from)
      if (p && p.type === type) {
        n++
        break // count the target once for this piece type
      }
    }
  }
  return n
}

/** Pawn-structure penalty (doubled + isolated), higher = worse. */
function pawnPenalty(list: PieceCell[], color: Color): number {
  const pawns = list.filter((p) => p.type === "p" && p.color === color)
  const byFile = new Map<string, number>()
  for (const p of pawns) {
    const f = p.square[0]
    byFile.set(f, (byFile.get(f) ?? 0) + 1)
  }
  let penalty = 0
  for (const [f, count] of byFile) {
    if (count > 1) penalty += (count - 1) * 0.5 // doubled
    const fi = FILES.indexOf(f as (typeof FILES)[number])
    const hasNeighbor =
      (fi > 0 && byFile.has(FILES[fi - 1])) || (fi < 7 && byFile.has(FILES[fi + 1]))
    if (!hasNeighbor) penalty += count * 0.5 // isolated
  }
  return penalty
}

/** Passed-pawn score (count weighted by advancement), for `color`. */
function passedScore(list: PieceCell[], color: Color): number {
  const own = list.filter((p) => p.type === "p" && p.color === color)
  const enemyPawns = list.filter((p) => p.type === "p" && p.color === opp(color))
  let score = 0
  for (const p of own) {
    const f = p.square[0]
    const r = Number(p.square[1])
    const fi = FILES.indexOf(f as (typeof FILES)[number])
    const blocked = enemyPawns.some((e) => {
      const ef = FILES.indexOf(e.square[0] as (typeof FILES)[number])
      const er = Number(e.square[1])
      if (Math.abs(ef - fi) > 1) return false
      return color === "w" ? er > r : er < r
    })
    if (!blocked) {
      const advancement = color === "w" ? r - 1 : 8 - r // 0..6 toward promotion
      score += 1 + advancement * 0.3
    }
  }
  return score
}

/** King-safety proxy for `color`: pawn shelter minus enemy pressure near the king. */
function kingSafety(c: Chess, list: PieceCell[], color: Color): number {
  const king = list.find((p) => p.type === "k" && p.color === color)
  if (!king) return 0
  const f = king.square[0]
  const r = Number(king.square[1])
  const fi = FILES.indexOf(f as (typeof FILES)[number])

  // Pawn shelter: own pawns on the 3 files in front of (and beside) the king.
  let shelter = 0
  const forward = color === "w" ? [r + 1, r + 2] : [r - 1, r - 2]
  for (let df = -1; df <= 1; df++) {
    const nf = fi + df
    if (nf < 0 || nf > 7) continue
    for (const nr of forward) {
      if (nr < 1 || nr > 8) continue
      const p = c.get(`${FILES[nf]}${nr}` as Square)
      if (p && p.type === "p" && p.color === color) shelter += 1
    }
  }

  // Enemy pressure: attackers on the king's square + the ring around it.
  let pressure = 0
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      const nf = fi + df
      const nr = r + dr
      if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue
      pressure += c.attackers(`${FILES[nf]}${nr}` as Square, opp(color)).length
    }

  return shelter * 0.5 - pressure * 0.6
}

/** Threat score for `color`: value of enemy pieces it attacks that are loose/under-defended. */
function threatScore(c: Chess, list: PieceCell[], color: Color): number {
  let score = 0
  for (const cell of list) {
    if (cell.color !== opp(color)) continue
    const attackers = c.attackers(cell.square, color)
    if (attackers.length === 0) continue
    const defenders = c.attackers(cell.square, opp(color))
    const minAtk = Math.min(...attackers.map((a) => VALUE[c.get(a)?.type ?? "p"]))
    const loose = defenders.length === 0 || minAtk < VALUE[cell.type]
    if (loose) score += VALUE[cell.type]
  }
  return score
}

/** Imbalance proxy: bishop pair + minor-piece count differential. */
function imbalance(list: PieceCell[], color: Color): number {
  const count = (col: Color, t: string) =>
    list.filter((p) => p.color === col && p.type === t).length
  const mine = (count(color, "b") >= 2 ? 0.5 : 0) + count(color, "n") * 0.1 + count(color, "b") * 0.1
  const theirs =
    (count(opp(color), "b") >= 2 ? 0.5 : 0) +
    count(opp(color), "n") * 0.1 +
    count(opp(color), "b") * 0.1
  return mine - theirs
}

function material(list: PieceCell[], color: Color): number {
  let bal = 0
  for (const p of list) bal += (p.color === color ? 1 : -1) * VALUE[p.type]
  return bal
}

/**
 * Compute the full CCC concept vector for a position, from `mover`'s POV.
 * Every field is "mover minus opponent" so positive = good for the mover.
 */
export function computeConcepts(fen: string, mover: Side): ConceptVector {
  const c = new Chess(fen)
  const list = cells(c.board())
  const me = mover as Color
  const them = opp(me)

  return {
    material: material(list, me),
    imbalance: imbalance(list, me),
    pawns: pawnPenalty(list, them) - pawnPenalty(list, me), // higher = my structure better
    knights: pieceTypeControl(c, me, "n") - pieceTypeControl(c, them, "n"),
    bishops: pieceTypeControl(c, me, "b") - pieceTypeControl(c, them, "b"),
    rooks: pieceTypeControl(c, me, "r") - pieceTypeControl(c, them, "r"),
    queens: pieceTypeControl(c, me, "q") - pieceTypeControl(c, them, "q"),
    mobility: controlledSquares(c, me) - controlledSquares(c, them),
    kingSafety: kingSafety(c, list, me) - kingSafety(c, list, them),
    threats: threatScore(c, list, me) - threatScore(c, list, them),
    space: spaceControl(c, me) - spaceControl(c, them),
    passedPawns: passedScore(list, me) - passedScore(list, them),
  }
}

export interface ConceptScore {
  name: ConceptName
  label: string
  before: number
  after: number
  delta: number // after - before (mover POV; positive = move improved this concept)
  /** |delta| / scale — comparable magnitude used for ranking. */
  importance: number
}

/** Compute before/after concept scores + per-concept delta (mover POV). */
export function diffConcepts(
  fenBefore: string,
  fenAfter: string,
  mover: Side,
): ConceptScore[] {
  const before = computeConcepts(fenBefore, mover)
  const after = computeConcepts(fenAfter, mover)
  return CONCEPT_NAMES.map((name) => {
    const b = before[name]
    const a = after[name]
    const delta = a - b
    return {
      name,
      label: CONCEPT_LABEL[name],
      before: round(b),
      after: round(a),
      delta: round(delta),
      importance: Math.abs(delta) / CONCEPT_SCALE[name],
    }
  })
}

export interface PrioritizedConcept {
  name: ConceptName
  label: string
  delta: number
  importance: number
  /** "improved" / "worsened" for the mover (sign of delta). */
  direction: "improved" | "worsened" | "unchanged"
}

/**
 * CCC prioritization: rank concepts by the magnitude of their before→after change
 * and return the top-k. This is the "concept-guided" selection from §3.1.2 — the
 * concepts a move most influences are the ones the LLM should talk about.
 */
export function prioritizeConcepts(scores: ConceptScore[], k: number): PrioritizedConcept[] {
  return [...scores]
    .filter((s) => s.importance > 0.05) // ignore noise-level changes
    .sort((a, b) => b.importance - a.importance)
    .slice(0, k)
    .map((s) => ({
      name: s.name,
      label: s.label,
      delta: s.delta,
      importance: round(s.importance),
      direction: s.delta > 0.01 ? "improved" : s.delta < -0.01 ? "worsened" : "unchanged",
    }))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
