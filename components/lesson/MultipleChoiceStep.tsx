"use client"
import { useState } from "react"
import type { MultipleChoiceStep as MultipleChoiceStepType } from "@/lib/types"
import { FeedbackPanel } from "./FeedbackPanel"
import { Chessboard } from "react-chessboard"
import { LessonLayout } from "./LessonLayout"
import { annotationsToProps } from "./ChessBoard"
import { clsx } from "clsx"

interface Props {
  step: MultipleChoiceStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function MultipleChoiceStep({ step, onComplete, isLastStep }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const isCorrect = selected === step.correctIndex
  const { squareStyles, arrows } = annotationsToProps(step.annotations)

  const board = step.fen ? (
    <Chessboard
      options={{
        position: step.fen,
        boardOrientation: "white",
        allowDragging: false,
        squareStyles,
        arrows,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
      }}
    />
  ) : undefined

  return (
    <LessonLayout board={board}>
      <p className="text-xl font-semibold text-gray-900 leading-snug">{step.question}</p>

      <div className="flex flex-col gap-3.5">
        {step.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => { if (!submitted) setSelected(i) }}
            disabled={submitted}
            className={clsx(
              "text-left px-4 py-3.5 rounded-xl border text-sm transition-all",
              submitted && i === step.correctIndex
                ? "border-green-400 bg-green-50 text-green-900 font-medium"
                : submitted && i === selected && !isCorrect
                ? "border-red-400 bg-red-50 text-red-900"
                : selected === i
                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-gray-800"
            )}
          >
            <span className="font-semibold mr-2 text-gray-400">{String.fromCharCode(65 + i)}.</span>
            {opt.text}
          </button>
        ))}
      </div>

      {step.hint && !submitted && (
        <button onClick={() => setShowHint(v => !v)} className="text-sm text-indigo-500 hover:underline self-start">
          {showHint ? step.hint : "Need a hint?"}
        </button>
      )}

      {!submitted && (
        <button
          onClick={() => setSubmitted(true)}
          disabled={selected === null}
          className="self-start mt-3 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_0_#312e81] hover:shadow-[0_2px_0_#312e81] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
        >
          Check answer
        </button>
      )}

      {submitted && (
        <FeedbackPanel
          isCorrect={isCorrect}
          explanation={step.options[selected!].explanation}
          onNext={() => onComplete(isCorrect)}
          isLastStep={isLastStep}
        />
      )}
    </LessonLayout>
  )
}
