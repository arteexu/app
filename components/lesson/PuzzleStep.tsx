"use client"
import { useState } from "react"
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
  const [game, setGame] = useState(() => new Chess(step.fen))
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [state, setState] = useState<PuzzleState>("idle")
  const [wrongMoveExplanation, setWrongMoveExplanation] = useState("")
  const [refutationLine, setRefutationLine] = useState<string[]>([])
  const [refutationIndex, setRefutationIndex] = useState(-1)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, React.CSSProperties>>({})

  const { squareStyles: annotationSquares, arrows: annotationArrows } = annotationsToProps(step.annotations)
  const learnerMoveIndex = moveHistory.length
  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"

  function resetPuzzle() {
    setGame(new Chess(step.fen))
    setMoveHistory([])
    setState("idle")
    setWrongMoveExplanation("")
    setRefutationLine([])
    setRefutationIndex(-1)
    setSelectedSquare(null)
    setLegalMoveSquares({})
  }

  function selectSquare(square: string) {
    const piece = game.get(square as any)
    if (!piece || piece.color !== learnerColor) {
      setSelectedSquare(null); setLegalMoveSquares({}); return
    }
    setSelectedSquare(square)
    const moves = game.moves({ square: square as any, verbose: true })
    const hl: Record<string, React.CSSProperties> = {
      [square]: { backgroundColor: "rgba(99, 102, 241, 0.4)" },
    }
    moves.forEach(m => { hl[m.to] = { backgroundColor: "rgba(99, 102, 241, 0.2)", borderRadius: "50%" } })
    setLegalMoveSquares(hl)
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to) return false
    let result
    try {
      result = game.move({ from: from as any, to: to as any, promotion: "q" })
    } catch { return false }
    if (!result) return false

    const san = result.san
    const expectedSan = step.solution.moves[learnerMoveIndex]

    setSelectedSquare(null)
    setLegalMoveSquares({})

    if (!expectedSan || !movesMatch(san, expectedSan)) {
      game.undo()
      const explanations = step.solution.wrongMoveExplanations?.[learnerMoveIndex] ?? {}
      const explanation = explanations[san] ?? "That's not the right move. Think: checks, captures, threats."
      const refutation = step.solution.refutationLines?.[learnerMoveIndex]?.[san] ?? []
      setState("wrong")
      setWrongMoveExplanation(explanation)
      setRefutationLine(refutation)
      return true
    }

    if (true) {
      const newHistory = [...moveHistory, san]
      setMoveHistory(newHistory)
      setGame(new Chess(game.fen()))

      if (newHistory.length === step.solution.moves.length) {
        setState("solved")
        return true
      }

      setTimeout(() => {
        const botMove = step.solution.moves[newHistory.length]
        if (!botMove) return
        try { game.move(botMove) } catch { return }
        setGame(new Chess(game.fen()))
        setMoveHistory(h => [...h, botMove])
      }, 400)

      return true
    }
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (state !== "idle" || !targetSquare) return false
    return attemptMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (state !== "idle") return
    if (selectedSquare) {
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  const displayFen = (() => {
    if (state === "refuting" && refutationLine.length > 0) {
      const g = new Chess(game.fen())
      for (let i = 0; i <= refutationIndex; i++) {
        try { g.move(refutationLine[i]) } catch {}
      }
      return g.fen()
    }
    return game.fen()
  })()

  const activeSquareStyles = state === "idle" ? { ...annotationSquares, ...legalMoveSquares } : {}
  const activeArrows: Arrow[] = (state === "idle" && moveHistory.length === 0) ? annotationArrows : []

  const board = (
    <Chessboard
      options={{
        position: displayFen,
        boardOrientation: step.orientation ?? "white",
        allowDragging: state === "idle",
        squareStyles: activeSquareStyles,
        arrows: activeArrows,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        onPieceDrop: state === "idle" ? handleDrop : undefined,
        onSquareClick: state === "idle" ? handleSquareClick : undefined,
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <p className="text-lg font-semibold text-gray-900 leading-snug">{step.question}</p>

      {/* Move history */}
      {moveHistory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {moveHistory.map((m, i) => (
            <span key={i} className={clsx(
              "text-xs rounded-lg px-2 py-1 font-mono",
              i % 2 === 0 ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700"
            )}>
              {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{m}
            </span>
          ))}
        </div>
      )}

      {state === "idle" && moveHistory.length === 0 && (
        <p className="text-sm text-gray-400">Make your move on the board.</p>
      )}

      {/* Wrong move feedback */}
      {state === "wrong" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 font-semibold text-red-800">✗ Not the best move.</div>
          <p className="text-sm text-red-900 leading-relaxed">{wrongMoveExplanation}</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={resetPuzzle} variant="primary" size="sm">Try again</Button>
            {refutationLine.length > 0 && (
              <Button onClick={() => { setState("refuting"); setRefutationIndex(0) }} variant="secondary" size="sm">
                Show why it fails
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Refutation line */}
      {state === "refuting" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-amber-900">Here's why that move fails:</p>
          <div className="flex flex-wrap gap-1.5">
            {refutationLine.map((m, i) => (
              <button key={i} onClick={() => setRefutationIndex(i)} className={clsx(
                "text-xs rounded-lg px-2 py-1 font-mono transition",
                i === refutationIndex ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
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

      {/* Success */}
      {state === "solved" && (
        <>
          {step.successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm font-medium">
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
    </LessonLayout>
  )
}

function movesMatch(a: string, b: string): boolean {
  return a.replace(/[+#]/g, "") === b.replace(/[+#]/g, "")
}
