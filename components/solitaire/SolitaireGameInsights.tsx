"use client"
// components/solitaire/SolitaireGameInsights.tsx
// Post-game "Key ideas from this game" — analyzes a handful of pivotal plies via
// the existing commentary pipeline (engine → ConceptRecord → /api/commentary).

import { useCallback, useState } from "react"
import { clsx } from "clsx"
import type { Side, SolitaireGame } from "@/lib/solitaire/types"
import type { MoveResult } from "@/lib/solitaire-scoring"
import { fenAfter, moveNumberAtPly, sideAtPly } from "@/lib/solitaire/engine"
import { getKeyConcept } from "@/lib/key-concepts"
import { getTacticalPattern } from "@/lib/tactical-patterns"
import { COMMENTARY_FEATURE_ENABLED } from "@/lib/commentary/config"
import { generateCoachComment } from "@/lib/commentary/client"
import { buildConceptRecord } from "@/lib/commentary/concept-record"
import { computeMoveEvals } from "@/lib/commentary/engine-eval"
import { COMMENTARY_ANALYSIS_DEPTH } from "@/lib/commentary/config"
import {
  rankPivotalCandidates,
  pickBiggestEvalDropPly,
  aggregateFromPlyInsights,
  type GameInsights,
  type PlyInsight,
} from "@/lib/solitaire/insights"
import { ChessMindLoader } from "@/components/ui/ChessMindLoader"
import { SanNotation } from "@/components/chess/SanNotation"
import { MarkdownText } from "@/components/ui/MarkdownText"

interface Props {
  game: SolitaireGame
  side: Side
  results: MoveResult[]
  className?: string
}

const OUTCOME_LABEL: Record<string, string> = {
  "first-try": "first try",
  retry: "after retry",
  revealed: "revealed",
  skipped: "skipped",
}

export function SolitaireGameInsights({ game, side, results, className }: Props) {
  const [insights, setInsights] = useState<GameInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress("Picking key moments…")

    try {
      const candidates = rankPivotalCandidates(game, results).slice(0, 8)
      if (candidates.length === 0) {
        setError("No moves to analyze in this session.")
        return
      }

      // Quick eval pass to find the biggest eval drop among candidates.
      setProgress("Scanning positions…")
      const evaluated = await Promise.all(
        candidates.map(async (c) => {
          const fenBefore = fenAfter(game, c.ply)
          const moveSan = game.moves[c.ply]
          const { before, after } = await computeMoveEvals(
            fenBefore,
            moveSan,
            COMMENTARY_ANALYSIS_DEPTH,
          )
          const record = buildConceptRecord({ fenBefore, moveSan, before, after })
          return { ply: c.ply, cpLoss: record.cpLoss, reason: c.reason }
        }),
      )

      const dropPly = pickBiggestEvalDropPly(evaluated)
      const selectedPlies = new Set<number>()
      for (const c of candidates.slice(0, 4)) selectedPlies.add(c.ply)
      if (dropPly != null) selectedPlies.add(dropPly)
      const pliesToAnalyze = [...selectedPlies].slice(0, 5)

      const resultByPly = new Map(results.map((r) => [r.ply, r]))
      const reasonByPly = new Map(candidates.map((c) => [c.ply, c.reason]))
      if (dropPly != null) reasonByPly.set(dropPly, "biggest swing")

      const plyInsights: PlyInsight[] = []
      for (let i = 0; i < pliesToAnalyze.length; i++) {
        const ply = pliesToAnalyze[i]
        setProgress(`Analyzing move ${i + 1} of ${pliesToAnalyze.length}…`)
        const fenBefore = fenAfter(game, ply)
        const moveSan = game.moves[ply]
        const { response, record } = await generateCoachComment({ fenBefore, moveSan })
        if (!record) continue
        const mr = resultByPly.get(ply)
        plyInsights.push({
          ply,
          moveSan: record.moveSan,
          fenBefore,
          reason: reasonByPly.get(ply) ?? "notable",
          outcome: mr?.outcome,
          comment: response.comment,
          source: response.source,
          classification: record.classification,
          keyConceptIds: record.matchedKeyConceptIds,
          tacticalPatternIds: record.matchedTacticalPatternIds,
        })
      }

      const aggregated = aggregateFromPlyInsights(plyInsights)
      setInsights({ plyInsights, ...aggregated })
    } catch {
      setError("Couldn't generate insights. Try again.")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [game, results])

  if (!COMMENTARY_FEATURE_ENABLED) return null

  return (
    <div
      className={clsx(
        "rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-4",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display font-extrabold text-gray-900 dark:text-slate-100">
            Key ideas from this game
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            What you practiced — concepts spotted in pivotal moments.
          </p>
        </div>
        {!insights && !loading && (
          <button
            onClick={generate}
            className="shrink-0 inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            🧠 Generate insights
          </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-6">
          <ChessMindLoader size="md" label="Analyzing game" hideLabel />
          {progress && (
            <p className="text-sm text-gray-500 dark:text-slate-400">{progress}</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
      )}

      {insights && (
        <>
          {insights.aggregatedKeyConcepts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Key concepts
              </p>
              <div className="flex flex-col gap-2">
                {insights.aggregatedKeyConcepts.map((id) => {
                  const concept = getKeyConcept(id)
                  if (!concept) return null
                  return (
                    <div
                      key={id}
                      className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 flex gap-3"
                    >
                      <span className="text-lg shrink-0" aria-hidden>{concept.icon}</span>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-amber-950 dark:text-amber-100 text-sm">
                          {concept.title}
                        </p>
                        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed mt-0.5">
                          {concept.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {insights.aggregatedTacticalPatterns.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                Tactical patterns
              </p>
              <div className="flex flex-wrap gap-2">
                {insights.aggregatedTacticalPatterns.map((id) => {
                  const pattern = getTacticalPattern(id)
                  if (!pattern) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800"
                    >
                      {pattern.title}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {insights.plyInsights.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Notable moves
              </p>
              {insights.plyInsights.map((pi) => (
                <MoveInsightCard key={pi.ply} insight={pi} game={game} side={side} />
              ))}
            </div>
          )}

          {insights.aggregatedKeyConcepts.length === 0 &&
            insights.aggregatedTacticalPatterns.length === 0 &&
            insights.plyInsights.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                No taxonomy tags matched — commentary still highlights what happened in key moments.
              </p>
            )}

          <button
            onClick={generate}
            disabled={loading}
            className="self-start text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
          >
            Regenerate insights
          </button>
        </>
      )}
    </div>
  )
}

function MoveInsightCard({
  insight,
  game,
  side,
}: {
  insight: PlyInsight
  game: SolitaireGame
  side: Side
}) {
  const [askLoading, setAskLoading] = useState(false)
  const [extraComment, setExtraComment] = useState<string | null>(null)
  const moveColor = sideAtPly(game, insight.ply)
  const moveNo = moveNumberAtPly(game, insight.ply)
  const isUserMove = moveColor === side

  async function askCoach() {
    setAskLoading(true)
    try {
      const { response } = await generateCoachComment({
        fenBefore: insight.fenBefore,
        moveSan: insight.moveSan,
      })
      setExtraComment(response.comment)
    } finally {
      setAskLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 px-4 py-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
          Move {moveNo}
          {isUserMove && <span className="text-indigo-600 dark:text-indigo-400 ml-1">· your move</span>}
        </span>
        <SanNotation san={insight.moveSan} color={moveColor} className="font-mono font-bold text-sm" />
        {insight.outcome && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
            {OUTCOME_LABEL[insight.outcome] ?? insight.outcome}
          </span>
        )}
        <ClassificationBadge classification={insight.classification} />
        {insight.source === "template" && (
          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">offline</span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-700 dark:text-slate-200">
        <MarkdownText>{insight.comment}</MarkdownText>
      </p>
      {!extraComment && (
        <button
          onClick={askCoach}
          disabled={askLoading}
          className="self-start text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
        >
          {askLoading ? "Coach is thinking…" : "Ask about this position"}
        </button>
      )}
      {extraComment && (
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">
            Coach&apos;s take
          </p>
          <p className="text-sm leading-relaxed text-indigo-900/90 dark:text-indigo-100/90">
            {extraComment}
          </p>
        </div>
      )}
    </div>
  )
}

function ClassificationBadge({ classification }: { classification: PlyInsight["classification"] }) {
  const styles: Record<string, string> = {
    brilliant: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
    best: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    good: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    inaccuracy: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    mistake: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    blunder: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  }
  return (
    <span
      className={clsx(
        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
        styles[classification] ?? styles.good,
      )}
    >
      {classification}
    </span>
  )
}
