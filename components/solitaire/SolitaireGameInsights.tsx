"use client"
// components/solitaire/SolitaireGameInsights.tsx
// Post-game "Key ideas from this game" — analyzes a handful of pivotal plies via
// the existing commentary pipeline (engine → ConceptRecord → /api/commentary).

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import type { Side, SolitaireGame } from "@/lib/solitaire/types"
import type { MoveResult } from "@/lib/solitaire-scoring"
import { fenAfter, getCutoffPly, moveNumberAtPly, sideAtPly } from "@/lib/solitaire/engine"
import { getKeyConcept } from "@/lib/key-concepts"
import { getTacticalPattern } from "@/lib/tactical-patterns"
import { keyConceptHref, tacticalPatternHref } from "@/lib/insights/learn-links"
import { buildMotifPractice, type MotifPlySource } from "@/lib/insights/practice"
import { MotifPracticeSection } from "@/components/insights/MotifPracticeSection"
import { RecommendedPuzzles } from "@/components/insights/RecommendedPuzzles"
import { AnalysisModeToggle } from "@/components/insights/AnalysisModeToggle"
import { COMMENTARY_FEATURE_ENABLED } from "@/lib/commentary/config"
import { generateCoachComment } from "@/lib/commentary/client"
import {
  scanGame,
  aggregateScanned,
  motifSourcesFromScanned,
  buildNotableComments,
  type AnalysisDepthMode,
  type GamePlyInput,
} from "@/lib/insights/analyze-game"
import {
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
  const [mode, setMode] = useState<AnalysisDepthMode>("standard")

  const practice = useMemo(() => {
    if (!insights) return null
    const sources: MotifPlySource[] =
      insights.motifSources ??
      insights.plyInsights.map((pi) => ({
        ply: pi.ply,
        fenBefore: pi.fenBefore,
        moveSan: pi.moveSan,
        bestMoveSan: pi.bestMoveSan,
        classification: pi.classification,
        detectedMotifs: pi.detectedMotifs,
        moveLabel: `Move ${moveNumberAtPly(game, pi.ply)}`,
      }))
    return buildMotifPractice(sources)
  }, [insights, game])

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress("Scanning every move…")

    try {
      const cutoff = getCutoffPly(game)
      const plies: GamePlyInput[] = []
      for (let ply = 0; ply < cutoff; ply++) {
        const moveSan = game.moves[ply]
        if (!moveSan) continue
        plies.push({ ply, fenBefore: fenAfter(game, ply), moveSan })
      }
      if (plies.length === 0) {
        setError("No moves to analyze in this session.")
        return
      }

      const scanned = await scanGame(plies, mode, {
        onProgress: (done, total) => setProgress(`Analyzing position ${done} of ${total}…`),
      })
      if (scanned.length === 0) {
        setError("Couldn't analyze this session. Try again.")
        return
      }

      const notable = scanned.filter((s) => s.notable)
      setProgress("Writing coach notes…")
      const comments = await buildNotableComments(notable, mode, {
        onProgress: (done, total) => setProgress(`Writing coach note ${done} of ${total}…`),
      })

      const resultByPly = new Map(results.map((r) => [r.ply, r]))
      const plyInsights: PlyInsight[] = notable
        .slice()
        .sort((a, b) => a.ply - b.ply)
        .map((s) => {
          const mr = resultByPly.get(s.ply)
          const c = comments.get(s.ply)
          return {
            ply: s.ply,
            moveSan: s.moveSan,
            fenBefore: s.fenBefore,
            reason: s.reason,
            outcome: mr?.outcome,
            comment: c?.comment ?? "",
            source: c?.source ?? "template",
            classification: s.classification,
            keyConceptIds: s.record.matchedKeyConceptIds,
            tacticalPatternIds: s.record.matchedTacticalPatternIds,
            detectedMotifs: s.detectedMotifs,
            bestMoveSan: s.bestMoveSan,
          }
        })

      const aggregated = aggregateScanned(scanned, (r) => ({
        keyConceptIds: r.matchedKeyConceptIds,
        tacticalPatternIds: r.matchedTacticalPatternIds,
      }))
      const motifSources = motifSourcesFromScanned(
        scanned,
        (ply) => `Move ${moveNumberAtPly(game, ply)}`,
      )
      setInsights({ plyInsights, ...aggregated, motifSources, analyzedCount: scanned.length })
    } catch {
      setError("Couldn't generate insights. Try again.")
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [game, results, mode])

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
          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
            <AnalysisModeToggle mode={mode} onChange={setMode} />
            <button
              onClick={generate}
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
            >
              🧠 Generate insights
            </button>
          </div>
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
                    <Link
                      key={id}
                      href={keyConceptHref(id)}
                      className="group rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 flex gap-3 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                      <span className="text-lg shrink-0" aria-hidden>{concept.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-bold text-amber-950 dark:text-amber-100 text-sm flex items-center gap-1.5">
                          {concept.title}
                          <span className="text-[10px] font-bold text-amber-600/70 dark:text-amber-300/70 opacity-0 group-hover:opacity-100 transition">
                            Learn ↗
                          </span>
                        </p>
                        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed mt-0.5">
                          {concept.description}
                        </p>
                      </div>
                    </Link>
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
                    <Link
                      key={id}
                      href={tacticalPatternHref(id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800 hover:bg-violet-200 dark:hover:bg-violet-900/70 hover:border-violet-400 dark:hover:border-violet-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <span aria-hidden>{pattern.icon}</span>
                      {pattern.title}
                      <span aria-hidden className="text-violet-500/80 dark:text-violet-300/80">↗</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {insights.aggregatedMotifs.length > 0 && practice && (
            <MotifPracticeSection motifs={insights.aggregatedMotifs} practice={practice} />
          )}

          <RecommendedPuzzles
            keyConceptIds={insights.aggregatedKeyConcepts}
            tacticalPatternIds={insights.aggregatedTacticalPatterns}
            motifIds={insights.aggregatedMotifs}
          />

          {insights.plyInsights.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Notable moves
                <span className="ml-1.5 font-semibold normal-case text-gray-400 dark:text-slate-500">
                  {insights.plyInsights.length} found
                  {insights.analyzedCount ? ` · ${insights.analyzedCount} moves analyzed` : ""}
                </span>
              </p>
              {insights.plyInsights.map((pi) => (
                <MoveInsightCard key={pi.ply} insight={pi} game={game} side={side} />
              ))}
            </div>
          )}

          {insights.aggregatedKeyConcepts.length === 0 &&
            insights.aggregatedTacticalPatterns.length === 0 &&
            insights.aggregatedMotifs.length === 0 &&
            insights.plyInsights.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                No taxonomy tags matched — commentary still highlights what happened in key moments.
              </p>
            )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <AnalysisModeToggle mode={mode} onChange={setMode} disabled={loading} />
            <button
              onClick={generate}
              disabled={loading}
              className="self-start text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              Regenerate insights
            </button>
          </div>
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
