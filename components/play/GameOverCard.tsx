"use client"
// components/play/GameOverCard.tsx
// Result overlay shown when a Play game finishes: outcome headline, the reason it
// ended, and the Play-rating change (when rated). Action buttons are provided by
// the caller (e.g. "New game", "Rematch", "Back to Play").

import { clsx } from "clsx"
import type { EndReason, PieceColor } from "@/lib/play/types"

const REASON_LABEL: Record<EndReason, string> = {
  checkmate: "by checkmate",
  resign: "by resignation",
  timeout: "on time",
  stalemate: "by stalemate",
  draw_agreement: "by agreement",
  insufficient_material: "— insufficient material",
  threefold: "by threefold repetition",
  fifty_move: "by the 50-move rule",
  abandon: "— opponent left",
}

export interface GameOverInfo {
  /** Result from THIS player's perspective. */
  outcome: "win" | "loss" | "draw"
  winner: PieceColor | "draw"
  reason: EndReason
  eloBefore?: number
  eloAfter?: number
  eloDelta?: number
  ratingNote?: string
}

export function GameOverCard({
  info,
  actions,
}: {
  info: GameOverInfo
  actions: React.ReactNode
}) {
  const headline =
    info.outcome === "win" ? "You won" : info.outcome === "loss" ? "You lost" : "Draw"
  const accent =
    info.outcome === "win"
      ? "from-emerald-500 to-green-600"
      : info.outcome === "loss"
        ? "from-rose-500 to-red-600"
        : "from-slate-500 to-slate-600"

  const hasElo = info.eloDelta != null && info.eloAfter != null

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className={clsx("bg-gradient-to-r text-white px-6 py-5 text-center", accent)}>
          <p className="font-display text-2xl font-extrabold">{headline}</p>
          <p className="text-sm font-semibold opacity-90 mt-0.5">
            {info.winner === "draw" ? "Draw" : `${cap(info.winner)} wins`} {REASON_LABEL[info.reason]}
          </p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {hasElo ? (
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  Play rating
                </p>
                <p className="font-display text-3xl font-extrabold tabular-nums text-gray-900 dark:text-slate-100">
                  {info.eloAfter}
                </p>
              </div>
              <span
                className={clsx(
                  "font-bold text-lg tabular-nums px-2.5 py-1 rounded-lg",
                  (info.eloDelta ?? 0) > 0
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                    : (info.eloDelta ?? 0) < 0
                      ? "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
                      : "text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700/40",
                )}
              >
                {(info.eloDelta ?? 0) >= 0 ? "+" : ""}
                {info.eloDelta}
              </span>
            </div>
          ) : (
            info.ratingNote && (
              <p className="text-center text-sm text-gray-500 dark:text-slate-400">{info.ratingNote}</p>
            )
          )}
          <div className="flex flex-col gap-2">{actions}</div>
        </div>
      </div>
    </div>
  )
}

function cap(c: PieceColor | "draw"): string {
  if (c === "white") return "White"
  if (c === "black") return "Black"
  return "Draw"
}
