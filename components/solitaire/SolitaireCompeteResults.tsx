"use client"
// components/solitaire/SolitaireCompeteResults.tsx
// Competitive results screen. Reuses the SAME scoring as single-player
// (scoreSession), then records the attempt to Supabase, updates the player's Elo
// vs the field, and shows the rating change, the player's rank on this game, and
// the per-game leaderboard. Falls back gracefully (no crash) when signed out or
// the multiplayer backend tables aren't present.

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { clsx } from "clsx"
import { Chessboard } from "react-chessboard"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import { scoreSession, type MoveResult } from "@/lib/solitaire-scoring"
import { getCutoffPly, fenAfter } from "@/lib/solitaire/engine"
import { recordCompetitiveScore, fetchGameLeaderboard } from "@/lib/multiplayer/scores"
import type { SharedGame, CompetitiveResult, GameLeaderboardRow } from "@/lib/multiplayer/types"
import { Confetti, Stars, useCountUp } from "@/components/lesson/RewardFx"

interface Props {
  setup: SolitaireSetup
  shared: SharedGame
  results: MoveResult[]
  onPlayAgain: () => void
  onNewGame: () => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

export function SolitaireCompeteResults({ setup, shared, results, onPlayAgain, onNewGame }: Props) {
  const { game, side } = setup
  const summary = useMemo(() => scoreSession(results, game.difficulty), [results, game.difficulty])
  const cutoff = useMemo(() => getCutoffPly(game), [game])
  const finalFen = useMemo(() => fenAfter(game, cutoff), [game, cutoff])

  const [comp, setComp] = useState<CompetitiveResult | null>(null)
  const [board, setBoard] = useState<GameLeaderboardRow[] | null>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    recordCompetitiveScore({
      game,
      side,
      score: summary.score,
      accuracy: summary.accuracy,
      matchRate: summary.matchRate,
      matched: summary.matched,
      totalMoves: summary.totalMoves,
      bestStreak: summary.bestStreak,
      difficulty: summary.difficulty,
      maxScore: summary.maxScore,
    }).then((res) => {
      setComp(res)
      // Refresh the leaderboard after the write lands.
      fetchGameLeaderboard(game.id).then(setBoard)
    })
  }, [game, side, summary])

  const scoreShown = useCountUp(summary.score, true, 1000)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl p-7 text-white shadow-xl shadow-rose-600/30 bg-gradient-to-br from-rose-600 via-fuchsia-600 to-indigo-600">
          <Confetti run count={90} originY={0.14} />
          <span className="pointer-events-none select-none absolute -right-6 -bottom-10 text-[200px] leading-none opacity-10">⚔️</span>
          <div className="relative flex flex-col items-center gap-3 text-center">
            <Stars rating={summary.stars} run size={40} gold="#fde047" />
            <p className="text-sm font-bold uppercase tracking-widest text-white/80">Casual result</p>
            <div className="font-display text-6xl font-extrabold leading-none" style={{ textShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
              {scoreShown}
              <span className="text-2xl ml-1.5">pts</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              <HeroChip icon="🎯" label={`${summary.accuracy}% accuracy`} />
              <HeroChip icon="♟" label={`${summary.matched}/${summary.totalMoves} matched`} />
              {comp && comp.totalPlayers > 0 && (
                <HeroChip icon="🏅" label={`Rank #${comp.rank} of ${comp.totalPlayers}`} />
              )}
            </div>
          </div>
        </div>

        {/* Casual card — practice only, no Elo change (ranked Elo = matchmaking) */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
          {comp === null ? (
            <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
              <Spinner /> Saving your score…
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Your rank · this game
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="font-display text-4xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
                      #{comp.rank}
                    </span>
                    <span className="font-display text-lg font-extrabold tabular-nums mb-1 text-gray-400 dark:text-slate-500">
                      of {comp.totalPlayers}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Casual — no Elo change</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Score to beat (par)
                  </p>
                  <span className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
                    {comp.par}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    {comp.fieldSize > 0 ? `vs ${comp.fieldSize} other ${comp.fieldSize === 1 ? "player" : "players"}` : "you set the bar"}
                  </p>
                </div>
              </div>

              <Link
                href="/solitaire?mode=match"
                className="inline-flex items-center justify-center gap-2 bg-rose-600 text-white font-display font-extrabold py-2.5 rounded-xl hover:bg-rose-700 transition"
              >
                ⚔️ Play a ranked match for Elo
              </Link>

              {!comp.persisted && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  {comp.reason === "signed-out"
                    ? "Sign in to save your score to the leaderboard."
                    : "Multiplayer backend isn't available yet — this result wasn't saved."}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Per-game leaderboard */}
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-gray-900 dark:text-slate-100">
              Leaderboard · this game
            </h2>
            <Link href="/leaderboard" className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">
              Global ranks →
            </Link>
          </div>
          {board === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse" />
              ))}
            </div>
          ) : board.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              No saved scores yet for this game — you could be the first on the board.
            </p>
          ) : (
            <div className="flex flex-col">
              {board.slice(0, 10).map((row) => (
                <div
                  key={row.userId + row.createdAt}
                  className={clsx(
                    "flex items-center gap-3 px-2.5 py-2 rounded-lg",
                    row.isMe && "bg-rose-50 dark:bg-rose-900/20",
                  )}
                >
                  <span className="w-7 text-center font-display font-extrabold tabular-nums text-gray-400 dark:text-slate-500">
                    {row.rank}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-semibold text-gray-800 dark:text-slate-200">
                    {row.displayName}
                    {row.isMe && <span className="ml-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">YOU</span>}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums hidden sm:inline">
                    {row.accuracy}%
                  </span>
                  <span className="font-display font-extrabold tabular-nums text-gray-900 dark:text-slate-100 w-16 text-right">
                    {row.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
                id: "compete-final",
              }}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              {game.opening} · {game.eco}
            </p>
            <p className="font-display font-extrabold text-gray-900 dark:text-slate-100 leading-tight">{game.title}</p>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {game.white} <span className="text-gray-400">vs</span> {game.black}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {shared.source === "generated" ? "Engine game" : "Master game"} · result {game.result}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-rose-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#9f1239,0_8px_20px_rgba(225,29,72,0.35)] hover:bg-rose-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#9f1239] active:translate-y-[4px] active:shadow-[0_1px_0_#9f1239] transition-all"
          >
            ↺ Play again
          </button>
          <button
            onClick={onNewGame}
            className="flex-1 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-rose-300 transition-all"
          >
            ⚔️ Pick another
          </button>
          <Link
            href="/leaderboard"
            className="flex-1 grid place-items-center bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-2 border-gray-200 dark:border-slate-700 font-display font-extrabold text-lg py-3.5 rounded-2xl hover:border-rose-300 transition-all"
          >
            🏆 Leaderboard
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

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
