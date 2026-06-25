"use client"
// components/solitaire/SolitaireResults.tsx
// Score screen: difficulty-weighted score, accuracy, moves matched, best streak,
// the game recap, and persistence (localStorage always; Supabase if the table
// exists). Offers Play again / New game / Dashboard.

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Chessboard } from "react-chessboard"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import { scoreSession, difficultyLabel, type MoveResult } from "@/lib/solitaire-scoring"
import { getCutoffPly, fenAfter, winnerOf, moveFactAt } from "@/lib/solitaire/engine"
import { saveScore, getScoreRecord, type StoredScore } from "@/lib/solitaire/storage"
import { persistScoreToSupabase, type PersistResult } from "@/lib/solitaire/supabase-scores"
import { Confetti, Stars, useCountUp } from "@/components/lesson/RewardFx"
import { DifficultyPips } from "./DifficultyPips"

interface Props {
  setup: SolitaireSetup
  results: MoveResult[]
  onPlayAgain: () => void
  onNewGame: () => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

export function SolitaireResults({ setup, results, onPlayAgain, onNewGame }: Props) {
  const { game, side } = setup
  const summary = useMemo(() => scoreSession(results, game.difficulty), [results, game.difficulty])
  const cutoff = useMemo(() => getCutoffPly(game), [game])
  const finalFen = useMemo(() => fenAfter(game, cutoff), [game, cutoff])
  const winner = winnerOf(game.result)
  const finalSan = game.moves[cutoff - 1]
  const finalFact = useMemo(() => moveFactAt(game, cutoff - 1), [game, cutoff])

  const [isNewBest, setIsNewBest] = useState(false)
  const [synced, setSynced] = useState<PersistResult | null>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true

    const stored: StoredScore = {
      gameId: game.id,
      side,
      score: summary.score,
      accuracy: summary.accuracy,
      matchRate: summary.matchRate,
      matched: summary.matched,
      totalMoves: summary.totalMoves,
      bestStreak: summary.bestStreak,
      difficulty: summary.difficulty,
      stars: summary.stars,
      playedAt: new Date().toISOString(),
    }

    const prev = getScoreRecord(game.id, side)
    setIsNewBest(!prev || summary.score > prev.best.score)
    saveScore(stored)
    // Best-effort remote write; never throws, table may not exist yet.
    persistScoreToSupabase(stored).then(setSynced)
  }, [game.id, side, summary])

  const scoreShown = useCountUp(summary.score, true, 1000)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl p-7 text-white shadow-xl shadow-indigo-600/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500">
          <Confetti run count={90} originY={0.14} />
          <span className="pointer-events-none select-none absolute -right-6 -bottom-10 text-[200px] leading-none opacity-10">♛</span>

          <div className="relative flex flex-col items-center gap-3 text-center">
            <Stars rating={summary.stars} run size={40} gold="#fde047" />
            <p className="text-sm font-bold uppercase tracking-widest text-white/80">
              {isNewBest ? "🎉 New personal best!" : "Game complete"}
            </p>
            <div className="font-display text-6xl font-extrabold leading-none" style={{ textShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
              {scoreShown}
              <span className="text-2xl ml-1.5">pts</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              <HeroChip icon="🎯" label={`${summary.accuracy}% accuracy`} />
              <HeroChip icon="♟" label={`${summary.matched}/${summary.totalMoves} matched`} />
              {summary.bestStreak >= 2 && <HeroChip icon="🔥" label={`${summary.bestStreak} streak`} />}
            </div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Accuracy" value={`${summary.accuracy}%`} sub={`${summary.correctGuesses}/${summary.totalGuesses} guesses`} />
          <StatCard label="Moves matched" value={`${summary.matched}/${summary.totalMoves}`} sub={`${summary.firstTry} first try`} />
          <StatCard label="Best streak" value={`${summary.bestStreak}`} sub="in a row" />
          <StatCard label="Difficulty ×" value={`${summary.difficultyMultiplier.toFixed(2)}`} sub={difficultyLabel(summary.difficulty)} />
        </div>

        {/* Breakdown */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-3">
          <h2 className="font-display font-extrabold text-gray-900 dark:text-slate-100">Score breakdown</h2>
          <BreakdownRow label="First-try correct" value={summary.firstTry} accent="green" />
          <BreakdownRow label="Correct after retry" value={summary.retried} accent="amber" />
          <BreakdownRow label="Revealed" value={summary.revealed} accent="slate" />
          <BreakdownRow label="Skipped" value={summary.skipped} accent="slate" />
          <div className="border-t border-gray-100 dark:border-slate-700 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {summary.basePoints} base × {summary.difficultyMultiplier.toFixed(2)} difficulty
            </span>
            <span className="font-display font-extrabold text-indigo-600 dark:text-indigo-400 text-lg">
              {summary.score} pts
            </span>
          </div>
        </div>

        {/* Game recap */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-center">
          <div className="w-28 sm:w-32 shrink-0 rounded-xl overflow-hidden shadow">
            <Chessboard
              options={{
                position: finalFen,
                boardOrientation: side,
                allowDragging: false,
                darkSquareStyle: { backgroundColor: BOARD_DARK },
                lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                showNotation: false,
                id: "solitaire-final",
              }}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {game.opening} · {game.eco}
            </p>
            <p className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight">{game.title}</p>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {game.white} <span className="text-gray-400">vs</span> {game.black}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {[game.event, game.year].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mt-0.5">
              Result: {game.result}
              {winner && <span className="text-gray-400 font-normal"> · {winner === "white" ? game.white : game.black} won</span>}
              {!winner && <span className="text-gray-400 font-normal"> · draw</span>}
            </p>
            <DifficultyPips difficulty={game.difficulty} className="mt-1" />
          </div>
        </div>

        {/* About this game (verifiable note) + auto-generated final-move fact */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-2">
          <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{game.note}</p>
          {finalSan && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              <span className="font-semibold text-gray-700 dark:text-slate-200">Final move:</span>{" "}
              <span className="font-mono">{finalSan.replace(/[+#]/g, "")}</span>
              {finalFact ? ` — ${finalFact}` : ""}
            </p>
          )}
        </div>

        {/* Persistence hint */}
        <p className="text-center text-xs text-gray-400 dark:text-slate-500">
          {synced === "saved" ? "Saved to your account." : "Saved on this device."}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-indigo-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#312e81,0_8px_20px_rgba(79,70,229,0.35)] hover:bg-indigo-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#312e81] active:translate-y-[4px] active:shadow-[0_1px_0_#312e81] transition-all"
          >
            ↺ Play again
          </button>
          <button
            onClick={onNewGame}
            className="flex-1 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-indigo-300 transition-all"
          >
            ♟ New game
          </button>
          <Link
            href="/dashboard"
            className="flex-1 grid place-items-center bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-indigo-300 transition-all"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

function HeroChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/30 rounded-full px-3.5 py-1.5 text-[13px] font-bold">
      {icon} {label}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</p>
      <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-1 leading-none">{value}</p>
      <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

function BreakdownRow({ label, value, accent }: { label: string; value: number; accent: "green" | "amber" | "slate" }) {
  const dot =
    accent === "green" ? "bg-green-500" : accent === "amber" ? "bg-amber-500" : "bg-gray-300 dark:bg-slate-600"
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-gray-600 dark:text-slate-300">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-bold text-gray-900 dark:text-slate-100 tabular-nums">{value}</span>
    </div>
  )
}
