"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { Chess } from "chess.js"
import type { ContinuationStep as ContinuationStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { annotationsToProps } from "./ChessBoard"
import { buildLastMoveStyles, buildUserHighlightStyles, composeSquareStyles } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { playBoardMoveSound } from "@/lib/ui-sounds"

interface Props {
  step: ContinuationStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function ContinuationStep({ step, onComplete, isLastStep }: Props) {
  const boardOrientation = useLessonBoardOrientation(step.orientation ?? "white")
  const [moveIndex, setMoveIndex] = useState(-1)
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)
  const prevMoveIndex = useRef(-1)

  // Stepping to a new move (or resetting) clears any user-drawn square markers.
  useEffect(() => {
    setUserHighlights([])
  }, [moveIndex])

  useEffect(() => {
    if (moveIndex < 0 || moveIndex === prevMoveIndex.current) {
      prevMoveIndex.current = moveIndex
      return
    }
    const game = new Chess(step.fen)
    let result
    for (let i = 0; i <= moveIndex; i++) {
      try { result = game.move(step.moves[i]) } catch {}
    }
    if (result) playBoardMoveSound(result, game)
    prevMoveIndex.current = moveIndex
  }, [moveIndex, step.fen, step.moves])

  // Keyboard navigation: ← go back, → go forward
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      setMoveIndex(i => Math.max(-1, i - 1))
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      setMoveIndex(i => Math.min(step.moves.length - 1, i + 1))
    }
  }, [step.moves.length])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const { currentFen, lastMove } = (() => {
    const game = new Chess(step.fen)
    let mv
    for (let i = 0; i <= moveIndex; i++) {
      try { mv = game.move(step.moves[i]) } catch {}
    }
    return {
      currentFen: game.fen(),
      lastMove: moveIndex >= 0 && mv ? { from: mv.from, to: mv.to } : null,
    }
  })()

  const annotation = moveIndex >= 0 ? step.moveAnnotations?.[moveIndex] : undefined
  const { arrows, squareStyles } = annotationsToProps(step.annotations)
  const isAtEnd = moveIndex === step.moves.length - 1

  function handleSquareClick() {
    setUserHighlights([])
  }

  const composedSquareStyles = composeSquareStyles(
    moveIndex === -1 ? squareStyles : buildLastMoveStyles(lastMove?.from, lastMove?.to),
    buildUserHighlightStyles(userHighlights),
  )

  const board = (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: currentFen,
          boardOrientation,
          allowDragging: false,
          arrows: moveIndex === -1 ? arrows : [],
          squareStyles: composedSquareStyles,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          onSquareClick: handleSquareClick,
          ...userHighlightHandlers,
        }}
      />
    </div>
  )

  return (
    <LessonLayout
      board={board}
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setMoveIndex(i => Math.max(-1, i - 1))}
              variant="secondary" size="sm"
              disabled={moveIndex === -1}
            >
              ◀ Prev
            </Button>
            <Button
              onClick={() => setMoveIndex(i => Math.min(step.moves.length - 1, i + 1))}
              variant="secondary" size="sm"
              disabled={isAtEnd}
            >
              Next ▶
            </Button>
            <Button onClick={() => setMoveIndex(-1)} variant="ghost" size="sm">
              ↺ Reset
            </Button>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Tip: use ← → arrow keys to navigate
          </p>
          {isAtEnd && (
            <Button onClick={() => onComplete(true)} variant="primary" size="lg" className="mt-1">
              {isLastStep ? "Finish lesson →" : "Continue →"}
            </Button>
          )}
        </div>
      }
    >
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{step.title}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{step.description}</p>
      </div>

      {annotation && (
        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl px-4 py-3 text-indigo-900 dark:text-indigo-200 text-sm">
          {annotation}
        </div>
      )}

      {/* Move list */}
      <div className="flex flex-wrap gap-1.5">
        {step.moves.map((move, i) => (
          <button
            key={i}
            onClick={() => setMoveIndex(i)}
            className={`text-sm rounded-lg px-2.5 py-1 font-mono transition-colors motion-reduce:transition-none ${
              i === moveIndex ? "bg-indigo-600 text-white"
              : i < moveIndex ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
            }`}
          >
            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{move}
          </button>
        ))}
      </div>
    </LessonLayout>
  )
}
