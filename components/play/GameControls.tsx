"use client"
// components/play/GameControls.tsx
// In-game action row shared by Bot and Human modes: resign, offer/accept draw.
// The parent decides which actions are available (e.g. a bot never offers a draw
// back; a live opponent's offer surfaces an accept/decline prompt).

import { clsx } from "clsx"

export interface DrawOffer {
  /** True when there's an incoming draw offer awaiting this player's response. */
  incoming: boolean
  /** True when this player has a pending outgoing offer. */
  outgoing: boolean
}

export function GameControls({
  canResign,
  canOfferDraw,
  draw,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
}: {
  canResign: boolean
  canOfferDraw: boolean
  draw: DrawOffer
  onResign: () => void
  onOfferDraw: () => void
  onAcceptDraw: () => void
  onDeclineDraw: () => void
}) {
  if (draw.incoming) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
          Your opponent offers a draw.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onAcceptDraw}
            className="flex-1 font-display font-bold py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            Accept
          </button>
          <button
            onClick={onDeclineDraw}
            className="flex-1 font-display font-bold py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600 transition"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onResign}
        disabled={!canResign}
        className={clsx(
          "font-display font-bold py-2.5 rounded-xl border-2 transition",
          canResign
            ? "border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            : "border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed",
        )}
      >
        🏳 Resign
      </button>
      <button
        onClick={onOfferDraw}
        disabled={!canOfferDraw || draw.outgoing}
        className={clsx(
          "font-display font-bold py-2.5 rounded-xl border-2 transition",
          canOfferDraw && !draw.outgoing
            ? "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
            : "border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed",
        )}
      >
        {draw.outgoing ? "Draw offered…" : "½ Offer draw"}
      </button>
    </div>
  )
}
