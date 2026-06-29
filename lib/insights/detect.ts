// lib/insights/detect.ts
// Deterministic, high-precision detection of tactical & strategic motifs from a
// single analyzed ply (a ConceptRecord). Every signal is grounded in either the
// engine eval already on the record (eval swing, mate, material delta, concept
// scores) or fresh chess.js geometry computed on the before/after positions —
// never on LLM prose. The bias is toward FALSE NEGATIVES: a motif is only
// flagged when there is a concrete, verifiable basis for it.

import { Chess } from "chess.js"
import type { Color, PieceSymbol, Square } from "chess.js"
import type { ConceptRecord } from "@/lib/commentary/types"
import type { InsightMotifId } from "./motifs"

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const FILES = "abcdefgh"
const opp = (c: Color): Color => (c === "w" ? "b" : "w")

function fileIdx(square: string): number {
  return FILES.indexOf(square[0])
}
function rankOf(square: string): number {
  return Number(square[1])
}
function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  return `${FILES[file]}${rank}` as Square
}
function isSlider(t: PieceSymbol | string): boolean {
  return t === "q" || t === "r" || t === "b"
}
/** Light/dark color of a square: 0 = dark, 1 = light. */
function squareColor(square: string): number {
  return (fileIdx(square) + rankOf(square)) % 2
}

interface Occupied {
  square: Square
  type: PieceSymbol
  color: Color
}

function occupiedSquares(c: Chess): Occupied[] {
  const out: Occupied[] = []
  for (const row of c.board())
    for (const cell of row) if (cell) out.push({ square: cell.square, type: cell.type, color: cell.color })
  return out
}

/** Direction vectors a piece type slides along. */
function sliderDirs(t: PieceSymbol | string): Array<[number, number]> {
  const orth: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const diag: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  if (t === "r") return orth
  if (t === "b") return diag
  if (t === "q") return [...orth, ...diag]
  return []
}

/** Squares strictly between two aligned squares (exclusive), or null if not aligned. */
function squaresBetween(a: string, b: string): Square[] | null {
  const df = Math.sign(fileIdx(b) - fileIdx(a))
  const dr = Math.sign(rankOf(b) - rankOf(a))
  const adf = Math.abs(fileIdx(b) - fileIdx(a))
  const adr = Math.abs(rankOf(b) - rankOf(a))
  const aligned = (df === 0 && dr !== 0) || (dr === 0 && df !== 0) || adf === adr
  if (!aligned || (df === 0 && dr === 0)) return null
  const out: Square[] = []
  let f = fileIdx(a) + df
  let r = rankOf(a) + dr
  while (`${FILES[f]}${r}` !== b) {
    const sq = squareAt(f, r)
    if (!sq) return null
    out.push(sq)
    f += df
    r += dr
  }
  return out
}

interface DetectCtx {
  record: ConceptRecord
  mover: Color
  enemy: Color
  before: Chess
  after: Chess
  from: string
  to: string
  movedType: PieceSymbol | null
  captured: PieceSymbol | null
  enPassant: boolean
  isCheck: boolean
  isCheckmate: boolean
}

/**
 * Detect every motif present after the played move. Returns a de-duplicated list
 * of motif ids. `record` must be a fully-built ConceptRecord (client analysis).
 */
export function detectMotifs(record: ConceptRecord): InsightMotifId[] {
  const found = new Set<InsightMotifId>()
  let ctx: DetectCtx
  try {
    ctx = buildCtx(record)
  } catch {
    return []
  }

  const detectors: Array<(c: DetectCtx) => InsightMotifId | InsightMotifId[] | null> = [
    detectFork,
    detectPinOrSkewer,
    detectDiscoveredAttack,
    detectDoubleAttack,
    detectHangingPiece,
    detectRemovalOfDefender,
    detectBackRank,
    detectTrappedPiece,
    detectSacrifice,
    detectTakingWithCheck,
    detectMatingNet,
    detectPassedPawn,
    detectPawnStructure,
    detectOpenFile,
    detectOutpost,
    detectBishopPair,
    detectOppositeBishops,
    detectExposedKing,
    detectSpaceAdvantage,
  ]

  for (const d of detectors) {
    let res: InsightMotifId | InsightMotifId[] | null = null
    try {
      res = d(ctx)
    } catch {
      res = null
    }
    if (!res) continue
    if (Array.isArray(res)) res.forEach((id) => found.add(id))
    else found.add(res)
  }

  return [...found]
}

function buildCtx(record: ConceptRecord): DetectCtx {
  const mover = record.side as Color
  const before = new Chess(record.fenBefore)
  const mv = before.move(record.moveSan) // mutates `before` -> now the after position
  if (!mv) throw new Error("illegal move")
  const after = new Chess(before.fen())
  // Re-create `before` cleanly for before-position queries.
  const beforeClean = new Chess(record.fenBefore)
  return {
    record,
    mover,
    enemy: opp(mover),
    before: beforeClean,
    after,
    from: mv.from,
    to: mv.to,
    movedType: (mv.promotion ?? mv.piece) as PieceSymbol,
    captured: (mv.captured as PieceSymbol) ?? null,
    enPassant: mv.flags.includes("e"),
    isCheck: after.inCheck(),
    isCheckmate: after.isCheckmate(),
  }
}

// ── Tactics ───────────────────────────────────────────────────────────────────

/** The moved piece attacks 2+ valuable enemy targets (incl. king via check). */
function detectFork(c: DetectCtx): InsightMotifId | null {
  const movedVal = c.movedType ? VALUE[c.movedType] : 0
  const byMoved = c.record.legalAttacks.filter((a) => a.bySquare === c.to)
  const targets = new Set<string>()
  let hasRealGain = false
  let hasCheck = false
  for (const a of byMoved) {
    const tVal = VALUE[a.targetPiece]
    const worthwhile = a.givesCheck || tVal > movedVal || !a.defended
    if (!worthwhile) continue
    targets.add(a.targetSquare)
    if (a.givesCheck) hasCheck = true
    if (a.givesCheck || tVal > movedVal) hasRealGain = true
  }
  if (targets.size < 2 || !hasRealGain) return null
  // A royal (check) fork is forcing, so the forking piece being attacked doesn't
  // refute it; otherwise require the forking piece isn't simply lost for free.
  if (!hasCheck && isMovedPieceLostForFree(c)) return null
  return "fork"
}

/** True if the moved piece sits en prise to a cheaper capture with no compensation. */
function isMovedPieceLostForFree(c: DetectCtx): boolean {
  const movedVal = c.movedType ? VALUE[c.movedType] : 0
  const attackers = c.after.attackers(c.to as Square, c.enemy)
  if (attackers.length === 0) return false
  const defenders = c.after.attackers(c.to as Square, c.mover)
  const minAtk = Math.min(...attackers.map((a) => VALUE[c.after.get(a as Square)?.type ?? "p"]))
  // Lost for free only if undefended, or the cheapest attacker is worth less.
  return defenders.length === 0 ? true : minAtk < movedVal
}

/** Pin / skewer created by the moved slider piece. */
function detectPinOrSkewer(c: DetectCtx): InsightMotifId[] | null {
  if (!c.movedType || !isSlider(c.movedType)) return null
  const out: InsightMotifId[] = []
  for (const [df, dr] of sliderDirs(c.movedType)) {
    let f = fileIdx(c.to) + df
    let r = rankOf(c.to) + dr
    let front: Occupied | null = null
    while (true) {
      const sq = squareAt(f, r)
      if (!sq) break
      const p = c.after.get(sq)
      if (p) {
        if (p.color === c.mover) break // own piece blocks the line
        if (!front) {
          front = { square: sq, type: p.type, color: p.color }
        } else {
          // `front` is the first enemy piece, this is the second piece behind it.
          if (p.color === c.enemy) {
            const fv = VALUE[front.type]
            const bv = VALUE[p.type]
            if (p.type === "k" || bv > fv) out.push("pin")
            else if ((front.type === "k" || front.type === "q" || front.type === "r") && fv > bv)
              out.push("skewer")
          }
          break
        }
      }
      f += df
      r += dr
    }
  }
  return out.length ? [...new Set(out)] : null
}

/** Moving the piece uncovers a slider's attack on a valuable enemy piece. */
function detectDiscoveredAttack(c: DetectCtx): InsightMotifId | null {
  for (const piece of occupiedSquares(c.after)) {
    if (piece.color !== c.enemy) continue
    if (VALUE[piece.type] < 3 && piece.type !== "k") continue
    const attackersAfter = c.after.attackers(piece.square, c.mover)
    for (const s of attackersAfter) {
      if (s === c.to) continue
      const ap = c.after.get(s as Square)
      if (!ap || !isSlider(ap.type)) continue
      const attackersBefore = c.before.attackers(piece.square, c.mover)
      if (attackersBefore.includes(s)) continue // was already attacking before
      const between = squaresBetween(s, piece.square)
      if (between && between.includes(c.from as Square)) return "discovered-attack"
    }
  }
  return null
}

/** Two+ loose enemy pieces attacked from 2+ distinct squares (a true double attack). */
function detectDoubleAttack(c: DetectCtx): InsightMotifId | null {
  const attackerSquares = new Set<string>()
  let looseCount = 0
  for (const h of c.record.hangingPieces) {
    if (h.color !== c.enemy) continue
    if (VALUE[h.piece] < 3) continue
    if (h.attackedBy.length === 0) continue
    looseCount++
    h.attackedBy.forEach((sq) => attackerSquares.add(sq))
  }
  return looseCount >= 2 && attackerSquares.size >= 2 ? "double-attack" : null
}

/** An undefended enemy minor/major piece is attacked by the mover. */
function detectHangingPiece(c: DetectCtx): InsightMotifId | null {
  for (const h of c.record.hangingPieces) {
    if (h.color !== c.enemy) continue
    if (VALUE[h.piece] < 3) continue
    if (h.defendedBy.length === 0 && h.attackedBy.length > 0) return "hanging-piece"
  }
  return null
}

/** The move captured a defender, leaving the piece it guarded hanging to the mover. */
function detectRemovalOfDefender(c: DetectCtx): InsightMotifId | null {
  if (!c.captured || c.enPassant) return null
  const capturedSquare = c.to
  for (const piece of occupiedSquares(c.before)) {
    if (piece.color !== c.enemy) continue
    if (piece.square === capturedSquare) continue
    if (VALUE[piece.type] < 3) continue
    const guardedBefore = c.before.attackers(piece.square, c.enemy)
    if (!guardedBefore.includes(capturedSquare as Square)) continue
    // After removing the defender, is the piece now loose and attacked by us?
    const stillThere = c.after.get(piece.square)
    if (!stillThere || stillThere.color !== c.enemy) continue
    const defAfter = c.after.attackers(piece.square, c.enemy)
    const atkAfter = c.after.attackers(piece.square, c.mover)
    if (defAfter.length === 0 && atkAfter.length > 0) return "removal-of-defender"
  }
  return null
}

/** Enemy king boxed on its back rank with no safe escape, pressured by a major piece. */
function detectBackRank(c: DetectCtx): InsightMotifId | null {
  const king = occupiedSquares(c.after).find((p) => p.type === "k" && p.color === c.enemy)
  if (!king) return null
  const backRank = c.enemy === "w" ? 1 : 8
  if (rankOf(king.square) !== backRank) return null

  // No safe escape square for the king.
  const kf = fileIdx(king.square)
  const kr = rankOf(king.square)
  let safeEscapes = 0
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue
      const sq = squareAt(kf + df, kr + dr)
      if (!sq) continue
      const occ = c.after.get(sq)
      if (occ && occ.color === c.enemy) continue // own piece blocks
      if (c.after.attackers(sq, c.mover).length > 0) continue // covered by us
      safeEscapes++
    }
  if (safeEscapes > 0) return null

  // A mover rook/queen must control a square on the enemy back rank.
  for (let f = 0; f < 8; f++) {
    const sq = squareAt(f, backRank)
    if (!sq) continue
    const major = c.after
      .attackers(sq, c.mover)
      .some((a) => {
        const p = c.after.get(a as Square)
        return p && (p.type === "r" || p.type === "q")
      })
    if (major) return "back-rank"
  }
  return null
}

/** An attacked enemy piece (>=knight) has no legal escape that isn't also attacked. */
function detectTrappedPiece(c: DetectCtx): InsightMotifId | null {
  // `after` already has the enemy to move, so we can enumerate their moves.
  for (const piece of occupiedSquares(c.after)) {
    if (piece.color !== c.enemy) continue
    if (VALUE[piece.type] < 3) continue
    const attackers = c.after.attackers(piece.square, c.mover)
    if (attackers.length === 0) continue
    const defenders = c.after.attackers(piece.square, c.enemy)
    const minAtk = Math.min(...attackers.map((a) => VALUE[c.after.get(a as Square)?.type ?? "p"]))
    const winnable = defenders.length === 0 || minAtk < VALUE[piece.type]
    if (!winnable) continue

    let moves: ReturnType<Chess["moves"]> = []
    try {
      moves = c.after.moves({ square: piece.square, verbose: true }) as never
    } catch {
      continue
    }
    const verbose = moves as unknown as Array<{ to: string }>
    if (verbose.length === 0) continue // no moves at all (could be unrelated); skip to stay precise
    const allCovered = verbose.every((m) => c.after.attackers(m.to as Square, c.mover).length > 0)
    if (allCovered) return "trapped-piece"
  }
  return null
}

/** Sound material sacrifice that keeps a clear advantage. */
function detectSacrifice(c: DetectCtx): InsightMotifId | null {
  if (c.record.materialDelta >= 0) return null
  if (c.record.classification === "brilliant") return "sacrifice"
  if (
    (c.record.classification === "best" || c.record.classification === "good") &&
    c.record.evalAfterCp >= 80
  )
    return "sacrifice"
  return null
}

function detectTakingWithCheck(c: DetectCtx): InsightMotifId | null {
  return c.captured && c.isCheck && !c.isCheckmate ? "taking-with-check" : null
}

function detectMatingNet(c: DetectCtx): InsightMotifId | null {
  if (c.isCheckmate) return "mating-net"
  if (c.record.mateAfter != null && c.record.mateAfter > 0) return "mating-net"
  return null
}

// ── Strategic / positional ──────────────────────────────────────────────────

function isPassedPawn(c: Chess, square: string, color: Color): boolean {
  const f = fileIdx(square)
  const r = rankOf(square)
  for (const piece of occupiedSquares(c)) {
    if (piece.type !== "p" || piece.color === color) continue
    if (Math.abs(fileIdx(piece.square) - f) > 1) continue
    const er = rankOf(piece.square)
    if (color === "w" ? er > r : er < r) return false
  }
  return true
}

/** The mover has a meaningfully advanced passed pawn. */
function detectPassedPawn(c: DetectCtx): InsightMotifId | null {
  for (const piece of occupiedSquares(c.after)) {
    if (piece.type !== "p" || piece.color !== c.mover) continue
    const r = rankOf(piece.square)
    const advanced = c.mover === "w" ? r >= 4 : r <= 5
    if (advanced && isPassedPawn(c.after, piece.square, c.mover)) return "passed-pawn"
  }
  return null
}

interface PawnStats {
  isolated: number
  maxDoubledFile: number
}
function pawnStats(c: Chess, color: Color): PawnStats {
  const byFile = new Map<number, number>()
  for (const piece of occupiedSquares(c)) {
    if (piece.type !== "p" || piece.color !== color) continue
    const f = fileIdx(piece.square)
    byFile.set(f, (byFile.get(f) ?? 0) + 1)
  }
  let isolated = 0
  let maxDoubledFile = 0
  for (const [f, count] of byFile) {
    maxDoubledFile = Math.max(maxDoubledFile, count)
    const hasNeighbor = byFile.has(f - 1) || byFile.has(f + 1)
    if (!hasNeighbor) isolated += count
  }
  return { isolated, maxDoubledFile }
}

/** Flag doubled / isolated pawns that this move newly created (for either side). */
function detectPawnStructure(c: DetectCtx): InsightMotifId[] | null {
  const out: InsightMotifId[] = []
  for (const color of [c.mover, c.enemy] as Color[]) {
    const before = pawnStats(c.before, color)
    const after = pawnStats(c.after, color)
    if (after.maxDoubledFile >= 2 && before.maxDoubledFile < 2) out.push("doubled-pawn")
    if (after.isolated > before.isolated) out.push("isolated-pawn")
  }
  return out.length ? [...new Set(out)] : null
}

/** The moved rook landed on a file with no friendly pawns (open / semi-open). */
function detectOpenFile(c: DetectCtx): InsightMotifId | null {
  if (c.movedType !== "r") return null
  const f = fileIdx(c.to)
  const ownPawnOnFile = occupiedSquares(c.after).some(
    (p) => p.type === "p" && p.color === c.mover && fileIdx(p.square) === f,
  )
  return ownPawnOnFile ? null : "open-file"
}

/** The moved knight reached a protected square no enemy pawn can attack. */
function detectOutpost(c: DetectCtx): InsightMotifId | null {
  if (c.movedType !== "n") return null
  const f = fileIdx(c.to)
  const r = rankOf(c.to)
  const inEnemyTerritory = c.mover === "w" ? r >= 4 && r <= 6 : r >= 3 && r <= 5
  if (!inEnemyTerritory) return null
  // Defended by a friendly pawn.
  const pawnDefended = c.after
    .attackers(c.to as Square, c.mover)
    .some((a) => c.after.get(a as Square)?.type === "p")
  if (!pawnDefended) return null
  // No enemy pawn on an adjacent file able to advance and challenge it.
  for (const piece of occupiedSquares(c.after)) {
    if (piece.type !== "p" || piece.color !== c.enemy) continue
    if (Math.abs(fileIdx(piece.square) - f) !== 1) continue
    const pr = rankOf(piece.square)
    if (c.mover === "w" ? pr > r : pr < r) return null
  }
  return "outpost"
}

function countBishops(c: Chess, color: Color): Occupied[] {
  return occupiedSquares(c).filter((p) => p.type === "b" && p.color === color)
}

function detectBishopPair(c: DetectCtx): InsightMotifId | null {
  const mine = countBishops(c.after, c.mover).length
  const theirs = countBishops(c.after, c.enemy).length
  return mine >= 2 && theirs <= 1 ? "bishop-pair" : null
}

function detectOppositeBishops(c: DetectCtx): InsightMotifId | null {
  const mine = countBishops(c.after, c.mover)
  const theirs = countBishops(c.after, c.enemy)
  if (mine.length !== 1 || theirs.length !== 1) return null
  return squareColor(mine[0].square) !== squareColor(theirs[0].square) ? "opposite-bishops" : null
}

/** The enemy king has little pawn cover and is under real pressure from the mover. */
function detectExposedKing(c: DetectCtx): InsightMotifId | null {
  const king = occupiedSquares(c.after).find((p) => p.type === "k" && p.color === c.enemy)
  if (!king) return null
  const kf = fileIdx(king.square)
  const kr = rankOf(king.square)
  let shelter = 0
  let pressure = 0
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const sq = squareAt(kf + df, kr + dr)
      if (!sq) continue
      const occ = c.after.get(sq)
      if (occ && occ.type === "p" && occ.color === c.enemy) shelter++
      pressure += c.after.attackers(sq, c.mover).length
    }
  }
  return shelter <= 1 && pressure >= 2 ? "exposed-king" : null
}

function detectSpaceAdvantage(c: DetectCtx): InsightMotifId | null {
  const space = c.record.conceptScores?.find((s) => s.name === "space")
  if (!space) return null
  return space.after >= 6 ? "space-advantage" : null
}
