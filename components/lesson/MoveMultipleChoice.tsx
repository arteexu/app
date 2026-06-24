"use client"
import { useState } from "react"
import { Chess } from "chess.js"
import type { MoveMultipleChoice as MoveMultipleChoiceType, MoveCandidate } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { Arrow } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { LessonLayout } from "./LessonLayout"
import { clsx } from "clsx"

interface Props {
  step: MoveMultipleChoiceType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

// Pre-compute from/to squares for each candidate so the board can animate on click
function getMoveSquares(fen: string, san: string): { from: string; to: string; fen: string } | null {
  try {
    const g = new Chess(fen)
    const r = g.move(san)
    if (!r) return null
    return { from: r.from, to: r.to, fen: g.fen() }
  } catch { return null }
}

export function MoveMultipleChoice({ step, onComplete, isLastStep }: Props) {
  // ── Phase 1: preview (switchable) ────────────────────────────────────────
  const [previewSan,    setPreviewSan]    = useState<string | null>(null)
  const [previewBoard,  setPreviewBoard]  = useState(step.fen)
  const [previewHL,     setPreviewHL]     = useState<Record<string, React.CSSProperties>>({})
  const [previewArrow,  setPreviewArrow]  = useState<Arrow[]>([])

  // ── Phase 2: submitted (locked) ───────────────────────────────────────────
  const [submitted,      setSubmitted]      = useState(false)
  const [submittedSan,   setSubmittedSan]   = useState<string | null>(null)
  const [submittedResult, setSubmittedResult] = useState<MoveCandidate | null>(null)
  const [revealed,       setRevealed]       = useState(false)
  const [solved,         setSolved]         = useState(false)

  // Preview a candidate — board updates but nothing is finalised yet
  function previewCandidate(candidate: MoveCandidate) {
    if (submitted && !solved) return   // locked while feedback is showing
    if (solved) return

    const move = getMoveSquares(step.fen, candidate.san)
    if (!move) return

    setPreviewSan(candidate.san)
    setPreviewBoard(move.fen)
    setPreviewHL({
      [move.from]: { backgroundColor: "rgba(245,158,11,0.4)"  },
      [move.to]:   { backgroundColor: "rgba(245,158,11,0.65)" },
    })
    setPreviewArrow([{ startSquare: move.from as any, endSquare: move.to as any, color: "#f59e0b" }])
  }

  // Lock in the currently previewed candidate
  function submit() {
    if (!previewSan) return
    const candidate = step.candidates.find(c => c.san === previewSan)
    if (!candidate) return

    setSubmitted(true)
    setSubmittedSan(previewSan)
    setSubmittedResult(candidate)
    setRevealed(false)

    if (candidate.isCorrect) {
      setSolved(true)
      // Auto-play black's response after a short pause
      if (candidate.continuation?.length) {
        setTimeout(() => {
          const g = new Chess(previewBoard)
          candidate.continuation!.forEach(m => { try { g.move(m) } catch {} })
          setPreviewBoard(g.fen())
          setPreviewHL({})
          setPreviewArrow([])
        }, 900)
      }
    }
  }

  // Reset to preview phase (after an incorrect guess)
  function retry() {
    setSubmitted(false)
    setSubmittedSan(null)
    setSubmittedResult(null)
    setRevealed(false)
    setPreviewSan(null)
    setPreviewBoard(step.fen)
    setPreviewHL({})
    setPreviewArrow([])
  }

  const board = (
    <Chessboard
      options={{
        position: previewBoard,
        boardOrientation: step.orientation ?? "white",
        allowDragging: false,
        squareStyles: previewHL,
        arrows: previewArrow,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        animationDurationInMs: 280,
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 leading-snug">{step.question}</p>

      {/* ── Candidate buttons ── */}
      <div className="flex flex-col gap-3">
        {step.candidates.map(c => {
          const isPreviewing = previewSan === c.san && !submitted
          const isSubmitted  = submittedSan === c.san && submitted

          return (
            <button
              key={c.san}
              onClick={() => previewCandidate(c)}
              disabled={(submitted && !solved) || solved}
              className={clsx(
                "text-left px-4 py-3 rounded-xl border-2 font-mono font-bold text-base transition-all duration-150 select-none",
                // Currently previewing this candidate (not yet submitted)
                isPreviewing && "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 shadow-md",
                // Submitted + correct
                isSubmitted && c.isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                // Submitted + incorrect
                isSubmitted && !c.isCorrect && "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400",
                // Solved: highlight the correct answer in green
                solved && c.isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                // Default: neither previewing nor submitted
                !isPreviewing && !isSubmitted && !(solved && c.isCorrect) && [
                  "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200",
                  !submitted && !solved && "hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 shadow-sm hover:-translate-y-px cursor-pointer",
                  (submitted || solved) && "opacity-40",
                ],
              )}
            >
              {c.san}
              {isSubmitted && (
                <span className={clsx("ml-2 text-sm font-sans font-semibold",
                  c.isCorrect ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                )}>
                  {c.isCorrect ? "✓" : "✗"}
                </span>
              )}
              {solved && c.isCorrect && submittedSan !== c.san && (
                <span className="ml-2 text-sm font-sans font-semibold text-green-600 dark:text-green-400">✓</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Submit button — appears once a candidate is previewed ── */}
      {previewSan && !submitted && !solved && (
        <button
          onClick={submit}
          className="self-start mt-1 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-all shadow-[0_4px_0_#312e81] hover:shadow-[0_2px_0_#312e81] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
        >
          Submit: {previewSan}
        </button>
      )}

      {/* ── Feedback (after submission) ── */}
      {submitted && submittedResult && !solved && (
        <div className={clsx(
          "rounded-xl border px-4 py-3.5 flex flex-col gap-3 text-sm",
          submittedResult.isCorrect
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-300"
        )}>
          <p className="font-semibold leading-snug">{submittedResult.shortFeedback}</p>

          {!submittedResult.isCorrect && submittedResult.explanation && !revealed && (
            <button
              onClick={() => setRevealed(true)}
              className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg border border-current opacity-70 hover:opacity-100 transition"
            >
              Reveal explanation
            </button>
          )}
          {revealed && submittedResult.explanation && (
            <p className="leading-relaxed opacity-90">{submittedResult.explanation}</p>
          )}

          <button
            onClick={retry}
            className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            ← Try another move
          </button>
        </div>
      )}

      {/* ── Solved ── */}
      {solved && (
        <div className="flex flex-col gap-3">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3.5">
            <p className="text-sm font-bold text-green-700 dark:text-green-400">
              {step.successMessage ?? "Well found!"}
            </p>
          </div>
          <Button onClick={() => onComplete(true)} variant="primary" size="lg">
            {isLastStep ? "Finish lesson →" : "Continue →"}
          </Button>
        </div>
      )}

      {/* ── Idle hint ── */}
      {!previewSan && !submitted && (
        <p className="text-sm text-gray-400 dark:text-slate-500">
          Click a candidate to preview it on the board. You can switch freely before submitting.
        </p>
      )}
      {previewSan && !submitted && (
        <p className="text-sm text-gray-400 dark:text-slate-500">
          Click another candidate to preview a different move, or submit your choice above.
        </p>
      )}
    </LessonLayout>
  )
}
