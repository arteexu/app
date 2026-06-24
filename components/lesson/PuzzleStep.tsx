"use client"
import { useState, useEffect } from "react"
import { Chess } from "chess.js"
import type { PuzzleStep as PuzzleStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { Arrow, PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { FeedbackPanel } from "./FeedbackPanel"
import { LessonLayout } from "./LessonLayout"
import { annotationsToProps } from "./ChessBoard"
import { clsx } from "clsx"

interface Props {
  step: PuzzleStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

type PuzzleState = "idle" | "wrong" | "refuting" | "solved"

export function PuzzleStep({ step, onComplete, isLastStep }: Props) {
  // ── Puzzle-solve state ────────────────────────────────────────────────────
  const [game, setGame]                     = useState(() => new Chess(step.fen))
  const [moveHistory, setMoveHistory]       = useState<string[]>([])
  const [state, setState]                   = useState<PuzzleState>("idle")
  const [wrongMoveExplanation, setWrong]    = useState("")
  const [refutationLine, setRefutation]     = useState<string[]>([])
  const [refutationIndex, setRefIdx]        = useState(-1)
  const [selectedSquare, setSelectedSq]     = useState<string | null>(null)
  const [legalMoveSquares, setLegalHL]      = useState<Record<string, React.CSSProperties>>({})

  // ── Pre-blunder animation state ───────────────────────────────────────────
  const [showingPrev, setShowingPrev]   = useState(!!step.preMovePosition)
  const [blunderPlayed, setBlunderPlayed] = useState(!step.preMovePosition)

  // ── Analysis mode state ───────────────────────────────────────────────────
  const [analysisMode, setAnalysisMode]   = useState(false)
  const [analysisGame, setAnalysisGame]   = useState(() => new Chess(step.fen))
  const [analysisSq, setAnalysisSq]       = useState<string | null>(null)
  const [analysisHL, setAnalysisHL]       = useState<Record<string, React.CSSProperties>>({})

  // Auto-play blunder animation
  useEffect(() => {
    if (!step.preMovePosition) return
    const t1 = setTimeout(() => setShowingPrev(false), 1400)
    const t2 = setTimeout(() => setBlunderPlayed(true), 2100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arrow-key navigation for pre-move position
  useEffect(() => {
    if (!step.preMovePosition) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft"  && blunderPlayed && !showingPrev) { e.preventDefault(); setShowingPrev(true)  }
      if (e.key === "ArrowRight" && showingPrev)                   { e.preventDefault(); setShowingPrev(false) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [blunderPlayed, showingPrev, step.preMovePosition])

  const { squareStyles: annotationSquares, arrows: annotationArrows } = annotationsToProps(step.annotations)
  const learnerMoveIndex = moveHistory.length
  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"

  // ── Puzzle-solve helpers ──────────────────────────────────────────────────
  function resetPuzzle() {
    setGame(new Chess(step.fen))
    setMoveHistory([])
    setState("idle")
    setWrong("")
    setRefutation([])
    setRefIdx(-1)
    setSelectedSq(null)
    setLegalHL({})
  }

  function selectSquare(square: string) {
    const piece = game.get(square as any)
    if (!piece || piece.color !== learnerColor) { setSelectedSq(null); setLegalHL({}); return }
    setSelectedSq(square)
    const moves = game.moves({ square: square as any, verbose: true })
    const hl: Record<string, React.CSSProperties> = { [square]: { backgroundColor: "rgba(99,102,241,0.4)" } }
    moves.forEach(m => { hl[m.to] = { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: "50%" } })
    setLegalHL(hl)
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to) return false
    let result
    try { result = game.move({ from: from as any, to: to as any, promotion: "q" }) } catch { return false }
    if (!result) return false

    const san = result.san
    const expectedSan = step.solution.moves[learnerMoveIndex]
    setSelectedSq(null); setLegalHL({})

    if (!expectedSan || !movesMatch(san, expectedSan)) {
      game.undo()
      const explanations = step.solution.wrongMoveExplanations?.[learnerMoveIndex] ?? {}
      setState("wrong")
      setWrong(explanations[san] ?? "That's not the right move. Think: checks, captures, threats.")
      setRefutation(step.solution.refutationLines?.[learnerMoveIndex]?.[san] ?? [])
      return true
    }

    const newHistory = [...moveHistory, san]
    setMoveHistory(newHistory)
    setGame(new Chess(game.fen()))
    if (newHistory.length === step.solution.moves.length) { setState("solved"); return true }

    setTimeout(() => {
      const botMove = step.solution.moves[newHistory.length]
      if (!botMove) return
      try { game.move(botMove) } catch { return }
      setGame(new Chess(game.fen()))
      setMoveHistory(h => [...h, botMove])
    }, 400)
    return true
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (state !== "idle" || !targetSquare) return false
    return attemptMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (state !== "idle") return
    if (selectedSquare) {
      if (square === selectedSquare) { setSelectedSq(null); setLegalHL({}); return }
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  // ── Analysis-mode helpers ─────────────────────────────────────────────────
  function enterAnalysis() {
    // Start analysis from the current puzzle position
    setAnalysisGame(new Chess(game.fen()))
    setAnalysisSq(null)
    setAnalysisHL({})
    setAnalysisMode(true)
  }

  function exitAnalysis() {
    setAnalysisMode(false)
    setAnalysisSq(null)
    setAnalysisHL({})
  }

  function resetAnalysis() {
    setAnalysisGame(new Chess(step.fen))
    setAnalysisSq(null)
    setAnalysisHL({})
  }

  function analysisSelectSquare(square: string) {
    const piece = analysisGame.get(square as any)
    if (!piece) { setAnalysisSq(null); setAnalysisHL({}); return }
    setAnalysisSq(square)
    const moves = analysisGame.moves({ square: square as any, verbose: true })
    const hl: Record<string, React.CSSProperties> = { [square]: { backgroundColor: "rgba(99,102,241,0.4)" } }
    moves.forEach(m => { hl[m.to] = { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: "50%" } })
    setAnalysisHL(hl)
  }

  function analysisMakeMove(from: string, to: string): boolean {
    if (from === to) return false
    try {
      const copy = new Chess(analysisGame.fen())
      const r = copy.move({ from: from as any, to: to as any, promotion: "q" })
      if (!r) return false
      setAnalysisGame(new Chess(copy.fen()))
      setAnalysisSq(null); setAnalysisHL({})
      return true
    } catch { return false }
  }

  function handleAnalysisDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    return analysisMakeMove(sourceSquare, targetSquare)
  }

  function handleAnalysisClick({ square }: SquareHandlerArgs) {
    if (analysisSq) {
      if (square === analysisSq) { setAnalysisSq(null); setAnalysisHL({}); return }
      if (!analysisMakeMove(analysisSq, square)) analysisSelectSquare(square)
      return
    }
    analysisSelectSquare(square)
  }

  // ── Board rendering ───────────────────────────────────────────────────────
  const displayFen = (() => {
    if (analysisMode) return analysisGame.fen()
    if (showingPrev && step.preMovePosition) return step.preMovePosition.fen
    if (state === "refuting" && refutationLine.length > 0) {
      const g = new Chess(game.fen())
      for (let i = 0; i <= refutationIndex; i++) { try { g.move(refutationLine[i]) } catch {} }
      return g.fen()
    }
    return game.fen()
  })()

  const activeSquareStyles: Record<string, React.CSSProperties> = (() => {
    if (analysisMode) return analysisHL
    if (showingPrev && step.preMovePosition?.highlightSquares) {
      const sq: Record<string, React.CSSProperties> = {}
      for (const [s, color] of Object.entries(step.preMovePosition.highlightSquares))
        sq[s] = { backgroundColor: color }
      return sq
    }
    return state === "idle" ? { ...annotationSquares, ...legalMoveSquares } : {}
  })()

  const activeArrows: Arrow[] = (() => {
    if (analysisMode) return []
    if (showingPrev && step.preMovePosition?.arrows)
      return step.preMovePosition.arrows.map(a => ({ startSquare: a.from as any, endSquare: a.to as any, color: a.color ?? "#ef4444" }))
    return (state === "idle" && moveHistory.length === 0) ? annotationArrows : []
  })()

  const solveInteractive = state === "idle" && !showingPrev && blunderPlayed && !analysisMode
  const showModeToggle   = blunderPlayed && !showingPrev && state !== "solved"

  const board = (
    <Chessboard
      options={{
        position: displayFen,
        boardOrientation: step.orientation ?? "white",
        allowDragging: analysisMode || solveInteractive,
        squareStyles: activeSquareStyles,
        arrows: activeArrows,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        animationDurationInMs: !blunderPlayed ? 650 : 200,
        onPieceDrop: analysisMode ? handleAnalysisDrop : (solveInteractive ? handleDrop : undefined),
        onSquareClick: analysisMode ? handleAnalysisClick : (solveInteractive ? handleSquareClick : undefined),
      }}
    />
  )

  // ── Right panel ───────────────────────────────────────────────────────────
  return (
    <LessonLayout board={board}>

      {/* ── Mode toggle ── */}
      {showModeToggle && (
        <div className="flex items-center gap-1 self-start bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={exitAnalysis}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              !analysisMode
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            )}
          >
            ✓ Solve
          </button>
          <button
            onClick={enterAnalysis}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              analysisMode
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            )}
          >
            🔍 Analyse
          </button>
        </div>
      )}

      {/* ── Analysis mode UI ── */}
      {analysisMode && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
              Analysis mode — move any piece freely
            </p>
            <button
              onClick={resetAnalysis}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 font-medium transition"
            >
              ↺ Reset board
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            Explore freely — both sides can move. When you're ready, switch back to <strong>Solve</strong> to submit your answer.
          </p>
        </div>
      )}

      {/* ── Pre-blunder toggle (only in solve mode) ── */}
      {!analysisMode && step.preMovePosition && (
        <div className="flex flex-col gap-2">
          {!blunderPlayed ? (
            <div className="flex items-center gap-2 self-start text-sm font-medium px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Black plays {step.preMovePosition.san}…
            </div>
          ) : (
            <button
              onClick={() => setShowingPrev(p => !p)}
              className={clsx(
                "flex items-center gap-2 self-start text-sm font-medium px-3.5 py-2 rounded-xl border transition-all",
                showingPrev
                  ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
              )}
            >
              {showingPrev ? "→ Return to puzzle" : `← Black played ${step.preMovePosition.san}`}
              <span className="text-xs opacity-50 font-normal ml-1">{showingPrev ? "(→)" : "(←)"}</span>
            </button>
          )}
          {showingPrev && step.preMovePosition.annotation && (
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed px-1">
              {step.preMovePosition.annotation}
            </p>
          )}
        </div>
      )}

      {/* ── Puzzle question + solve UI (hidden in analysis) ── */}
      {!analysisMode && (
        <>
          <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 leading-snug">{step.question}</p>

          {/* Move history */}
          {moveHistory.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {moveHistory.map((m, i) => (
                <span key={i} className={clsx(
                  "text-xs rounded-lg px-2 py-1 font-mono",
                  i % 2 === 0 ? "bg-gray-800 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                )}>
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{m}
                </span>
              ))}
            </div>
          )}

          {state === "idle" && moveHistory.length === 0 && blunderPlayed && !showingPrev && (
            <p className="text-sm text-gray-400 dark:text-slate-500">Make your move on the board.</p>
          )}

          {/* Wrong move */}
          {state === "wrong" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-400">✗ Not the best move.</div>
              <p className="text-sm text-red-900 dark:text-red-300 leading-relaxed">{wrongMoveExplanation}</p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={resetPuzzle} variant="primary" size="sm">Try again</Button>
                {refutationLine.length > 0 && (
                  <Button onClick={() => { setState("refuting"); setRefIdx(0) }} variant="secondary" size="sm">
                    Show why it fails
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Refutation */}
          {state === "refuting" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Here's why that move fails:</p>
              <div className="flex flex-wrap gap-1.5">
                {refutationLine.map((m, i) => (
                  <button key={i} onClick={() => setRefIdx(i)} className={clsx(
                    "text-xs rounded-lg px-2 py-1 font-mono transition",
                    i === refutationIndex ? "bg-amber-600 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200"
                  )}>
                    {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{m}
                  </button>
                ))}
              </div>
              <Button onClick={resetPuzzle} variant="primary" size="sm" className="self-start">
                Got it — try again
              </Button>
            </div>
          )}

          {/* Solved */}
          {state === "solved" && (
            <>
              {step.successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-green-800 dark:text-green-300 text-sm font-medium">
                  🏆 {step.successMessage}
                </div>
              )}
              <FeedbackPanel
                isCorrect={true}
                explanation={step.explanation}
                onNext={() => onComplete(true)}
                isLastStep={isLastStep}
              />
            </>
          )}
        </>
      )}
    </LessonLayout>
  )
}

function movesMatch(a: string, b: string): boolean {
  return a.replace(/[+#]/g, "") === b.replace(/[+#]/g, "")
}
