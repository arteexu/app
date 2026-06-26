"use client"
// components/lesson/FeedbackPanel.tsx — restyled (Quest look). Same props/behavior.
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { KeyConceptUnlockCard } from "@/components/key-concepts/KeyConceptUnlockCard"
import { TacticalPatternUnlockCard } from "@/components/tactical-patterns/TacticalPatternUnlockCard"
import { unlockKeyConcept } from "@/lib/key-concepts-storage"
import { unlockTacticalPattern } from "@/lib/tactical-patterns-storage"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { COMMENTARY_FEATURE_ENABLED } from "@/lib/commentary/config"
import { generateCoachComment, type CoachContext } from "@/lib/commentary/client"
import type { CommentaryResponse } from "@/lib/commentary/types"

interface Props {
  isCorrect: boolean
  explanation: string
  onNext: () => void
  isLastStep?: boolean
  nextLabel?: string
  /** Override default correct/wrong chime; "celebration" = step-complete fanfare. */
  sound?: "correct" | "wrong" | "celebration" | "none"
  /** When set on a correct solve, persist unlock and show the key concept card. */
  keyConceptId?: string
  keyConceptIds?: string[]
  /** When set on a correct solve, persist unlock and show the tactical pattern card. */
  tacticalPatternId?: string
  tacticalPatternIds?: string[]
  /**
   * Optional position+move context enabling the AI "Coach's take" section.
   * When provided (and the feature flag is on), a button lets the learner fetch
   * a grounded explanation. Supplementary — never replaces `explanation`.
   */
  coachContext?: CoachContext
}

export function FeedbackPanel({
  isCorrect,
  explanation,
  onNext,
  isLastStep,
  nextLabel,
  sound,
  keyConceptId,
  keyConceptIds,
  tacticalPatternId,
  tacticalPatternIds,
  coachContext,
}: Props) {
  const conceptIds = [...new Set([...(keyConceptIds ?? []), ...(keyConceptId ? [keyConceptId] : [])])]
  const patternIds = [...new Set([...(tacticalPatternIds ?? []), ...(tacticalPatternId ? [tacticalPatternId] : [])])]
  const [conceptUnlocks] = useState(() =>
    isCorrect ? conceptIds.map((id) => ({ id, celebrate: unlockKeyConcept(id) })) : [],
  )
  const [patternUnlocks] = useState(() =>
    isCorrect ? patternIds.map((id) => ({ id, celebrate: unlockTacticalPattern(id) })) : [],
  )
  const { play } = useLessonSounds()

  useEffect(() => {
    if (sound === "none") return
    if (sound === "celebration") { play("stepComplete"); return }
    play(sound ?? (isCorrect ? "correct" : "wrong"))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- play once when panel appears
  }, [])

  return (
    <div className="flex flex-col gap-3 mt-2">
      {conceptUnlocks.map(({ id, celebrate }) => (
        <KeyConceptUnlockCard key={id} conceptId={id} celebrate={celebrate} />
      ))}
      {patternUnlocks.map(({ id, celebrate }) => (
        <TacticalPatternUnlockCard key={id} patternId={id} celebrate={celebrate} />
      ))}
      <div
        className={clsx(
          "rounded-2xl border-2 px-5 py-4 flex flex-col gap-3 transition-all",
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
          <MarkdownText>{explanation}</MarkdownText>
        </p>
        {COMMENTARY_FEATURE_ENABLED && coachContext && <CoachsTake context={coachContext} />}
        <Button
          onClick={() => {
            play("stepAdvance")
            onNext()
          }}
          variant={isCorrect ? "primary" : "secondary"}
          size="md"
          className="self-start"
        >
          {nextLabel ?? (isLastStep ? "Finish lesson →" : "Next →")}
        </Button>
      </div>
    </div>
  )
}

/**
 * Collapsible AI "Coach's take". Explicit button (cost control): nothing is
 * fetched until the learner asks. Runs a shallow engine analysis in the browser,
 * builds a grounded ConceptRecord, and calls /api/commentary (which falls back
 * to a deterministic template when there's no API key or on guardrail failure).
 */
function CoachsTake({ context }: { context: CoachContext }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CommentaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    setLoading(true)
    setError(null)
    try {
      const { response } = await generateCoachComment(context)
      setResult(response)
    } catch {
      setError("Couldn't analyze this position. Try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!result) {
    return (
      <button
        onClick={ask}
        disabled={loading}
        className={clsx(
          "self-start inline-flex items-center gap-2 text-sm font-bold px-3.5 py-2 rounded-xl border-2 transition-all",
          "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30",
          "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50",
          "disabled:opacity-60 disabled:cursor-wait",
        )}
      >
        {loading ? (
          <>
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            Coach is thinking…
          </>
        ) : (
          <>🧠 Ask the coach</>
        )}
        {error && <span className="text-red-600 dark:text-red-400 font-medium ml-1">{error}</span>}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          🧠 Coach&apos;s take
        </span>
        {result.source === "template" && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-500 dark:text-indigo-300">
            offline
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-indigo-900/90 dark:text-indigo-100/90">
        {result.comment}
      </p>
    </div>
  )
}
