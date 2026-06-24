"use client"
// components/lesson/ConceptCard.tsx — restyled board-explanation (Quest look).
// Logic unchanged. <Chessboard> usage is IDENTICAL to the app (untouched).
import type { ConceptStep } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Chessboard } from "react-chessboard"
import { LessonLayout } from "./LessonLayout"
import { annotationsToProps } from "./ChessBoard"

interface Props {
  step: ConceptStep
  onContinue: () => void
}

export function ConceptCard({ step, onContinue }: Props) {
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
      <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">Concept</div>
      <h2 className="font-display text-[26px] font-extrabold leading-tight text-gray-900 dark:text-slate-100">{step.title}</h2>

      <div className="text-gray-700 dark:text-slate-300 text-[15px] leading-relaxed">
        {renderBody(step.body)}
      </div>

      {step.analogy && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-amber-900 dark:text-amber-300 text-sm">
          <span className="font-bold">Another way to think about it: </span>
          {step.analogy}
        </div>
      )}

      <Button onClick={onContinue} size="lg" className="mt-auto">
        Got it →
      </Button>
    </LessonLayout>
  )
}

function renderBody(body: string) {
  const paragraphs = body.split("\n\n")
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((para, pi) => {
        const parts = para.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={pi}>
            {parts.map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i} className="text-gray-900 dark:text-slate-100">{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}
