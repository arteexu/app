"use client"
import { useState } from "react"
import { Chess } from "chess.js"
import type { FindAllCheckmates as FindAllCheckMatesType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { LessonLayout } from "./LessonLayout"
import { clsx } from "clsx"

interface Props {
  step: FindAllCheckMatesType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

// Strip check/mate symbols for loose comparison
function normSan(san: string) { return san.replace(/[+#]/g, "") }

export function FindAllCheckmates({ step, onComplete, isLastStep }: Props) {
  const [game, setGame]               = useState(() => new Chess(step.fen))
  const [found, setFound]             = useState<string[]>([])   // SANs as returned by chess.js
  const [feedback, setFeedback]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [allFound, setAllFound]       = useState(false)
  const [selectedSquare, setSelectedSquare]   = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, React.CSSProperties>>({})

  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"
  const targetNorm   = step.checkmates.map(normSan)

  function resetBoard() {
    setGame(new Chess(step.fen))
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
      [square]: { backgroundColor: "rgba(99,102,241,0.45)" },
    }
    moves.forEach(m => { hl[m.to] = { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: "50%" } })
    setLegalMoveSquares(hl)
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to) return false
    const copy = new Chess(game.fen())
    let result
    try {
      result = copy.move({ from: from as any, to: to as any, promotion: "q" })
    } catch { return false }
    if (!result) return false

    const san  = result.san
    const norm = normSan(san)

    setSelectedSquare(null)
    setLegalMoveSquares({})

    if (copy.isCheckmate()) {
      if (targetNorm.includes(norm)) {
        // Correct!
        const alreadyFound = found.some(f => normSan(f) === norm)
        if (alreadyFound) {
          setFeedback({ msg: `You already found ${san}! Try a different square.`, ok: false })
          resetBoard()
          return true
        }
        const newFound = [...found, san]
        setFound(newFound)
        const remaining = step.checkmates.length - newFound.length
        if (remaining === 0) {
          setAllFound(true)
          setFeedback(null)
        } else {
          setFeedback({
            msg: `✓ ${san} is checkmate! ${remaining} more to find.`,
            ok: true,
          })
          resetBoard()
        }
      } else {
        // It's checkmate but not in the target list (shouldn't happen for well-designed puzzles)
        setFeedback({ msg: `${san} is checkmate — but look for the specific moves listed. Try again!`, ok: false })
        resetBoard()
      }
    } else {
      setFeedback({ msg: `${san} — that's not checkmate. Try another move!`, ok: false })
      resetBoard()
    }
    return true
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare || allFound) return false
    return attemptMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (allFound) return
    if (selectedSquare) {
      if (square === selectedSquare) { setSelectedSquare(null); setLegalMoveSquares({}); return }
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  const board = (
    <Chessboard
      options={{
        position: game.fen(),
        boardOrientation: step.orientation ?? "white",
        allowDragging: !allFound,
        squareStyles: legalMoveSquares,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        onPieceDrop: allFound ? undefined : handleDrop,
        onSquareClick: allFound ? undefined : handleSquareClick,
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <p className="text-lg font-semibold text-gray-900 dark:text-slate-100 leading-snug">{step.question}</p>

      {/* Progress grid */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-slate-400 font-medium">Checkmates found</span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
            {found.length} / {step.checkmates.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {step.checkmates.map((target, i) => {
            const isFound = found.some(f => normSan(f) === normSan(target))
            return (
              <div
                key={i}
                className={clsx(
                  "flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-mono font-bold border-2 transition-all duration-300",
                  isFound
                    ? "bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 scale-[1.03]"
                    : "bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600"
                )}
              >
                {isFound ? `✓ ${target}` : "?"}
              </div>
            )
          })}
        </div>
      </div>

      {/* Move feedback */}
      {feedback && !allFound && (
        <div className={clsx(
          "text-sm rounded-xl px-4 py-3 font-medium leading-relaxed",
          feedback.ok
            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
        )}>
          {feedback.msg}
        </div>
      )}

      {!allFound && (
        <p className="text-sm text-gray-400 dark:text-slate-500">
          {found.length === 0
            ? "Move the queen to any square that delivers checkmate."
            : `${step.checkmates.length - found.length} checkmate${step.checkmates.length - found.length === 1 ? "" : "s"} remaining — keep searching!`}
        </p>
      )}

      {/* Completion */}
      {allFound && (
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4 flex flex-col gap-2">
            <p className="text-lg font-extrabold text-green-700 dark:text-green-400">
              🎯 {step.successMessage ?? `All ${step.checkmates.length} checkmates found!`}
            </p>
            <p className="text-sm text-green-600 dark:text-green-500 leading-relaxed">{step.explanation}</p>
          </div>
          <Button onClick={() => onComplete(true)} variant="primary" size="lg">
            {isLastStep ? "Finish lesson →" : "Continue →"}
          </Button>
        </div>
      )}
    </LessonLayout>
  )
}
