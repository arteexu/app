"use client"
// components/play/PlayGameReview.tsx
// Full review view for one saved Play game.

import Link from "next/link"
import type { SavedPlayGame } from "@/lib/play/saved-play-games"
import { resultTag } from "@/lib/play/types"
import { PlayGameReviewStepper } from "./PlayGameReviewStepper"
import { PlayGameInsights } from "./PlayGameInsights"

const REASON_LABEL: Record<string, string> = {
  checkmate: "checkmate",
  resign: "resignation",
  timeout: "time",
  stalemate: "stalemate",
  draw_agreement: "agreement",
  insufficient_material: "insufficient material",
  threefold: "threefold",
  fifty_move: "50-move rule",
  abandon: "abandon",
}

export function PlayGameReview({ game }: { game: SavedPlayGame }) {
  const outcome =
    game.result.winner === "draw"
      ? "Draw"
      : game.result.winner === game.userColor
        ? "You won"
        : "You lost"

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">
            {game.name}
          </h1>
          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
            {game.opponentType === "bot" ? "vs Bot" : "vs Human"}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          <span className="font-semibold">{outcome}</span>
          {" · "}
          {game.result.winner === "draw"
            ? "Draw"
            : `${game.result.winner === "white" ? "White" : "Black"} wins`}{" "}
          by {REASON_LABEL[game.result.reason] ?? game.result.reason}
          {" · "}
          {resultTag(game.result.winner)}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {game.opponentLabel} · {game.timeControlId} · You played{" "}
          {game.userColor === "white" ? "White" : "Black"} · Saved{" "}
          {new Date(game.savedAt).toLocaleString()}
        </p>
      </div>

      <PlayGameReviewStepper moves={game.moves} userColor={game.userColor} />

      <PlayGameInsights
        moves={game.moves}
        result={game.result}
        userColor={game.userColor}
        gameKey={`play:${game.id}`}
        gameLabel={game.name}
      />

      <div className="flex gap-3">
        <Link
          href="/play/saved"
          className="font-display font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 transition"
        >
          ← All saved games
        </Link>
        <Link
          href="/play"
          className="font-display font-bold text-sm px-4 py-2.5 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition"
        >
          Play hub
        </Link>
      </div>
    </div>
  )
}
