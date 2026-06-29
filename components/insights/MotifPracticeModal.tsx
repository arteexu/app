"use client"
// components/insights/MotifPracticeModal.tsx
// Click-to-practice drill for a detected motif. Cycles through positions taken
// from the user's own analyzed game where the motif appeared on a sound move;
// the engine-approved move played there is the answer. Fully interactive: the
// user makes a move on the board and gets immediate feedback.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { clsx } from "clsx"
import { getInsightMotif } from "@/lib/insights/motifs"
import type { InsightMotifId } from "@/lib/insights/motifs"
import { sanMatches, type PracticePosition } from "@/lib/insights/practice"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import {
  buildLastMoveStyles,
  buildSelectionStyles,
  composeSquareStyles,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/legal-move-highlights"
import { SanNotation } from "@/components/chess/SanNotation"

interface Props {
  motifId: InsightMotifId
  positions: PracticePosition[]
  onClose: () => void
}

type Status = "idle" | "wrong" | "solved" | "revealed"

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function MotifPracticeModal({ motifId, positions, onClose }: Props) {
  const motif = getInsightMotif(motifId)
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<Status>("idle")
  const [solvedPlies, setSolvedPlies] = useState<Set<number>>(new Set())
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [displayFen, setDisplayFen] = useState(positions[0]?.fen ?? "")

  const position = positions[index]
  const game = useMemo(() => new Chess(position.fen), [position.fen])
  const learnerColor = position.orientation === "white" ? "w" : "b"
  const interactive = status === "idle" || status === "wrong"

  const {
    selectedSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game,
    enabled: interactive,
    isSelectable: (_sq, piece) => !!piece && piece.color === learnerColor,
  })

  const resetToPosition = useCallback(
    (i: number) => {
      setIndex(i)
      setStatus("idle")
      setLastMove(null)
      setDisplayFen(positions[i].fen)
      clearHighlights()
    },
    [positions, clearHighlights],
  )

  // ── Accessibility: focus trap + escape + scroll lock ────────────────────────
  const trapFocus = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== "Tab" || !dialogRef.current) return
      const nodes = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    document.addEventListener("keydown", trapFocus)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", trapFocus)
    }
  }, [trapFocus])

  // ── Solve logic ─────────────────────────────────────────────────────────────
  function attemptMove(from: string, to: string): boolean {
    if (!interactive || from === to) return false
    const probe = new Chess(position.fen)
    let mv
    try {
      mv = probe.move({ from: from as never, to: to as never, promotion: "q" })
    } catch {
      return false
    }
    if (!mv) return false

    const correct = position.solutionSans.some((s) => sanMatches(s, mv.san))
    clearHighlights()
    if (correct) {
      setStatus("solved")
      setDisplayFen(probe.fen())
      setLastMove({ from: mv.from, to: mv.to })
      setSolvedPlies((prev) => new Set(prev).add(position.ply))
      return true
    }
    setStatus("wrong")
    setLastMove(null)
    setDisplayFen(position.fen)
    return true
  }

  function showAnswer() {
    const probe = new Chess(position.fen)
    let mv
    try {
      mv = probe.move(position.playedSan)
    } catch {
      return
    }
    if (!mv) return
    setStatus("revealed")
    setDisplayFen(probe.fen())
    setLastMove({ from: mv.from, to: mv.to })
    clearHighlights()
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    const moved = attemptMove(sourceSquare, targetSquare)
    onDragEnd()
    return moved
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!interactive) return
    if (status === "wrong") setStatus("idle")
    if (selectedSquare) {
      if (square === selectedSquare) {
        clearHighlights()
        return
      }
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  const squareStyles = composeSquareStyles(
    buildLastMoveStyles(lastMove?.from, lastMove?.to),
    interactive ? legalMoveSquares : {},
    interactive ? buildSelectionStyles(selectedSquare) : {},
  )

  const total = positions.length
  const solvedCount = solvedPlies.size
  const hasNext = index < total - 1

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm motion-reduce:backdrop-blur-none"
        aria-hidden
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "relative w-full sm:max-w-md max-h-[min(94vh,860px)] flex flex-col overflow-y-auto",
          "bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl",
          "border border-gray-200 dark:border-slate-700 shadow-2xl shadow-indigo-900/20",
          "animate-[rise_0.3s_ease_both] motion-reduce:animate-none",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl px-6 pt-6 pb-5 shrink-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-500 text-white">
          <span
            className="pointer-events-none select-none absolute -right-2 -top-3 text-[88px] leading-none opacity-15"
            aria-hidden
          >
            {motif?.icon ?? "♟"}
          </span>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">
                Practice · {motif?.kind === "concept" ? "Concept" : "Tactic"}
              </p>
              <h2 id={titleId} className="font-display text-2xl font-extrabold mt-0.5">
                {motif?.icon} {motif?.title ?? "Practice"}
              </h2>
              <p className="text-sm font-medium text-white/85 mt-0.5">{motif?.practicePrompt}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Close practice"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 flex flex-col gap-4">
          {/* Progress */}
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400">
            <span>
              Position {index + 1} of {total}
            </span>
            <span className="tabular-nums">
              {solvedCount} solved
            </span>
          </div>

          {/* Board */}
          <div className="w-full max-w-[360px] mx-auto" onContextMenu={(e) => e.preventDefault()}>
            <Chessboard
              options={{
                id: `motif-practice-${motifId}`,
                position: displayFen,
                boardOrientation: position.orientation,
                allowDragging: interactive,
                dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
                squareStyles,
                darkSquareStyle: { backgroundColor: "#769656" },
                lightSquareStyle: { backgroundColor: "#eeeed2" },
                animationDurationInMs: 200,
                onPieceDrop: interactive ? handleDrop : undefined,
                onPieceDrag: interactive ? onPieceDrag : undefined,
                onSquareClick: interactive ? handleSquareClick : undefined,
              }}
            />
          </div>

          <p className="text-center text-sm font-semibold text-gray-700 dark:text-slate-200">
            {position.orientation === "white" ? "White" : "Black"} to move ·{" "}
            <span className="text-gray-400 dark:text-slate-500 font-medium">{position.moveLabel}</span>
          </p>

          {/* Feedback */}
          {status === "idle" && (
            <p className="text-center text-sm text-gray-500 dark:text-slate-400">
              {motif?.practicePrompt} Make your move on the board.
            </p>
          )}
          {status === "wrong" && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-center">
              <p className="text-sm font-bold text-red-800 dark:text-red-300">✗ Not the move.</p>
              <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5">
                Try again, or reveal the answer.
              </p>
            </div>
          )}
          {status === "solved" && (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-center">
              <p className="text-sm font-bold text-green-800 dark:text-green-300">
                ✓ Correct! <SanNotation san={position.playedSan} color={learnerColor === "w" ? "white" : "black"} className="font-mono" />
              </p>
            </div>
          )}
          {status === "revealed" && (
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3 text-center">
              <p className="text-sm font-bold text-indigo-800 dark:text-indigo-300">
                Answer:{" "}
                <SanNotation san={position.playedSan} color={learnerColor === "w" ? "white" : "black"} className="font-mono" />
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(status === "idle" || status === "wrong") && (
              <button
                onClick={showAnswer}
                className="text-sm font-bold px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-indigo-400 transition"
              >
                Show answer
              </button>
            )}
            {(status === "solved" || status === "revealed") && (
              <button
                onClick={() => resetToPosition(index)}
                className="text-sm font-bold px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-indigo-400 transition"
              >
                Retry
              </button>
            )}
            {hasNext ? (
              <button
                onClick={() => resetToPosition(index + 1)}
                className="text-sm font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Next position →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-sm font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
