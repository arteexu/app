"use client"
import { useState } from "react"
import { Chess } from "chess.js"
import type { ContinuationStep as ContinuationStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { LessonLayout } from "./LessonLayout"
import { annotationsToProps } from "./ChessBoard"

interface Props {
  step: ContinuationStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function ContinuationStep({ step, onComplete, isLastStep }: Props) {
  const [moveIndex, setMoveIndex] = useState(-1)

  const currentFen = (() => {
    const game = new Chess(step.fen)
    for (let i = 0; i <= moveIndex; i++) {
      try { game.move(step.moves[i]) } catch {}
    }
    return game.fen()
  })()

  const annotation = moveIndex >= 0 ? step.moveAnnotations?.[moveIndex] : undefined
  const { arrows, squareStyles } = annotationsToProps(step.annotations)
  const isAtEnd = moveIndex === step.moves.length - 1

  const board = (
    <Chessboard
      options={{
        position: currentFen,
        boardOrientation: step.orientation ?? "white",
        allowDragging: false,
        arrows: moveIndex === -1 ? arrows : [],
        squareStyles: moveIndex === -1 ? squareStyles : {},
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <div>
        <h3 className="text-xl font-bold text-gray-900">{step.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{step.description}</p>
      </div>

      {annotation && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-indigo-900 text-sm">
          {annotation}
        </div>
      )}

      {/* Move list */}
      <div className="flex flex-wrap gap-1.5">
        {step.moves.map((move, i) => (
          <button
            key={i}
            onClick={() => setMoveIndex(i)}
            className={`text-sm rounded-lg px-2.5 py-1 font-mono transition-all ${
              i === moveIndex ? "bg-indigo-600 text-white"
              : i < moveIndex ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{move}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={() => setMoveIndex(i => Math.max(-1, i - 1))}
          variant="secondary" size="sm"
          disabled={moveIndex === -1}
        >
          ← Prev
        </Button>
        <Button
          onClick={() => setMoveIndex(i => Math.min(step.moves.length - 1, i + 1))}
          variant="secondary" size="sm"
          disabled={isAtEnd}
        >
          Next →
        </Button>
        <Button onClick={() => setMoveIndex(-1)} variant="ghost" size="sm">
          Reset
        </Button>
      </div>

      {isAtEnd && (
        <Button onClick={() => onComplete(true)} variant="primary" size="lg" className="mt-auto">
          {isLastStep ? "Finish lesson →" : "Continue →"}
        </Button>
      )}
    </LessonLayout>
  )
}
