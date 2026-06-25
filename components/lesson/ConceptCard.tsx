"use client"
// components/lesson/ConceptCard.tsx — restyled board-explanation (Quest look).
// Logic unchanged. <Chessboard> usage is IDENTICAL to the app (untouched).
import { useState, useEffect } from "react"
import type { ConceptStep } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Chessboard } from "react-chessboard"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { annotationsToProps } from "./ChessBoard"
import { buildUserHighlightStyles, composeSquareStyles } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"

interface Props {
  step: ConceptStep
  onContinue: () => void
}

export function ConceptCard({ step, onContinue }: Props) {
  const boardOrientation = useLessonBoardOrientation("white")
  const stages = step.stages?.length ? step.stages : null
  const [stageIndex, setStageIndex] = useState(0)

  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)

  const activeStage = stages ? stages[stageIndex] : null
  const fen = activeStage?.fen ?? step.fen
  const annotations = activeStage?.annotations ?? step.annotations
  const body = activeStage?.body ?? step.body
  const isLastStage = !stages || stageIndex === stages.length - 1

  // A new stage shows a new position — drop any user-drawn markers.
  useEffect(() => {
    setUserHighlights([])
  }, [stageIndex])

  const { squareStyles, arrows } = annotationsToProps(annotations)

  function handleSquareClick() {
    setUserHighlights([])
  }

  const board = fen ? (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          allowDragging: false,
          squareStyles: composeSquareStyles(squareStyles, buildUserHighlightStyles(userHighlights)),
          arrows,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          onSquareClick: handleSquareClick,
          ...userHighlightHandlers,
        }}
      />
    </div>
  ) : undefined

  function handleAdvance() {
    if (stages && stageIndex < stages.length - 1) {
      setStageIndex(i => i + 1)
      return
    }
    onContinue()
  }

  const buttonLabel = activeStage?.buttonLabel
    ?? (isLastStage ? "Got it →" : "Next →")

  return (
    <LessonLayout
      board={board}
      footer={
        <Button onClick={handleAdvance} size="lg" className="w-full">
          {buttonLabel}
        </Button>
      }
    >
      <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">Concept</div>
      <h2 className="font-display text-[26px] font-extrabold leading-tight text-gray-900 dark:text-slate-100">{step.title}</h2>

      {stages && (
        <div className="flex items-center gap-1.5">
          {stages.map((_, i) => (
            <span
              key={i}
              className={clsx(
                "h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none",
                i === stageIndex ? "w-5 bg-indigo-500" : i < stageIndex ? "w-1.5 bg-indigo-300" : "w-1.5 bg-gray-200 dark:bg-slate-600"
              )}
            />
          ))}
        </div>
      )}

      <div className="text-gray-700 dark:text-slate-300 text-[15px] leading-relaxed">
        <MarkdownText paragraphs strongClassName="text-gray-900 dark:text-slate-100">{body}</MarkdownText>
      </div>

      {step.analogy && isLastStage && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 text-amber-900 dark:text-amber-300 text-sm">
          <span className="font-bold">Another way to think about it: </span>
          {step.analogy}
        </div>
      )}
    </LessonLayout>
  )
}
