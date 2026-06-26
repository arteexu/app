"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Chess } from "chess.js"
import type { PuzzleStep as PuzzleStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { Arrow, PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { FeedbackPanel } from "./FeedbackPanel"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { isBoardSoundEnabled, playBoardMoveSound } from "@/lib/ui-sounds"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { usePieceLatchRef } from "@/hooks/usePieceLatchRef"
import { buildLastMoveStyles, buildSelectionStyles, buildUserHighlightStyles, composeSquareStyles, DRAG_ACTIVATION_DISTANCE } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { annotationsToProps } from "./ChessBoard"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { MoveQualityMoveLabel } from "./MoveQualityMoveLabel"
import { SanNotation } from "@/components/chess/SanNotation"
import { sideToMove } from "@/lib/engine/format"
import { useMoveQualityPieceBadge } from "@/hooks/useMoveQualityPieceBadge"
import { TacticalPatternUnlockCard } from "@/components/tactical-patterns/TacticalPatternUnlockCard"
import { unlockTacticalPattern } from "@/lib/tactical-patterns-storage"

interface Props {
  step: PuzzleStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

type PuzzleState = "idle" | "wrong" | "alternative" | "refuting" | "solved"

type AnalysisMove = { san: string; from: string; to: string }

function buildAnalysisPosition(startFen: string, moves: AnalysisMove[], index: number): Chess {
  const g = new Chess(startFen)
  for (let i = 0; i <= index; i++) {
    try {
      g.move({ from: moves[i].from as any, to: moves[i].to as any, promotion: "q" })
    } catch { break }
  }
  return g
}

export function PuzzleStep({ step, onComplete, isLastStep }: Props) {
  const { play } = useLessonSounds()
  const boardOrientation = useLessonBoardOrientation(step.orientation ?? "white")
  // ── Puzzle-solve state ────────────────────────────────────────────────────
  const [game, setGame]                     = useState(() => new Chess(step.fen))
  const [moveHistory, setMoveHistory]       = useState<string[]>([])
  const [state, setState]                   = useState<PuzzleState>("idle")
  const [wrongMoveExplanation, setWrong]    = useState("")
  const [alternativeFeedback, setAltFeedback] = useState("")
  const [refutationLine, setRefutation]     = useState<string[]>([])
  const [refutationIndex, setRefIdx]        = useState(-1)
  const [lastMove, setLastMove]             = useState<{ from: string; to: string } | null>(null)
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const [midPatternUnlock, setMidPatternUnlock] = useState<{ id: string; celebrate: boolean } | null>(null)

  const { showLegalMoves } = useBoardPreferences()

  // ── Pre-blunder animation state ───────────────────────────────────────────
  const [showingPrev, setShowingPrev]   = useState(!!step.preMovePosition)
  const [blunderPlayed, setBlunderPlayed] = useState(!step.preMovePosition)

  // ── Analysis mode state ───────────────────────────────────────────────────
  const [analysisMode, setAnalysisMode]       = useState(false)
  const [analysisStartFen, setAnalysisStartFen] = useState(step.fen)
  const [analysisMoves, setAnalysisMoves]     = useState<AnalysisMove[]>([])
  const [analysisIndex, setAnalysisIndex]     = useState(-1)

  const analysisGame = useMemo(
    () => buildAnalysisPosition(analysisStartFen, analysisMoves, analysisIndex),
    [analysisStartFen, analysisMoves, analysisIndex],
  )
  const analysisLastMove = analysisIndex >= 0
    ? { from: analysisMoves[analysisIndex].from, to: analysisMoves[analysisIndex].to }
    : null

  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"
  const canAttemptSolve =
    (state === "idle" || state === "wrong" || state === "alternative") &&
    !showingPrev &&
    blunderPlayed &&
    !analysisMode
  const solveInteractive = state === "idle" && !showingPrev && blunderPlayed && !analysisMode
  const userHighlightHandlers = useUserSquareHighlightHandlers(
    setUserHighlights,
    analysisMode || solveInteractive,
  )
  const {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag: onPuzzlePieceDrag,
    onDragEnd: onPuzzleDragEnd,
  } = useLegalMoveHighlights({
    game,
    enabled: showLegalMoves && canAttemptSolve,
    isSelectable: (_square, piece) => !!piece && piece.color === learnerColor,
  })
  const {
    selectedSquare: analysisSq,
    latchAnimSquare: analysisLatchAnimSquare,
    legalMoveSquares: analysisHL,
    selectSquare: analysisSelectSquare,
    clearHighlights: clearAnalysisHighlights,
    onPieceDrag: onAnalysisPieceDrag,
    onDragEnd: onAnalysisDragEnd,
  } = useLegalMoveHighlights({
    game: analysisGame,
    enabled: showLegalMoves && analysisMode,
    isSelectable: (_square, piece) => !!piece,
  })

  const boardRef = usePieceLatchRef(analysisMode ? analysisLatchAnimSquare : latchAnimSquare)

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
      if (analysisMode) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft"  && blunderPlayed && !showingPrev) { e.preventDefault(); setShowingPrev(true)  }
      if (e.key === "ArrowRight" && showingPrev)                   { e.preventDefault(); setShowingPrev(false) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [analysisMode, blunderPlayed, showingPrev, step.preMovePosition])

  const analysisGoBack = useCallback(() => {
    setAnalysisIndex(i => Math.max(-1, i - 1))
    clearAnalysisHighlights()
    setUserHighlights([])
  }, [clearAnalysisHighlights])

  const analysisGoForward = useCallback(() => {
    setAnalysisIndex(i => Math.min(analysisMoves.length - 1, i + 1))
    clearAnalysisHighlights()
    setUserHighlights([])
  }, [analysisMoves.length, clearAnalysisHighlights])

  const analysisJumpTo = useCallback((index: number) => {
    setAnalysisIndex(index)
    clearAnalysisHighlights()
    setUserHighlights([])
  }, [clearAnalysisHighlights])

  // Arrow-key navigation for analysis mode
  useEffect(() => {
    if (!analysisMode) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        analysisGoBack()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        analysisGoForward()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [analysisMode, analysisGoBack, analysisGoForward])

  const { squareStyles: annotationSquares, arrows: annotationArrows } = annotationsToProps(step.annotations)
  const learnerMoveIndex = moveHistory.length

  useEffect(() => {
    if (state === "wrong" && !isBoardSoundEnabled()) play("wrong")
  }, [state, play])

  // ── Puzzle-solve helpers ──────────────────────────────────────────────────
  function dismissRetryState() {
    if (state !== "wrong" && state !== "alternative") return
    setState("idle")
    setWrong("")
    setAltFeedback("")
    clearHighlights()
  }

  function resetPuzzle() {
    setGame(new Chess(step.fen))
    setMoveHistory([])
    setState("idle")
    setWrong("")
    setAltFeedback("")
    setRefutation([])
    setRefIdx(-1)
    setLastMove(null)
    setUserHighlights([])
    clearHighlights()
    setMidPatternUnlock(null)
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to) return false
    let result
    try { result = game.move({ from: from as any, to: to as any, promotion: "q" }) } catch { return false }
    if (!result) return false

    const san = result.san
    const expectedSan = step.solution.moves[learnerMoveIndex]
    clearHighlights()

    if (!expectedSan || !movesMatch(san, expectedSan)) {
      // Recognized-but-not-accepted alternative: a genuinely good move that
      // isn't the intended solution. Encourage the learner to keep looking.
      const alternatives = step.solution.alternatives?.[learnerMoveIndex] ?? {}
      const altKey = Object.keys(alternatives).find(k => movesMatch(san, k))
      if (altKey) {
        playBoardMoveSound(result, game)
        game.undo()
        clearHighlights()
        setState("alternative")
        setAltFeedback(alternatives[altKey])
        return true
      }
      playBoardMoveSound(result, game)
      game.undo()
      const explanations = step.solution.wrongMoveExplanations?.[learnerMoveIndex] ?? {}
      setState("wrong")
      setWrong(explanations[san] ?? "")
      setRefutation(step.solution.refutationLines?.[learnerMoveIndex]?.[san] ?? [])
      return true
    }

    playBoardMoveSound(result, game)
    setLastMove({ from: result.from, to: result.to })

    const midUnlockPatternId =
      step.tacticalPatternUnlocks?.[learnerMoveIndex] ??
      (step.tacticalPatternId &&
      step.tacticalPatternUnlockMoveIndex === learnerMoveIndex
        ? step.tacticalPatternId
        : undefined)
    if (midUnlockPatternId) {
      setMidPatternUnlock({
        id: midUnlockPatternId,
        celebrate: unlockTacticalPattern(midUnlockPatternId),
      })
    }

    const newHistory = [...moveHistory, san]
    setMoveHistory(newHistory)
    setGame(new Chess(game.fen()))
    if (newHistory.length === step.solution.moves.length) { setState("solved"); return true }

    if (!isBoardSoundEnabled()) play("correctMove")

    setTimeout(() => {
      const botMove = step.solution.moves[newHistory.length]
      if (!botMove) return
      let botResult
      try { botResult = game.move(botMove) } catch { return }
      if (botResult) {
        playBoardMoveSound(botResult, game)
        setLastMove({ from: botResult.from, to: botResult.to })
      }
      setGame(new Chess(game.fen()))
      setMoveHistory(h => {
        const updated = [...h, botMove]
        if (updated.length === step.solution.moves.length) setState("solved")
        return updated
      })
    }, step.responseDelayMs?.[newHistory.length - 1] ?? 400)
    return true
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!canAttemptSolve || !targetSquare) return false
    if (state === "wrong" || state === "alternative") dismissRetryState()
    const moved = attemptMove(sourceSquare, targetSquare)
    onPuzzleDragEnd()
    return moved
  }

  function handlePuzzlePieceDrag(args: PieceHandlerArgs) {
    if (state === "wrong" || state === "alternative") dismissRetryState()
    setUserHighlights([])
    onPuzzlePieceDrag(args)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!canAttemptSolve) return
    if (state === "wrong" || state === "alternative") dismissRetryState()
    setUserHighlights([])
    if (selectedSquare) {
      if (square === selectedSquare) { clearHighlights(); return }
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  // ── Analysis-mode helpers ─────────────────────────────────────────────────
  function enterAnalysis() {
    setAnalysisStartFen(game.fen())
    setAnalysisMoves([])
    setAnalysisIndex(-1)
    setUserHighlights([])
    clearAnalysisHighlights()
    setAnalysisMode(true)
  }

  function exitAnalysis() {
    setAnalysisMode(false)
    setAnalysisMoves([])
    setAnalysisIndex(-1)
    setUserHighlights([])
    clearAnalysisHighlights()
  }

  function resetAnalysis() {
    setAnalysisStartFen(step.fen)
    setAnalysisMoves([])
    setAnalysisIndex(-1)
    setUserHighlights([])
    clearAnalysisHighlights()
  }

  function analysisMakeMove(from: string, to: string): boolean {
    if (from === to) return false
    try {
      const copy = buildAnalysisPosition(analysisStartFen, analysisMoves, analysisIndex)
      const r = copy.move({ from: from as any, to: to as any, promotion: "q" })
      if (!r) return false
      playBoardMoveSound(r, copy)
      const newMove: AnalysisMove = { san: r.san, from: r.from, to: r.to }
      const newMoves = [...analysisMoves.slice(0, analysisIndex + 1), newMove]
      setAnalysisMoves(newMoves)
      setAnalysisIndex(newMoves.length - 1)
      clearAnalysisHighlights()
      return true
    } catch { return false }
  }

  function handleAnalysisDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    const moved = analysisMakeMove(sourceSquare, targetSquare)
    onAnalysisDragEnd()
    return moved
  }

  function handleAnalysisPieceDrag(args: PieceHandlerArgs) {
    setUserHighlights([])
    onAnalysisPieceDrag(args)
  }

  function handleAnalysisClick({ square }: SquareHandlerArgs) {
    setUserHighlights([])
    if (analysisSq) {
      if (square === analysisSq) { clearAnalysisHighlights(); return }
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

  // The from/to of the move currently shown while stepping a refutation line.
  const refutationLastMove = (() => {
    if (state !== "refuting" || refutationLine.length === 0 || refutationIndex < 0) return null
    const g = new Chess(game.fen())
    let mv
    for (let i = 0; i <= refutationIndex; i++) { try { mv = g.move(refutationLine[i]) } catch {} }
    return mv ? { from: mv.from, to: mv.to } : null
  })()

  const activeSquareStyles: Record<string, React.CSSProperties> = (() => {
    if (analysisMode) {
      return composeSquareStyles(
        buildLastMoveStyles(analysisLastMove?.from, analysisLastMove?.to),
        buildUserHighlightStyles(userHighlights),
        analysisHL,
        buildSelectionStyles(analysisSq),
      )
    }
    if (showingPrev && step.preMovePosition?.highlightSquares) {
      const sq: Record<string, React.CSSProperties> = {}
      for (const [s, color] of Object.entries(step.preMovePosition.highlightSquares))
        sq[s] = { backgroundColor: color }
      return sq
    }
    if (state === "refuting") {
      return buildLastMoveStyles(refutationLastMove?.from, refutationLastMove?.to)
    }
    if (state === "idle" || state === "wrong" || state === "alternative") {
      return composeSquareStyles(
        annotationSquares,
        buildLastMoveStyles(lastMove?.from, lastMove?.to),
        buildUserHighlightStyles(userHighlights),
        legalMoveSquares,
        canAttemptSolve ? buildSelectionStyles(selectedSquare) : {},
      )
    }
    // wrong / solved — keep the most recent move highlighted
    return buildLastMoveStyles(lastMove?.from, lastMove?.to)
  })()

  const activeArrows: Arrow[] = (() => {
    if (analysisMode) return []
    if (showingPrev && step.preMovePosition?.arrows)
      return step.preMovePosition.arrows.map(a => ({ startSquare: a.from as any, endSquare: a.to as any, color: a.color ?? "#ef4444" }))
    return (state === "idle" && moveHistory.length === 0) ? annotationArrows : []
  })()

  const showModeToggle   = blunderPlayed && !showingPrev && state !== "solved"

  const activeQualityBadge = (() => {
    if (analysisMode || showingPrev || state === "refuting" || !lastMove) return null
    const lastIdx = moveHistory.length - 1
    const quality = step.moveQualities?.[lastIdx]
    if (!quality) return null
    return { square: lastMove.to, quality }
  })()

  useMoveQualityPieceBadge(boardRef, activeQualityBadge)

  const board = (
    <div ref={boardRef} className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: displayFen,
          boardOrientation,
          allowDragging: analysisMode || canAttemptSolve,
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          squareStyles: activeSquareStyles,
          arrows: activeArrows,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          animationDurationInMs: !blunderPlayed ? 650 : 200,
          onPieceDrop: analysisMode ? handleAnalysisDrop : (canAttemptSolve ? handleDrop : undefined),
          onPieceDrag: analysisMode ? handleAnalysisPieceDrag : (canAttemptSolve ? handlePuzzlePieceDrag : undefined),
          onSquareClick: analysisMode ? handleAnalysisClick : (canAttemptSolve ? handleSquareClick : undefined),
          ...(analysisMode || canAttemptSolve ? userHighlightHandlers : {}),
        }}
      />
    </div>
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
            🔍 Analyze
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

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={analysisGoBack}
              variant="secondary"
              size="sm"
              disabled={analysisIndex === -1}
            >
              ◀ Back
            </Button>
            <Button
              onClick={analysisGoForward}
              variant="secondary"
              size="sm"
              disabled={analysisIndex >= analysisMoves.length - 1}
            >
              Forward ▶
            </Button>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {analysisMoves.length === 0
                ? "Starting position"
                : analysisIndex === -1
                  ? `Starting position · ${analysisMoves.length} move${analysisMoves.length === 1 ? "" : "s"} explored`
                  : `Move ${analysisIndex + 1} of ${analysisMoves.length}`}
            </span>
          </div>

          {analysisMoves.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => analysisJumpTo(-1)}
                className={clsx(
                  "text-sm rounded-lg px-2 py-1 font-mono transition-colors",
                  analysisIndex === -1
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60",
                )}
              >
                Start
              </button>
              {analysisMoves.map((m, i) => (
                <button
                  key={i}
                  onClick={() => analysisJumpTo(i)}
                  className={clsx(
                    "text-sm rounded-lg px-2 py-1 font-mono transition-colors",
                    i === analysisIndex
                      ? "bg-indigo-600 text-white"
                      : i < analysisIndex
                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600",
                  )}
                >
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                  <SanNotation san={m.san} fen={analysisStartFen} moveIndex={i} />
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-slate-500">
            Tip: use ← → arrow keys to step through your variation
          </p>
        </div>
      )}

      {/* ── Pre-blunder toggle (only in solve mode) ── */}
      {!analysisMode && step.preMovePosition && (
        <div className="flex flex-col gap-2">
          {!blunderPlayed ? (
            <div className="flex items-center gap-2 self-start text-sm font-medium px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Black plays <SanNotation san={step.preMovePosition.san} side={sideToMove(step.preMovePosition.fen)} />…
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
              {showingPrev ? "→ Return to puzzle" : (
                <>
                  ← Black played <SanNotation san={step.preMovePosition.san} side={sideToMove(step.preMovePosition.fen)} />
                </>
              )}
              <span className="text-xs opacity-50 font-normal ml-1">{showingPrev ? "(→)" : "(←)"}</span>
            </button>
          )}
          {showingPrev && step.preMovePosition.annotation && (
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed px-1">
              <MarkdownText>{step.preMovePosition.annotation}</MarkdownText>
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
                  "text-sm rounded-lg px-2 py-1 font-mono",
                  i % 2 === 0 ? "bg-gray-800 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                )}>
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                  <MoveQualityMoveLabel san={m} quality={step.moveQualities?.[i]} fen={step.fen} moveIndex={i} />
                </span>
              ))}
            </div>
          )}

          {midPatternUnlock && state !== "solved" && (
            <TacticalPatternUnlockCard
              patternId={midPatternUnlock.id}
              celebrate={midPatternUnlock.celebrate}
            />
          )}

          {state === "idle" && moveHistory.length === 0 && blunderPlayed && !showingPrev && (
            <p className="text-sm text-gray-400 dark:text-slate-500">Make your move on the board.</p>
          )}

          {/* Wrong move */}
          {state === "wrong" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-400">✗ Not quite.</div>
              {wrongMoveExplanation && (
                <p className="text-sm text-red-900 dark:text-red-300 leading-relaxed">
                  <MarkdownText>{wrongMoveExplanation}</MarkdownText>
                </p>
              )}
              <p className="text-xs text-red-700/80 dark:text-red-400/80">Make another move on the board to try again.</p>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={resetPuzzle} variant="secondary" size="sm">Reset board</Button>
                {refutationLine.length > 0 && (
                  <Button onClick={() => { setState("refuting"); setRefIdx(0) }} variant="secondary" size="sm">
                    Show why it fails
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Recognized alternative — good move, but not the best one */}
          {state === "alternative" && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 font-semibold text-indigo-800 dark:text-indigo-300">★ Great find — but there is an even better move.</div>
              <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <MarkdownText>{alternativeFeedback}</MarkdownText>
              </p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80">Make another move on the board to keep looking.</p>
            </div>
          )}

          {/* Refutation */}
          {state === "refuting" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">Here's why that move fails:</p>
              <div className="flex flex-wrap gap-1.5">
                {refutationLine.map((m, i) => (
                  <button key={i} onClick={() => setRefIdx(i)} className={clsx(
                    "text-sm rounded-lg px-2 py-1 font-mono transition",
                    i === refutationIndex ? "bg-amber-600 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200"
                  )}>
                    {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}
                    <SanNotation san={m} fen={step.fen} moveIndex={moveHistory.length + i} />
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
                  🏆 <MarkdownText>{step.successMessage}</MarkdownText>
                </div>
              )}
              <FeedbackPanel
                isCorrect={true}
                explanation={step.explanation}
                onNext={() => onComplete(true)}
                isLastStep={isLastStep}
                sound="celebration"
                coachContext={
                  step.solution.moves[0]
                    ? { fenBefore: step.fen, moveSan: step.solution.moves[0] }
                    : undefined
                }
                keyConceptId={step.keyConceptId}
                keyConceptIds={step.keyConceptIds}
                tacticalPatternId={
                  step.tacticalPatternUnlockMoveIndex != null || step.tacticalPatternUnlocks
                    ? undefined
                    : step.tacticalPatternId
                }
                tacticalPatternIds={
                  step.tacticalPatternUnlockMoveIndex != null || step.tacticalPatternUnlocks
                    ? undefined
                    : step.tacticalPatternIds
                }
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
