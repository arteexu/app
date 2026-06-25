"use client"
// components/lesson/MultipleChoiceStep.tsx — restyled quiz (Quest look).
// Logic unchanged. <Chessboard> usage is IDENTICAL to the app (untouched).
import { useState } from "react"
import type { MultipleChoiceStep as MultipleChoiceStepType } from "@/lib/types"
import { FeedbackPanel } from "./FeedbackPanel"
import { Chessboard } from "react-chessboard"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { annotationsToProps } from "./ChessBoard"
import { clsx } from "clsx"

interface Props {
  step: MultipleChoiceStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function MultipleChoiceStep({ step, onComplete, isLastStep }: Props) {
  const boardOrientation = useLessonBoardOrientation("white")
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const isCorrect = selected === step.correctIndex
  const { squareStyles, arrows } = annotationsToProps(step.annotations)

  const board = step.fen ? (
    <Chessboard
      options={{
        position: step.fen,
        boardOrientation,
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
      <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">Quick check</div>
      <p className="font-display text-2xl font-extrabold leading-snug text-gray-900 dark:text-slate-100">{step.question}</p>

      <div className="flex flex-col gap-2.5">
        {step.options.map((opt, i) => {
          const showCorrect = submitted && i === step.correctIndex
          const showWrong = submitted && i === selected && !isCorrect
          const sel = selected === i
          return (
            <button
              key={i}
              onClick={() => { if (!submitted) setSelected(i) }}
              disabled={submitted}
              className={clsx(
                "flex items-center gap-3.5 text-left px-4 py-3.5 rounded-2xl border-2 text-[15px] transition-all",
                showCorrect ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                  : showWrong ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                  : sel ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-[0_6px_16px_-8px_rgba(99,102,241,0.5)]"
                  : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              )}
            >
              <span className={clsx("w-7 h-7 rounded-lg grid place-items-center text-[13px] font-extrabold flex-shrink-0",
                showCorrect ? "bg-green-600 text-white" : showWrong ? "bg-red-600 text-white"
                  : sel ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400")}>
                {showCorrect ? "✓" : showWrong ? "✗" : String.fromCharCode(65 + i)}
              </span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{opt.text}</span>
            </button>
          )
        })}
      </div>

      {step.hint && !submitted && (
        <button onClick={() => setShowHint(v => !v)} className="text-sm font-semibold text-indigo-500 hover:underline self-start">
          {showHint ? step.hint : "Need a hint?"}
        </button>
      )}

      {!submitted && (
        <button
          onClick={() => setSubmitted(true)}
          disabled={selected === null}
          className="self-start mt-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-display font-extrabold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_0_#312e81] hover:shadow-[0_2px_0_#312e81] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
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
