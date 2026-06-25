"use client"
import { useState } from "react"
import type { IdentifyStep as IdentifyStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import { FeedbackPanel } from "./FeedbackPanel"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"

interface Props {
  step: IdentifyStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function IdentifyStep({ step, onComplete, isLastStep }: Props) {
  const boardOrientation = useLessonBoardOrientation(step.orientation ?? "white")
  const [clicked, setClicked] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const isCorrect = clicked === step.correctSquare

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (clicked && !submitted) {
    squareStyles[clicked] = { backgroundColor: "rgba(99, 102, 241, 0.4)" }
  }
  if (submitted) {
    squareStyles[step.correctSquare] = { backgroundColor: "rgba(34, 197, 94, 0.4)" }
    if (clicked && clicked !== step.correctSquare) {
      squareStyles[clicked] = { backgroundColor: "rgba(239, 68, 68, 0.3)" }
    }
  }

  const board = (
    <Chessboard
      options={{
        position: step.fen,
        boardOrientation,
        allowDragging: false,
        squareStyles,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        onSquareClick: submitted ? undefined : ({ square }) => setClicked(square),
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <p className="text-xl font-semibold text-gray-900 leading-snug">{step.question}</p>
      <p className="text-sm text-gray-500">Click the correct square on the board.</p>

      {step.hint && !submitted && (
        <button onClick={() => setShowHint(v => !v)} className="text-sm text-indigo-500 hover:underline self-start">
          {showHint ? step.hint : "Need a hint?"}
        </button>
      )}

      {!submitted && clicked && (
        <button
          onClick={() => setSubmitted(true)}
          className="self-start px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition-all"
        >
          Confirm: {clicked}
        </button>
      )}

      {!submitted && !clicked && (
        <p className="text-sm text-gray-400 italic">Click a square on the board to select it.</p>
      )}

      {submitted && (
        <FeedbackPanel
          isCorrect={isCorrect}
          explanation={step.explanation}
          onNext={() => onComplete(isCorrect)}
          isLastStep={isLastStep}
        />
      )}
    </LessonLayout>
  )
}
