// lib/insights/analyze-game.ts
// Shared, uncapped game-scanning engine for post-game insights. A single
// StockfishEngine worker is reused across EVERY position in the game (instead of
// the per-move spin-up/tear-down of computeMoveEvals), so analyzing a full game
// is feasible. Each ply gets a fully-grounded ConceptRecord + motif detection,
// and is flagged "notable" purely by MEANINGFULNESS — there is no fixed cap on
// how many moves surface. Quiet, insignificant moves are filtered out so the
// list stays relevant rather than spammy.
//
// This module is browser-only (it constructs StockfishEngine, a Web Worker), so
// it must only be imported from client components.

import { Chess } from "chess.js"
import { StockfishEngine } from "@/lib/engine/stockfish"
import { analyzeFenReusing } from "@/lib/commentary/engine-eval"
import { buildConceptRecord } from "@/lib/commentary/concept-record"
import { buildTemplateComment } from "@/lib/commentary/template"
import { generateCoachComment } from "@/lib/commentary/client"
import type { ConceptRecord, MoveClassification } from "@/lib/commentary/types"
import type { EngineLine } from "@/lib/engine/stockfish"
import type { KeyConceptId } from "@/lib/key-concepts"
import type { TacticalPatternId } from "@/lib/tactical-patterns"
import { detectMotifs } from "./detect"
import { aggregateMotifs, type MotifPlySource } from "./practice"
import { INSIGHT_MOTIFS, type InsightMotifId } from "./motifs"

// ── Deep-mode configuration (PART 3) ─────────────────────────────────────────

/** Analysis quality: "standard" (fast default) vs "deep" (slower, more thorough). */
export type AnalysisDepthMode = "standard" | "deep"

export interface AnalysisModeConfig {
  /** Search depth for the per-ply full-game scan (drives classification + motifs). */
  scanDepth: number
  /** Search depth used when fetching the richer LLM coach comments. */
  commentDepth: number
  /** Run the deep MultiPV / line-cited (rigorous) commentary path for comments. */
  rigorousComments: boolean
  /** Upper bound on how many notable moves get an LLM comment (rest use template). */
  maxLlmComments: number
  /** Human label + blurb for the UI selector. */
  label: string
  blurb: string
}

export const ANALYSIS_MODES: Record<AnalysisDepthMode, AnalysisModeConfig> = {
  standard: {
    scanDepth: 12,
    commentDepth: 12,
    rigorousComments: false,
    maxLlmComments: 6,
    label: "Standard",
    blurb: "Fast — good depth on every move.",
  },
  deep: {
    scanDepth: 18,
    commentDepth: 20,
    rigorousComments: true,
    maxLlmComments: 14,
    label: "Deep",
    blurb: "Slower, but searches deeper and writes more coach notes.",
  },
}

// ── Relevance thresholds (how "uncapped but relevant" is decided) ─────────────

/** A move that loses at least this many centipawns is always worth surfacing. */
const NOTABLE_CP_SWING = 60
/** Classifications that are inherently notable (mistakes + standout moves). */
const NOTABLE_CLASSIFICATIONS: ReadonlySet<MoveClassification> = new Set<MoveClassification>([
  "brilliant",
  "inaccuracy",
  "mistake",
  "blunder",
])
/** Sound classifications — used to decide whether a detected tactic is instructive. */
const SOUND_CLASSIFICATIONS: ReadonlySet<MoveClassification> = new Set<MoveClassification>([
  "brilliant",
  "best",
  "good",
])
/** Motif ids that are tactics (vs. slower positional concepts). */
const TACTIC_MOTIFS: ReadonlySet<InsightMotifId> = new Set(
  INSIGHT_MOTIFS.filter((m) => m.kind === "tactic").map((m) => m.id),
)

// ── Inputs / outputs ──────────────────────────────────────────────────────────

/** One half-move to analyze: the position before it and the SAN played. */
export interface GamePlyInput {
  ply: number
  fenBefore: string
  moveSan: string
}

export interface ScannedPly {
  ply: number
  fenBefore: string
  moveSan: string
  record: ConceptRecord
  cpLoss: number
  classification: MoveClassification
  detectedMotifs: InsightMotifId[]
  bestMoveSan: string | null
  /** Whether this move is meaningful enough to surface as a "notable move". */
  notable: boolean
  /** Why it was flagged (best available reason). */
  reason: string
  /** Ranking score: higher = more worth an (expensive) LLM coach note. */
  significance: number
}

export interface ScanGameOptions {
  /** Progress callback: (analyzed positions, total positions). */
  onProgress?: (done: number, total: number) => void
  /** Per-position engine timeout (ms). */
  timeoutMs?: number
}

/**
 * Analyze EVERY ply of a game with one reused engine. Positions are deduped and
 * analyzed once each (N+1 analyses for N plies), then turned into ConceptRecords
 * + motifs. Returns scanned plies in game order. Throws only if the engine never
 * starts; individual unparseable plies are skipped.
 */
export async function scanGame(
  plies: GamePlyInput[],
  mode: AnalysisDepthMode,
  opts: ScanGameOptions = {},
): Promise<ScannedPly[]> {
  if (plies.length === 0) return []
  const { scanDepth } = ANALYSIS_MODES[mode]
  const timeoutMs = opts.timeoutMs ?? (mode === "deep" ? 20000 : 12000)

  // Collect the unique positions we must evaluate: each fenBefore and the
  // fenAfter of every move (which doubles as the next ply's fenBefore).
  const fenAfterByPly = new Map<number, string>()
  const positions: string[] = []
  const seen = new Set<string>()
  const addPos = (fen: string) => {
    if (seen.has(fen)) return
    seen.add(fen)
    positions.push(fen)
  }
  for (const p of plies) {
    addPos(p.fenBefore)
    try {
      const c = new Chess(p.fenBefore)
      const mv = c.move(p.moveSan)
      if (mv) {
        const fenAfter = c.fen()
        fenAfterByPly.set(p.ply, fenAfter)
        addPos(fenAfter)
      }
    } catch {
      /* illegal ply — skip; handled below */
    }
  }

  const evals = new Map<string, EngineLine>()
  const engine = new StockfishEngine()
  try {
    await engine.whenReady()
    for (let i = 0; i < positions.length; i++) {
      const fen = positions[i]
      try {
        evals.set(fen, await analyzeFenReusing(engine, fen, scanDepth, timeoutMs))
      } catch {
        /* leave unset — plies needing it are skipped */
      }
      opts.onProgress?.(i + 1, positions.length)
    }
  } finally {
    engine.destroy()
  }

  const scanned: ScannedPly[] = []
  for (const p of plies) {
    const before = evals.get(p.fenBefore)
    const fenAfter = fenAfterByPly.get(p.ply)
    const after = fenAfter ? evals.get(fenAfter) : undefined
    if (!before || !after) continue
    let record: ConceptRecord
    try {
      record = buildConceptRecord({ fenBefore: p.fenBefore, moveSan: p.moveSan, before, after })
    } catch {
      continue
    }
    const detectedMotifs = safeDetect(record)
    const { notable, reason, significance } = scoreRelevance(record, detectedMotifs)
    scanned.push({
      ply: p.ply,
      fenBefore: p.fenBefore,
      moveSan: record.moveSan,
      record,
      cpLoss: record.cpLoss,
      classification: record.classification,
      detectedMotifs,
      bestMoveSan: record.bestMoveSan,
      notable,
      reason,
      significance,
    })
  }
  return scanned
}

function safeDetect(record: ConceptRecord): InsightMotifId[] {
  try {
    return detectMotifs(record)
  } catch {
    return []
  }
}

/**
 * Relevance decision (drives the uncapped-but-relevant list). A ply is notable
 * when it carries real signal — a mistake, a meaningful eval swing, a delivered
 * mate, or a sound move that executed a concrete tactic. Quiet "best"/"good"
 * moves with no tactic and no swing are intentionally excluded.
 */
function scoreRelevance(
  record: ConceptRecord,
  motifs: InsightMotifId[],
): { notable: boolean; reason: string; significance: number } {
  const isMate = record.moveSan.includes("#")
  const hasTactic = motifs.some((m) => TACTIC_MOTIFS.has(m))
  const soundTactic = hasTactic && SOUND_CLASSIFICATIONS.has(record.classification)
  const bigSwing = record.cpLoss >= NOTABLE_CP_SWING
  const flaggedClass = NOTABLE_CLASSIFICATIONS.has(record.classification)

  const notable = isMate || flaggedClass || bigSwing || soundTactic

  let reason = "notable move"
  if (isMate) reason = "checkmate"
  else if (record.classification === "blunder") reason = "blunder"
  else if (record.classification === "mistake") reason = "mistake"
  else if (record.classification === "brilliant") reason = "brilliant"
  else if (record.classification === "inaccuracy") reason = "inaccuracy"
  else if (soundTactic) reason = "tactic"
  else if (bigSwing) reason = "big swing"

  const classBoost: Record<MoveClassification, number> = {
    brilliant: 900,
    blunder: 650,
    mistake: 450,
    inaccuracy: 180,
    best: 0,
    good: 0,
  }
  const significance =
    (isMate ? 10000 : 0) +
    (record.mateAfter != null && record.mateAfter > 0 ? 4000 : 0) +
    record.cpLoss * 2 +
    (hasTactic ? 400 : 0) +
    motifs.length * 60 +
    Math.min(Math.abs(record.evalDeltaCp), 800) +
    classBoost[record.classification]

  return { notable, reason, significance }
}

// ── Aggregation (uncapped) ────────────────────────────────────────────────────

export interface AggregatedInsights {
  aggregatedKeyConcepts: KeyConceptId[]
  aggregatedTacticalPatterns: TacticalPatternId[]
  aggregatedMotifs: InsightMotifId[]
}

/**
 * Aggregate concepts / patterns / motifs across ALL scanned plies (no top-N
 * cap), ordered by frequency. `extract` lets each surface choose its grounding
 * (Play uses rule-verified tags; Solitaire uses the raw matched tags).
 */
export function aggregateScanned(
  scanned: ScannedPly[],
  extract: (r: ConceptRecord) => {
    keyConceptIds: KeyConceptId[]
    tacticalPatternIds: TacticalPatternId[]
  },
): AggregatedInsights {
  const kcCount = new Map<KeyConceptId, number>()
  const tpCount = new Map<TacticalPatternId, number>()
  for (const s of scanned) {
    const { keyConceptIds, tacticalPatternIds } = extract(s.record)
    for (const id of keyConceptIds) kcCount.set(id, (kcCount.get(id) ?? 0) + 1)
    for (const id of tacticalPatternIds) tpCount.set(id, (tpCount.get(id) ?? 0) + 1)
  }
  const sortByCount = <T extends string>(map: Map<T, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  return {
    aggregatedKeyConcepts: sortByCount(kcCount),
    aggregatedTacticalPatterns: sortByCount(tpCount),
    aggregatedMotifs: aggregateMotifs(scanned.map((s) => s.detectedMotifs)),
  }
}

/** Build click-to-practice sources from every scanned ply (uncapped). */
export function motifSourcesFromScanned(
  scanned: ScannedPly[],
  moveLabel: (ply: number) => string,
): MotifPlySource[] {
  return scanned.map((s) => ({
    ply: s.ply,
    fenBefore: s.fenBefore,
    moveSan: s.moveSan,
    bestMoveSan: s.bestMoveSan,
    classification: s.classification,
    detectedMotifs: s.detectedMotifs,
    moveLabel: moveLabel(s.ply),
  }))
}

// ── Coach comments for notable plies ──────────────────────────────────────────

export interface PlyComment {
  comment: string
  source: "llm" | "template"
}

/**
 * Produce a comment for every notable ply. To keep an UNCAPPED notable list
 * responsive, every ply first gets a deterministic template comment (instant,
 * offline-safe); the most significant ones (up to `maxLlmComments`) are then
 * upgraded with the LLM coach. In deep mode the coach runs the rigorous
 * line-cited path at higher depth.
 */
export async function buildNotableComments(
  notable: ScannedPly[],
  mode: AnalysisDepthMode,
  opts: { onProgress?: (done: number, total: number) => void } = {},
): Promise<Map<number, PlyComment>> {
  const cfg = ANALYSIS_MODES[mode]
  const result = new Map<number, PlyComment>()
  for (const s of notable) {
    result.set(s.ply, { comment: buildTemplateComment(s.record), source: "template" })
  }

  const llmList = [...notable]
    .sort((a, b) => b.significance - a.significance)
    .slice(0, cfg.maxLlmComments)
    .sort((a, b) => a.ply - b.ply)

  for (let i = 0; i < llmList.length; i++) {
    const s = llmList[i]
    opts.onProgress?.(i + 1, llmList.length)
    try {
      const { response } = await generateCoachComment(
        { fenBefore: s.fenBefore, moveSan: s.moveSan },
        cfg.rigorousComments
          ? { rigorous: true, depth: cfg.commentDepth, multiPv: 3 }
          : { depth: cfg.commentDepth },
      )
      result.set(s.ply, { comment: response.comment, source: response.source })
    } catch {
      /* keep the template fallback already in the map */
    }
  }
  return result
}
