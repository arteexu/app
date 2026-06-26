"use client"
// components/lesson/MoveMultipleChoice.tsx — restyled (Quest look) + SolveReward.
// All puzzle LOGIC is unchanged. <Chessboard> usage is IDENTICAL to the app
// (untouched). Adds: a per-step solve timer (for the speed bonus), a `hadWrong`
// flag (for first-try / star rating), and the SolveReward celebration overlay.
import { useState } from "react"
import { Chess, type Square } from "chess.js"
import type { MoveMultipleChoice as MoveMultipleChoiceType, MoveCandidate } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { Arrow } from "react-chessboard"
import { LessonLayout } from "./LessonLayout"
import { SolveReward } from "./SolveReward"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { SanNotation } from "@/components/chess/SanNotation"
import { sideToMove } from "@/lib/engine/format"

interface Props {
  step: MoveMultipleChoiceType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

function getMoveSquares(fen: string, san: string): { from: string; to: string; fen: string } | null {
  try {
    const g = new Chess(fen)
    const r = g.move(san)
    if (!r) return null
    return { from: r.from, to: r.to, fen: g.fen() }
  } catch { return null }
}

export function MoveMultipleChoice({ step, onComplete, isLastStep }: Props) {
  const { play } = useLessonSounds()
  const boardOrientation = useLessonBoardOrientation(step.orientation ?? "white")
  const [previewSan,    setPreviewSan]    = useState<string | null>(null)
  const [previewBoard,  setPreviewBoard]  = useState(step.fen)
  const [previewHL,     setPreviewHL]     = useState<Record<string, React.CSSProperties>>({})
  const [previewArrow,  setPreviewArrow]  = useState<Arrow[]>([])

  const [submitted,       setSubmitted]       = useState(false)
  const [submittedSan,    setSubmittedSan]    = useState<string | null>(null)
  const [submittedResult, setSubmittedResult] = useState<MoveCandidate | null>(null)
  const [revealed,        setRevealed]        = useState(false)
  const [solved,          setSolved]          = useState(false)

  // Gamification: time + accuracy of this solve
  const [startTime] = useState(() => Date.now())
  const [hadWrong, setHadWrong] = useState(false)
  const [solveSeconds, setSolveSeconds] = useState(0)

  function previewCandidate(candidate: MoveCandidate) {
    if (solved) return
    if (submitted && !solved) {
      setSubmitted(false)
      setSubmittedSan(null)
      setSubmittedResult(null)
      setRevealed(false)
    }
    const move = getMoveSquares(step.fen, candidate.san)
    if (!move) return
    setPreviewSan(candidate.san)
    setPreviewBoard(move.fen)
    setPreviewHL({
      [move.from]: { backgroundColor: "rgba(245,158,11,0.4)"  },
      [move.to]:   { backgroundColor: "rgba(245,158,11,0.65)" },
    })
    setPreviewArrow([{ startSquare: move.from as Square, endSquare: move.to as Square, color: "#f59e0b" }])
  }

  function submit() {
    if (!previewSan) return
    const candidate = step.candidates.find(c => c.san === previewSan)
    if (!candidate) return
    setSubmitted(true)
    setSubmittedSan(previewSan)
    setSubmittedResult(candidate)
    setRevealed(false)

    if (candidate.isCorrect) {
      setSolveSeconds(Math.round((Date.now() - startTime) / 1000))
      setSolved(true)
      if (candidate.continuation?.length) {
        setTimeout(() => {
          const g = new Chess(previewBoard)
          candidate.continuation!.forEach(m => { try { g.move(m) } catch {} })
          setPreviewBoard(g.fen())
          setPreviewHL({})
          setPreviewArrow([])
        }, 900)
      }
    } else {
      setHadWrong(true)
      play("wrong")
    }
  }

  function retry() {
    setSubmitted(false); setSubmittedSan(null); setSubmittedResult(null); setRevealed(false)
    setPreviewSan(null); setPreviewBoard(step.fen); setPreviewHL({}); setPreviewArrow([])
  }

  const board = (
    <Chessboard
      options={{
        position: previewBoard,
        boardOrientation,
        allowDragging: false,
        squareStyles: previewHL,
        arrows: previewArrow,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        animationDurationInMs: 280,
      }}
    />
  )

  // Reward parameters derived from this solve
  const firstTry = !hadWrong
  const speedBonus = firstTry && solveSeconds > 0 && solveSeconds <= 20
  const stars = firstTry ? 3 : 2
  const xp = 40 + (firstTry ? 20 : 0) + (speedBonus ? 20 : 0)

  return (
    <LessonLayout board={board}>
      <div className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">Your move</div>
      <p className="font-display text-[22px] font-extrabold leading-snug text-gray-900 dark:text-slate-100">{step.question}</p>

      {/* ── Candidate cards ── */}
      <div className="flex flex-col gap-3">
        {step.candidates.map(c => {
          const isPreviewing = previewSan === c.san && !submitted
          const isSubmitted  = submittedSan === c.san && submitted
          return (
            <button
              key={c.san}
              onClick={() => previewCandidate(c)}
              disabled={solved || (submitted && submittedResult?.isCorrect)}
              className={clsx(
                "flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-150 select-none",
                isPreviewing && "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 shadow-[0_6px_16px_-8px_rgba(99,102,241,0.5)]",
                isSubmitted && c.isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30",
                isSubmitted && !c.isCorrect && "border-red-400 bg-red-50 dark:bg-red-900/20",
                solved && c.isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30",
                !isPreviewing && !isSubmitted && !(solved && c.isCorrect) && [
                  "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800",
                  !submitted && !solved && "hover:border-indigo-400 hover:-translate-y-px shadow-sm cursor-pointer",
                  (submitted || solved) && "opacity-40",
                ],
              )}
            >
              <span className={clsx("text-sm font-extrabold rounded-lg px-2.5 py-1.5 flex-shrink-0 inline-flex items-baseline",
                isSubmitted && !c.isCorrect ? "bg-white dark:bg-slate-900 text-red-600 border border-red-300"
                  : "bg-slate-900 dark:bg-slate-950 text-white")}>
                <SanNotation san={c.san} side={sideToMove(step.fen)} />
              </span>
              <span className={clsx("flex-1 text-sm leading-snug",
                (isSubmitted && !c.isCorrect) ? "text-red-700 dark:text-red-400" : "text-gray-600 dark:text-slate-300")}>
                {c.shortFeedback ? (isPreviewing || isSubmitted ? c.shortFeedback : c.shortFeedback) : ""}
              </span>
              {isSubmitted && (
                <span className={clsx("text-sm font-bold flex-shrink-0", c.isCorrect ? "text-green-600" : "text-red-500")}>
                  {c.isCorrect ? "✓" : "✗"}
                </span>
              )}
              {!isSubmitted && !submitted && !solved && <span className="text-slate-300 text-lg flex-shrink-0">›</span>}
            </button>
          )
        })}
      </div>

      {/* ── Submit ── */}
      {previewSan && !submitted && !solved && (
        <button
          onClick={submit}
          className="self-start mt-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-display font-extrabold text-sm transition-all shadow-[0_4px_0_#312e81] hover:shadow-[0_2px_0_#312e81] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
        >
          Submit: <SanNotation san={previewSan} side={sideToMove(step.fen)} className="inline-flex" />
        </button>
      )}

      {/* ── Wrong-move feedback (calm) ── */}
      {submitted && submittedResult && !solved && (
        <div className="rounded-2xl border-2 px-4 py-3.5 flex flex-col gap-3 text-sm bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-300">
          <p className="font-semibold leading-snug">{submittedResult.shortFeedback}</p>
          {!submittedResult.isCorrect && submittedResult.explanation && !revealed && (
            <button onClick={() => setRevealed(true)} className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg border border-current opacity-70 hover:opacity-100 transition">
              Reveal explanation
            </button>
          )}
          {revealed && submittedResult.explanation && (
            <p className="leading-relaxed opacity-90">
              <MarkdownText>{submittedResult.explanation}</MarkdownText>
            </p>
          )}
          <button onClick={retry} className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
            ← Try another move
          </button>
        </div>
      )}

      {/* ── Idle hints ── */}
      {!previewSan && !submitted && (
        <p className="text-sm text-gray-400 dark:text-slate-500">Click a candidate to preview it on the board. You can switch freely before submitting.</p>
      )}
      {previewSan && !submitted && (
        <p className="text-sm text-gray-400 dark:text-slate-500">Click another candidate to preview a different move, or submit your choice above.</p>
      )}

      {/* ── Solved → celebration takeover (overlays the relative panel) ── */}
      {solved && (
        <SolveReward
          run
          xp={xp}
          stars={stars}
          firstTry={firstTry}
          speedBonus={speedBonus}
          title={step.successMessage ? "Solved!" : "Checkmate!"}
          subtitle={step.successMessage ?? `${submittedSan} — well found.`}
          isLastStep={isLastStep}
          keyConceptId={step.keyConceptId}
          keyConceptIds={step.keyConceptIds}
          onContinue={() => onComplete(true)}
        />
      )}
    </LessonLayout>
  )
}
