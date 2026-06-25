"use client"
// components/annotated/ConceptCheckCard.tsx
// A data-driven multiple-choice concept check attached to a specific ply of an
// annotated game. Mirrors the MultipleChoiceStep look/feedback. The learner
// must submit an answer before the player will let them advance — answering
// (not necessarily correctly) unlocks the next move via onAnswered().

import { useState } from "react"
import { clsx } from "clsx"
import type { ConceptCheck } from "@/lib/annotated/types"
import { useLessonSounds } from "@/hooks/useLessonSounds"

interface Props {
  check: ConceptCheck
  /** Persisted in the parent so a check stays answered when stepping back to it.
   *  The parent remounts this card per check (key=check.id), so reading this
   *  prop as the initial state is sufficient — no reset effect needed. */
  answeredIndex: number | null
  onAnswered: (selectedIndex: number, isCorrect: boolean) => void
}

export function ConceptCheckCard({ check, answeredIndex, onAnswered }: Props) {
  const [selected, setSelected] = useState<number | null>(answeredIndex)
  const [submitted, setSubmitted] = useState(answeredIndex !== null)
  const [showHint, setShowHint] = useState(false)
  const { play } = useLessonSounds()

  const isCorrect = selected === check.correctIndex

  function submit() {
    if (selected === null) return
    setSubmitted(true)
    play(selected === check.correctIndex ? "correct" : "wrong")
    onAnswered(selected, selected === check.correctIndex)
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">
          Concept check
        </span>
        {submitted && (
          <span
            className={clsx(
              "text-[11px] font-bold px-2 py-0.5 rounded-full",
              isCorrect
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            )}
          >
            {isCorrect ? "Correct" : "Answered"}
          </span>
        )}
      </div>

      <p className="font-display text-lg font-extrabold leading-snug text-gray-900 dark:text-slate-100">
        {check.prompt}
      </p>

      <div className="flex flex-col gap-2">
        {check.options.map((opt, i) => {
          const showCorrect = submitted && i === check.correctIndex
          const showWrong = submitted && i === selected && !isCorrect
          const sel = selected === i
          return (
            <button
              key={i}
              onClick={() => { if (!submitted) setSelected(i) }}
              disabled={submitted}
              aria-pressed={sel}
              className={clsx(
                "flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border-2 text-sm transition-all",
                submitted ? "cursor-default" : "cursor-pointer",
                showCorrect
                  ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                  : showWrong
                    ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                    : sel
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                      : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
              )}
            >
              <span
                className={clsx(
                  "w-6 h-6 rounded-lg grid place-items-center text-[12px] font-extrabold flex-shrink-0",
                  showCorrect
                    ? "bg-green-600 text-white"
                    : showWrong
                      ? "bg-red-600 text-white"
                      : sel
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400"
                )}
              >
                {showCorrect ? "✓" : showWrong ? "✗" : String.fromCharCode(65 + i)}
              </span>
              <span className="font-medium text-gray-900 dark:text-slate-100">{opt.text}</span>
            </button>
          )
        })}
      </div>

      {check.hint && !submitted && (
        <button
          onClick={() => setShowHint((v) => !v)}
          className="text-sm font-semibold text-indigo-500 hover:underline self-start"
        >
          {showHint ? check.hint : "Need a hint?"}
        </button>
      )}

      {!submitted && (
        <button
          onClick={submit}
          disabled={selected === null}
          className="self-start mt-1 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-display font-extrabold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_0_#312e81] hover:shadow-[0_2px_0_#312e81] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
        >
          Check answer
        </button>
      )}

      {submitted && selected !== null && (
        <div
          className={clsx(
            "rounded-xl border px-4 py-3 text-sm leading-relaxed",
            isCorrect
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900/90 dark:text-green-200/90"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900/90 dark:text-red-200/90"
          )}
        >
          <span className={clsx("font-display font-extrabold block mb-1", isCorrect ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {isCorrect ? "✓ Correct!" : "Not quite —"}
          </span>
          {check.options[selected].explanation}
        </div>
      )}
    </div>
  )
}
