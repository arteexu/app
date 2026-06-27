"use client"
// components/play/PlayGameReviewStepper.tsx
// Move-by-move replay for a saved Play game.

import { useEffect, useMemo, useState } from "react"
import { clsx } from "clsx"
import type { PieceColor, PlayedMove } from "@/lib/play/types"
import { fenBeforePly } from "@/lib/play/saved-play-games"
import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"
import { GameBoard } from "./GameBoard"
import { SanNotation } from "@/components/chess/SanNotation"

interface Props {
  moves: PlayedMove[]
  userColor: PieceColor
}

export function PlayGameReviewStepper({ moves, userColor }: Props) {
  const cutoff = moves.length
  const [viewPly, setViewPly] = useState(cutoff)
  const [orientation, setOrientation] = useState<PieceColor>(userColor)

  useEffect(() => {
    setViewPly(cutoff)
  }, [cutoff])

  const clamped = Math.min(Math.max(viewPly, 0), cutoff)
  const fen = useMemo(() => fenBeforePly(moves, clamped), [moves, clamped])
  const lastMove =
    clamped > 0
      ? {
          from: moves[clamped - 1].uci.slice(0, 2),
          to: moves[clamped - 1].uci.slice(2, 4),
        }
      : null

  const atStart = clamped <= 0
  const atEnd = clamped >= cutoff

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setViewPly((p) => Math.max(0, p - 1))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setViewPly((p) => Math.min(cutoff, p + 1))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [cutoff])

  const rows: { no: number; white?: PlayedMove; black?: PlayedMove }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: moves[i], black: moves[i + 1] })
  }

  function plyForRow(rowNo: number, color: "white" | "black"): number {
    return color === "white" ? (rowNo - 1) * 2 : (rowNo - 1) * 2 + 1
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-extrabold text-gray-900 dark:text-slate-100">
          Replay
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 tabular-nums">
            {atStart
              ? "Start"
              : `Move ${Math.ceil(clamped / 2)} · ${moves[clamped - 1]?.color === "white" ? "White" : "Black"}`}
          </span>
          <FlipBoardButton onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="aspect-square max-w-md mx-auto w-full">
          <GameBoard
            fen={fen}
            orientation={orientation}
            myColor={userColor}
            canMove={false}
            onAttemptMove={() => false}
            lastMove={lastMove}
            boardId="play-review-stepper"
          />
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setViewPly(0)}
              disabled={atStart}
              className="px-2 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
              aria-label="Go to start"
            >
              ⏮
            </button>
            <button
              onClick={() => setViewPly((p) => Math.max(0, p - 1))}
              disabled={atStart}
              className="px-3 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setViewPly((p) => Math.min(cutoff, p + 1))}
              disabled={atEnd}
              className="px-3 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next →
            </button>
            <button
              onClick={() => setViewPly(cutoff)}
              disabled={atEnd}
              className="px-2 py-1 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40"
              aria-label="Go to end"
            >
              ⏭
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
            <table className="w-full text-sm tabular-nums">
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.no}
                    className={clsx(idx % 2 === 0 ? "bg-transparent" : "bg-black/[0.02] dark:bg-white/[0.02]")}
                  >
                    <td className="w-9 px-2 py-1 text-right font-mono text-xs text-gray-400 align-top">
                      {row.no}.
                    </td>
                    <td className="px-2 py-1">
                      {row.white && (
                        <button
                          onClick={() => setViewPly(plyForRow(row.no, "white") + 1)}
                          className={clsx(
                            "font-semibold hover:underline",
                            clamped === plyForRow(row.no, "white") + 1
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-gray-800 dark:text-slate-200",
                          )}
                        >
                          <SanNotation san={row.white.san} color="white" />
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {row.black && (
                        <button
                          onClick={() => setViewPly(plyForRow(row.no, "black") + 1)}
                          className={clsx(
                            "font-semibold hover:underline",
                            clamped === plyForRow(row.no, "black") + 1
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-gray-800 dark:text-slate-200",
                          )}
                        >
                          <SanNotation san={row.black.san} color="black" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
