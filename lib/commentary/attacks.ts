// lib/commentary/attacks.ts
// chess.js (1.4.0) based enumeration of attacks + hanging pieces on a position.
// Verified API: get(sq), board(), attackers(sq, attackedBy?), Color = "w"|"b".

import { Chess, type Square, type Color } from "chess.js"
import type { AttackFact, HangingFact, Side } from "./types"

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const opp = (c: Color): Color => (c === "w" ? "b" : "w")

function allOccupiedSquares(c: Chess): Square[] {
  const out: Square[] = []
  for (const row of c.board()) for (const cell of row) if (cell) out.push(cell.square)
  return out
}

/**
 * Every enemy (opponent-of-mover) piece that a mover piece attacks on `fenAfter`.
 * Uses raw attack geometry (turn-independent) — exactly what we want for the
 * anti-hallucination list given to the LLM.
 */
export function enumerateAttacks(fenAfter: string, mover: Side): AttackFact[] {
  const c = new Chess(fenAfter)
  const enemy = opp(mover)
  const facts: AttackFact[] = []

  for (const sq of allOccupiedSquares(c)) {
    const piece = c.get(sq)
    if (!piece || piece.color !== enemy) continue
    const attackers = c.attackers(sq, mover)
    if (attackers.length === 0) continue
    const defended = c.attackers(sq, enemy).length > 0
    for (const from of attackers) {
      const ap = c.get(from)
      if (!ap) continue
      facts.push({
        bySquare: from,
        byPiece: ap.type.toUpperCase(),
        targetSquare: sq,
        targetPiece: piece.type,
        givesCheck: piece.type === "k",
        defended,
      })
    }
  }
  return facts
}

/** Pieces (either color) attacked and either undefended or under-defended. */
export function findHanging(fenAfter: string): HangingFact[] {
  const c = new Chess(fenAfter)
  const out: HangingFact[] = []

  for (const sq of allOccupiedSquares(c)) {
    const piece = c.get(sq)
    if (!piece) continue
    const attackers = c.attackers(sq, opp(piece.color))
    if (attackers.length === 0) continue
    const defenders = c.attackers(sq, piece.color)

    const minAttackerValue = Math.min(
      ...attackers.map((a) => VALUE[c.get(a)?.type ?? "p"]),
    )
    const isHanging = defenders.length === 0 || minAttackerValue < VALUE[piece.type]
    if (isHanging) {
      out.push({
        square: sq,
        piece: piece.type,
        color: piece.color,
        attackedBy: attackers,
        defendedBy: defenders,
      })
    }
  }
  return out
}
