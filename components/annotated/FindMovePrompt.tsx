"use client"
// components/annotated/FindMovePrompt.tsx
// The board-integrated "find the move" prompt for an annotated game's concept
// check. Instead of the move auto-playing and a text question appearing in a
// side panel, the learner first plays the actual game move ON the board (same
// interaction as a lesson PuzzleStep). This card is the panel-side prompt for
// that challenge; the board drag/click handling lives in AnnotatedGamePlayer
// (the choke point that owns the <Chessboard>). Once the move is found (or
// revealed) the annotator's commentary + the multiple-choice concept check are
// shown — preserving all existing content.

import { useState } from "react"
import { SanNotation } from "@/components/chess/SanNotation"

interface Props {
  /** Name of the side to move here (e.g. "Magnus Carlsen"). */
  moverName: string
  side: "white" | "black"
  moveNumber: number
  /** The SAN of the most recent wrong attempt, or null. */
  wrongSan: string | null
  hint?: string
  /** Skip the challenge and play the move for the learner. */
  onReveal: () => void
}

export function FindMovePrompt({ moverName, side, moveNumber, wrongSan, hint, onReveal }: Props) {
  const [showHint, setShowHint] = useState(false)

  return (
    <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">
          Your move
        </span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          Move {moveNumber}
        </span>
      </div>

      <p className="font-display text-lg font-extrabold leading-snug text-gray-900 dark:text-slate-100">
        Find the move {moverName} played here.
      </p>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        {side === "white" ? "White" : "Black"} to move — play it on the board to reveal the annotation.
      </p>

      {wrongSan && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-900 dark:text-red-300 leading-relaxed">
          <span className="font-display font-extrabold text-red-600 dark:text-red-400 mr-1">Not that one —</span>
          <SanNotation san={wrongSan} side={side} className="inline-flex" /> isn&apos;t what was played in the game. Try again.
        </div>
      )}

      {hint && (
        <button
          onClick={() => setShowHint((v) => !v)}
          className="text-sm font-semibold text-indigo-500 hover:underline self-start"
        >
          {showHint ? hint : "Need a hint?"}
        </button>
      )}

      <button
        onClick={onReveal}
        className="self-start text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 underline-offset-2 hover:underline transition"
      >
        Reveal the move
      </button>
    </div>
  )
}
