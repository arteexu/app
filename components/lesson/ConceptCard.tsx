"use client"
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
      <h2 className="text-2xl font-bold text-gray-900">{step.title}</h2>

      <div className="text-gray-700 text-base leading-relaxed">
        {renderBody(step.body)}
      </div>

      {step.analogy && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-900 text-sm">
          <span className="font-semibold">Another way to think about it: </span>
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
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}
