"use client"
// components/insights/GameSummaryInsights.tsx
// Game-LEVEL post-game report rendered above the existing per-move insights.
// Everything here is computed deterministically in lib/insights/game-summary.ts
// from the single-engine scan (no extra analysis), and every aggregate theme
// routes the learner to the matching tag page AND the lesson(s) that teach it.

import Link from "next/link"
import { clsx } from "clsx"
import type {
  GameSummary,
  PhaseAssessment,
  PhaseVerdict,
  RecurringTheme,
  SideStats,
} from "@/lib/insights/game-summary"
import { getInsightMotif } from "@/lib/insights/motifs"
import { motifLearnTarget, lessonsForMotif } from "@/lib/insights/learn-links"
import { SanNotation } from "@/components/chess/SanNotation"

interface Props {
  summary: GameSummary
  /** Map a ply index to a human label, e.g. "Move 17" (surface-specific). */
  moveLabel: (ply: number) => string
}

const PHASE_LABEL: Record<string, string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
}

const VERDICT_STYLE: Record<PhaseVerdict, string> = {
  strong: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  solid: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  shaky: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  costly: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
}

const VERDICT_LABEL: Record<PhaseVerdict, string> = {
  strong: "Strong",
  solid: "Solid",
  shaky: "Shaky",
  costly: "Costly",
}

function hasMeaningfulStats(s: SideStats): boolean {
  return s.moves > 0
}

export function GameSummaryInsights({ summary, moveLabel }: Props) {
  const { user, opponent, turningPoint, phases, lostGroundPhase } = summary
  const showReport = hasMeaningfulStats(user) || hasMeaningfulStats(opponent)

  return (
    <div className="flex flex-col gap-4">
      {showReport && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">
            Game report
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <SideCard label="You" stats={user} highlight />
            <SideCard label="Opponent" stats={opponent} />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500">
            Accuracy is an estimate from average centipawn loss.
          </p>
        </div>
      )}

      {turningPoint && (
        <div className="rounded-xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3 flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            Turning point
          </p>
          <p className="text-sm text-rose-950/90 dark:text-rose-100/90 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="font-semibold">{moveLabel(turningPoint.ply)}:</span>
            <SanNotation
              san={turningPoint.moveSan}
              color={turningPoint.side === "w" ? "white" : "black"}
              className="font-mono font-bold"
            />
            <span>
              was the biggest swing of the game
              {turningPoint.byUser ? " — and it was yours to avoid" : " — your chance to capitalize"}.
            </span>
          </p>
        </div>
      )}

      {phases.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Phase breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {phases.map((p) => (
              <PhaseCard key={p.phase} phase={p} lostGround={lostGroundPhase === p.phase} />
            ))}
          </div>
        </div>
      )}

      {summary.strengths.length > 0 && (
        <ThemeSection
          title="What you did well"
          subtitle="Tactics you executed soundly — keep sharpening them."
          accent="emerald"
          themes={summary.strengths}
        />
      )}

      {summary.tacticsAllowed.length > 0 && (
        <ThemeSection
          title="Recurring weaknesses"
          subtitle="Tactics your opponent landed on you — study these to plug the gaps."
          accent="orange"
          themes={summary.tacticsAllowed}
        />
      )}

      {summary.missedOpportunities.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Missed opportunities
            <span className="ml-1.5 font-semibold normal-case text-gray-400 dark:text-slate-500">
              a stronger move was available
            </span>
          </p>
          <ul className="flex flex-col gap-1.5">
            {summary.missedOpportunities.slice(0, 5).map((m) => (
              <li
                key={m.ply}
                className="rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                  {moveLabel(m.ply)}
                </span>
                <span className="text-gray-700 dark:text-slate-200">you played</span>
                <span className="font-mono font-bold text-gray-900 dark:text-slate-100">{m.moveSan}</span>
                <span className="text-gray-400 dark:text-slate-500">→ better was</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {m.bestMoveSan}
                </span>
                <span
                  className={clsx(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                    m.classification === "blunder"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                      : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
                  )}
                >
                  {m.classification}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SideCard({
  label,
  stats,
  highlight,
}: {
  label: string
  stats: SideStats
  highlight?: boolean
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3 flex flex-col gap-2",
        highlight
          ? "border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/20"
          : "border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={clsx(
            "text-sm font-display font-bold",
            highlight
              ? "text-indigo-900 dark:text-indigo-100"
              : "text-gray-800 dark:text-slate-200",
          )}
        >
          {label}
        </span>
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
          {stats.accuracy}% acc · {stats.acpl} ACPL
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <CountChip n={stats.brilliant} label="brilliant" tone="fuchsia" />
        <CountChip n={stats.blunder} label="blunder" tone="red" />
        <CountChip n={stats.mistake} label="mistake" tone="orange" />
        <CountChip n={stats.inaccuracy} label="inaccuracy" tone="amber" />
      </div>
    </div>
  )
}

const TONE: Record<string, string> = {
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
}

function CountChip({ n, label, tone }: { n: number; label: string; tone: string }) {
  if (n <= 0) return null
  return (
    <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", TONE[tone])}>
      {n} {label}
      {n === 1 ? "" : "s"}
    </span>
  )
}

function PhaseCard({ phase, lostGround }: { phase: PhaseAssessment; lostGround: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2.5 flex flex-col gap-1.5",
        lostGround
          ? "border-red-200/80 dark:border-red-800/60 bg-red-50/40 dark:bg-red-950/20"
          : "border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-display font-bold text-gray-800 dark:text-slate-200">
          {PHASE_LABEL[phase.phase] ?? phase.phase}
        </span>
        <span
          className={clsx(
            "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full",
            VERDICT_STYLE[phase.verdict],
          )}
        >
          {VERDICT_LABEL[phase.verdict]}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-slate-400">
        {phase.userMoves > 0 ? `${phase.userAcpl} ACPL` : "—"}
        {phase.userBlunders > 0
          ? ` · ${phase.userBlunders} blunder${phase.userBlunders === 1 ? "" : "s"}`
          : ""}
      </p>
      {lostGround && (
        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">
          You lost the most ground here
        </p>
      )}
    </div>
  )
}

const ACCENT: Record<string, { label: string; chip: string }> = {
  emerald: {
    label: "text-emerald-700 dark:text-emerald-400",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/70",
  },
  orange: {
    label: "text-orange-700 dark:text-orange-400",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/70",
  },
}

function ThemeSection({
  title,
  subtitle,
  accent,
  themes,
}: {
  title: string
  subtitle: string
  accent: "emerald" | "orange"
  themes: RecurringTheme[]
}) {
  const a = ACCENT[accent]
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className={clsx("text-[11px] font-bold uppercase tracking-wide", a.label)}>{title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2">
        {themes.map((t) => (
          <ThemeRow key={t.motifId} theme={t} chipClass={a.chip} />
        ))}
      </div>
    </div>
  )
}

function ThemeRow({ theme, chipClass }: { theme: RecurringTheme; chipClass: string }) {
  const motif = getInsightMotif(theme.motifId)
  if (!motif) return null
  const tag = motifLearnTarget(theme.motifId)
  const lessons = lessonsForMotif(theme.motifId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tag ? (
        <Link
          href={tag.href}
          className={clsx(
            "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
            chipClass,
          )}
        >
          <span aria-hidden>{motif.icon}</span>
          {motif.title}
          {theme.count > 1 && <span className="opacity-70">×{theme.count}</span>}
          <span aria-hidden className="opacity-70">↗</span>
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
          title={motif.description}
        >
          <span aria-hidden>{motif.icon}</span>
          {motif.title}
          {theme.count > 1 && <span className="opacity-70">×{theme.count}</span>}
        </span>
      )}
      {lessons.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80 dark:text-sky-300/80">
            Learn in:
          </span>
          {lessons.map((l) => (
            <Link
              key={l.lessonId}
              href={l.href}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              📘 {l.title}
            </Link>
          ))}
        </span>
      )}
    </div>
  )
}
