"use client"
// components/solitaire/SolitaireMatchResults.tsx
// Head-to-head RANKED match result. Reuses the same scoring as everywhere else
// (scoreSession), submits the score to the match, then shows win/loss/draw, your
// score vs the opponent's, and your Elo before → after. For a live opponent who
// hasn't finished yet it shows a "waiting" state (Elo settles when they play).

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import { Chessboard } from "react-chessboard"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import { scoreSession, type MoveResult } from "@/lib/solitaire-scoring"
import { getCutoffPly, fenAfter } from "@/lib/solitaire/engine"
import { submitMatchResult, resignMatch } from "@/lib/multiplayer/matchmaking"
import type { MatchAndGame, MatchResultOutcome } from "@/lib/multiplayer/types"
import { Confetti, useCountUp } from "@/components/lesson/RewardFx"
import { SolitaireGameInsights } from "./SolitaireGameInsights"

interface Props {
  setup: SolitaireSetup
  match: MatchAndGame
  results: MoveResult[]
  /** True when the user resigned: record a forfeit loss instead of a score. */
  forfeit?: boolean
  onFindAnother: () => void
  onExit: () => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

const OPP_KIND_LABEL: Record<string, string> = {
  live: "Live opponent",
  ghost: "Ghost (recorded run)",
  bot: "Par bot",
}

export function SolitaireMatchResults({
  setup,
  match,
  results,
  forfeit = false,
  onFindAnother,
  onExit,
}: Props) {
  const { game, side } = setup
  const summary = useMemo(() => scoreSession(results, game.difficulty), [results, game.difficulty])
  const cutoff = useMemo(() => getCutoffPly(game), [game])
  const finalFen = useMemo(() => fenAfter(game, cutoff), [game, cutoff])

  const [res, setRes] = useState<MatchResultOutcome | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    if (forfeit) {
      // Resigned mid-game: record the forfeit loss; no score is submitted.
      resignMatch(match.matchId).then(setRes)
      return
    }
    submitMatchResult({
      matchId: match.matchId,
      score: summary.score,
      side,
      accuracy: summary.accuracy,
      matchRate: summary.matchRate,
      matched: summary.matched,
      totalMoves: summary.totalMoves,
      bestStreak: summary.bestStreak,
      difficulty: summary.difficulty,
    }).then(setRes)
  }, [match, side, summary, forfeit])

  const scoreShown = useCountUp(summary.score, true, 900)
  const outcome = res?.outcome ?? null
  const pending = res?.status === "pending"
  const delta = res?.eloDelta ?? 0
  const gained = delta >= 0

  const theme =
    outcome === "win"
      ? { grad: "from-emerald-600 via-teal-600 to-green-600", shadow: "shadow-emerald-600/30", word: "Victory", icon: "🏆" }
      : outcome === "loss"
        ? { grad: "from-rose-600 via-red-600 to-orange-600", shadow: "shadow-rose-600/30", word: "Defeat", icon: "💀" }
        : outcome === "draw"
          ? { grad: "from-slate-600 via-slate-700 to-gray-700", shadow: "shadow-slate-600/30", word: "Draw", icon: "🤝" }
          : { grad: "from-indigo-600 via-violet-600 to-fuchsia-600", shadow: "shadow-indigo-600/30", word: "Match", icon: "⚔️" }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-6">
        {/* Hero */}
        <div className={clsx("relative overflow-hidden rounded-3xl p-7 text-white shadow-xl bg-gradient-to-br", theme.grad, theme.shadow)}>
          {outcome === "win" && <Confetti run count={90} originY={0.14} />}
          <span className="pointer-events-none select-none absolute -right-6 -bottom-10 text-[200px] leading-none opacity-10">{theme.icon}</span>
          <div className="relative flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-white/80">
              {forfeit ? "Resigned" : "Ranked match"}
            </p>
            <div className="font-display text-5xl font-extrabold leading-none">
              {pending ? "Submitted" : forfeit ? "Resigned" : theme.word}
            </div>
            {/* Score vs score */}
            <div className="mt-3 flex items-center gap-4">
              <ScorePill label="You" value={forfeit ? "—" : scoreShown} highlight={outcome === "win"} />
              <span className="font-display text-2xl font-extrabold text-white/70">vs</span>
              <ScorePill
                label={match.opponentLabel}
                value={pending ? "…" : res?.opponentScore ?? match.opponentScore ?? 0}
                highlight={outcome === "loss"}
              />
            </div>
            <p className="text-xs font-semibold text-white/70 mt-2">
              {OPP_KIND_LABEL[match.opponentKind] ?? "Opponent"}
              {forfeit ? " · you forfeited" : ` · ${summary.accuracy}% accuracy`}
            </p>
          </div>
        </div>

        {/* Elo card */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          {res === null ? (
            <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
              <Spinner /> Settling the match…
            </div>
          ) : pending ? (
            <div className="flex flex-col gap-2">
              <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                Waiting for {match.opponentLabel} to play…
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Your score is locked in. This is an asynchronous match — your Elo will update once
                your opponent finishes their game. Check back from the leaderboard.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  Your Elo
                </p>
                <div className="flex items-end gap-2">
                  <span className="font-display text-4xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
                    {res.eloAfter}
                  </span>
                  <span
                    className={clsx(
                      "font-display text-lg font-extrabold tabular-nums mb-1",
                      gained ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {gained ? "▲ +" : "▼ "}
                    {Math.abs(delta)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">was {res.eloBefore}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  Result
                </p>
                <span
                  className={clsx(
                    "font-display text-2xl font-extrabold",
                    outcome === "win"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : outcome === "loss"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {outcome === "win" ? "Win" : outcome === "loss" ? "Loss" : "Draw"}
                </span>
              </div>
            </div>
          )}

          {res && !res.persisted && (
            <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              {res.reason === "signed-out"
                ? "Sign in to save ranked results to your rating."
                : "Matchmaking backend unavailable — this result wasn't saved."}
            </p>
          )}
        </div>

        {!forfeit && results.length > 0 && (
          <SolitaireGameInsights game={game} side={side} results={results} />
        )}

        {/* Game recap */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-28 sm:w-32 shrink-0 rounded-xl overflow-hidden shadow">
            <Chessboard
              options={{
                position: finalFen,
                boardOrientation: side,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                showNotation: false,
                id: "match-final",
              }}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {game.opening} · {game.eco}
            </p>
            <p className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight">{game.title}</p>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {forfeit
                ? `You resigned (playing ${side})`
                : `You played ${side} · ${summary.matched}/${summary.totalMoves} moves matched`}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Both players solved this same game — higher score wins.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onFindAnother}
            className="flex-1 bg-rose-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#9f1239,0_8px_20px_rgba(225,29,72,0.35)] hover:bg-rose-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#9f1239] active:translate-y-[4px] active:shadow-[0_1px_0_#9f1239] transition-all"
          >
            ⚔️ Find another match
          </button>
          <button
            onClick={onExit}
            className="flex-1 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-rose-300 transition-all"
          >
            ♟ Back
          </button>
          <Link
            href="/play/leaderboard"
            className="flex-1 grid place-items-center bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-rose-300 transition-all"
          >
            🏆 Leaderboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function ScorePill({ label, value, highlight }: { label: string; value: number | string; highlight: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-2.5 min-w-[88px] border",
        highlight ? "bg-white/25 border-white/40" : "bg-white/[0.12] border-white/20",
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/70 truncate max-w-[120px]">{label}</div>
      <div className="font-display text-3xl font-extrabold leading-none tabular-nums">{value}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
