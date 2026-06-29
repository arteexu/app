// lib/insights/practice.ts
// Turns analyzed plies into click-to-practice drills. A drill is a position from
// the user's OWN game where a motif appeared on a SOUND move — so the engine-
// approved move the user (or bot) played is a verifiable correct answer. Plies
// where the motif arose from a mistake are intentionally skipped: we never build
// a drill whose "solution" we can't ground in the analysis.

import { Chess } from "chess.js"
import { sideToMove } from "@/lib/engine/format"
import type { MoveClassification } from "@/lib/commentary/types"
import type { InsightMotifId } from "./motifs"

/** Classifications we trust enough to use the played move as the drill solution. */
const SOUND: ReadonlySet<MoveClassification> = new Set<MoveClassification>([
  "brilliant",
  "best",
  "good",
])

/** Minimal per-ply input the practice builder needs (shared by Play & Solitaire). */
export interface MotifPlySource {
  ply: number
  fenBefore: string
  moveSan: string
  bestMoveSan: string | null
  classification: MoveClassification
  detectedMotifs: InsightMotifId[]
  /** Human label for which game move this came from, e.g. "Move 17". */
  moveLabel: string
}

export interface PracticePosition {
  motifId: InsightMotifId
  /** Position to solve from (before the move that produced the motif). */
  fen: string
  /** Side to move / board orientation for this drill. */
  orientation: "white" | "black"
  /** Accepted answers in SAN (compared with check/mate markers stripped). */
  solutionSans: string[]
  /** The move actually played in the game (the canonical answer). */
  playedSan: string
  ply: number
  moveLabel: string
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/**
 * Build, per motif, the list of practice positions derived from sound plies.
 * Positions keep game order. Motifs with no sound source ply produce no drills.
 */
export function buildMotifPractice(
  sources: MotifPlySource[],
): Map<InsightMotifId, PracticePosition[]> {
  const map = new Map<InsightMotifId, PracticePosition[]>()
  for (const s of sources) {
    if (!SOUND.has(s.classification)) continue
    if (s.detectedMotifs.length === 0) continue

    const orientation: "white" | "black" = sideToMove(s.fenBefore) === "b" ? "black" : "white"
    const solutionSans = uniq([s.moveSan, ...(s.bestMoveSan ? [s.bestMoveSan] : [])]).filter(Boolean)
    // Guard: the played move must be legal for the FEN (defensive — it always is).
    try {
      const probe = new Chess(s.fenBefore)
      if (!probe.move(s.moveSan)) continue
    } catch {
      continue
    }

    for (const motifId of s.detectedMotifs) {
      const list = map.get(motifId) ?? []
      list.push({
        motifId,
        fen: s.fenBefore,
        orientation,
        solutionSans,
        playedSan: s.moveSan,
        ply: s.ply,
        moveLabel: s.moveLabel,
      })
      map.set(motifId, list)
    }
  }
  return map
}

/** Order detected motifs across plies by frequency, then first appearance. */
export function aggregateMotifs(motifLists: InsightMotifId[][]): InsightMotifId[] {
  const count = new Map<InsightMotifId, number>()
  const firstSeen = new Map<InsightMotifId, number>()
  let seq = 0
  for (const list of motifLists) {
    for (const id of list) {
      count.set(id, (count.get(id) ?? 0) + 1)
      if (!firstSeen.has(id)) firstSeen.set(id, seq++)
    }
  }
  return [...count.keys()].sort((a, b) => {
    const byCount = (count.get(b) ?? 0) - (count.get(a) ?? 0)
    if (byCount !== 0) return byCount
    return (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0)
  })
}

/** SAN comparison ignoring check/mate annotations and capture/disambiguation noise. */
export function sanMatches(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[+#]/g, "")
  return norm(a) === norm(b)
}
