"use client"
// components/lesson/FeedbackPanel.tsx — restyled (Quest look). Same props/behavior.
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { clsx } from "clsx"

interface Props {
  isCorrect: boolean
  explanation: string
  onNext: () => void
  isLastStep?: boolean
  nextLabel?: string
  /** Override default correct/wrong chime; "celebration" = step-complete fanfare. */
  sound?: "correct" | "wrong" | "celebration" | "none"
}

export function FeedbackPanel({ isCorrect, explanation, onNext, isLastStep, nextLabel, sound }: Props) {
  const { play } = useLessonSounds()

  useEffect(() => {
    if (sound === "none") return
    if (sound === "celebration") { play("stepComplete"); return }
    play(sound ?? (isCorrect ? "correct" : "wrong"))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- play once when panel appears
  }, [])

  return (
    <div
      className={clsx(
        "rounded-2xl border-2 px-5 py-4 mt-2 flex flex-col gap-3 transition-all",
        isCorrect
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      )}
    >
      <div className={clsx("flex items-center gap-2 font-display font-extrabold text-lg",
        isCorrect ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
        {isCorrect ? "✓ Correct!" : "✗ Not quite."}
      </div>
      <p className={clsx("text-sm leading-relaxed", isCorrect ? "text-green-900/90 dark:text-green-200/90" : "text-red-900/90 dark:text-red-200/90")}>
        {explanation}
      </p>
      <Button onClick={onNext} variant={isCorrect ? "primary" : "secondary"} size="md" className="self-start">
        {nextLabel ?? (isLastStep ? "Finish lesson →" : "Next →")}
      </Button>
    </div>
  )
}
