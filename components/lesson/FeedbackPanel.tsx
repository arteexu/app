"use client"
import { Button } from "@/components/ui/button"
import { clsx } from "clsx"

interface Props {
  isCorrect: boolean
  explanation: string
  onNext: () => void
  isLastStep?: boolean
  nextLabel?: string
}

export function FeedbackPanel({ isCorrect, explanation, onNext, isLastStep, nextLabel }: Props) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-5 py-4 mt-4 flex flex-col gap-3 transition-all",
        isCorrect ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"
      )}
    >
      <div className="flex items-center gap-2 font-semibold text-base">
        {isCorrect
          ? <><span className="text-green-600 text-lg">✓</span> Correct!</>
          : <><span className="text-red-600 text-lg">✗</span> Not quite.</>}
      </div>
      <p className="text-sm leading-relaxed">{explanation}</p>
      <Button onClick={onNext} variant={isCorrect ? "primary" : "secondary"} size="md" className="self-start">
        {nextLabel ?? (isLastStep ? "Finish lesson →" : "Next →")}
      </Button>
    </div>
  )
}
