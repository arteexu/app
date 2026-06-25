"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { getAllScoreRecords, type GameScoreRecord } from "@/lib/solitaire/storage"
import { getGame } from "@/lib/solitaire/games"

export function SolitaireStatsPanel() {
  const [scores, setScores] = useState<ReturnType<typeof getAllScoreRecords>>({})

  const refresh = useCallback(() => {
    setScores(getAllScoreRecords())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [refresh])

  const entries = Object.entries(scores)
    .map(([key, record]) => {
      const [gameId, side] = key.split(":") as [string, "white" | "black"]
      const game = getGame(gameId)
      return { gameId, side, game, record: record as GameScoreRecord }
    })
    .filter(e => e.game)
    .sort((a, b) => b.record.best.score - a.record.best.score)

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 p-6 text-center">
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">No solitaire games yet</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
          Play a game of Solitaire Chess and your best scores will show up here.
        </p>
        <Link
          href="/solitaire"
          className="inline-flex mt-4 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Try Solitaire Chess →
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.slice(0, 6).map(({ gameId, side, game, record }) => (
        <li
          key={`${gameId}:${side}`}
          className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm"
        >
          <span className="text-xl leading-none shrink-0" aria-hidden>
            {side === "white" ? "♔" : "♚"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
              {game!.white} vs {game!.black}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {record.plays} {record.plays === 1 ? "play" : "plays"} · {Math.round(record.best.accuracy)}% accuracy
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-lg font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {record.best.score}
            </p>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase">best</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
