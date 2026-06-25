"use client"
import { useState, useEffect } from "react"
import { Chess, type Square } from "chess.js"
import type { FindAllCheckmates as FindAllCheckMatesType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { LessonLayout } from "./LessonLayout"
import { useLessonBoardOrientation } from "@/hooks/useLessonBoardOrientation"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { isBoardSoundEnabled, playBoardMoveSound } from "@/lib/ui-sounds"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { usePieceLatchRef } from "@/hooks/usePieceLatchRef"
import { buildSelectionStyles, buildUserHighlightStyles, composeSquareStyles, DRAG_ACTIVATION_DISTANCE } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"

interface Props {
  step: FindAllCheckMatesType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

// Strip check/mate symbols for loose comparison
function normSan(san: string) { return san.replace(/[+#]/g, "") }

export function FindAllCheckmates({ step, onComplete, isLastStep }: Props) {
  const { play } = useLessonSounds()
  const boardOrientation = useLessonBoardOrientation(step.orientation ?? "white")
  const [game, setGame]               = useState(() => new Chess(step.fen))
  const [found, setFound]             = useState<string[]>([])   // SANs as returned by chess.js
  const [feedback, setFeedback]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [allFound, setAllFound]       = useState(false)
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights, !allFound)

  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"
  const { showLegalMoves } = useBoardPreferences()
  const {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game,
    enabled: showLegalMoves && !allFound,
    isSelectable: (_square, piece) => !!piece && piece.color === learnerColor,
  })

  const boardRef = usePieceLatchRef(latchAnimSquare)
  const targetNorm   = step.checkmates.map(normSan)

  useEffect(() => {
    if (allFound) play("stepComplete")
  }, [allFound, play])

  useEffect(() => {
    if (!feedback || isBoardSoundEnabled()) return
    play(feedback.ok ? "correctMove" : "wrong")
  }, [feedback, play])

  function resetBoard() {
    setGame(new Chess(step.fen))
    clearHighlights()
    setUserHighlights([])
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to) return false
    const copy = new Chess(game.fen())
    let result
    try {
      result = copy.move({ from: from as Square, to: to as Square, promotion: "q" })
    } catch { return false }
    if (!result) return false

    playBoardMoveSound(result, copy)

    const san  = result.san
    const norm = normSan(san)

    clearHighlights()

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
    const moved = attemptMove(sourceSquare, targetSquare)
    onDragEnd()
    return moved
  }

  function handlePieceDrag(args: PieceHandlerArgs) {
    setUserHighlights([])
    onPieceDrag(args)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (allFound) return
    setUserHighlights([])
    if (selectedSquare) {
      if (square === selectedSquare) { clearHighlights(); return }
      if (!attemptMove(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  const squareStyles = composeSquareStyles(
    buildUserHighlightStyles(userHighlights),
    legalMoveSquares,
    allFound ? {} : buildSelectionStyles(selectedSquare),
  )

  const board = (
    <div ref={boardRef} className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: game.fen(),
          boardOrientation,
          allowDragging: !allFound,
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          squareStyles,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          onPieceDrop: allFound ? undefined : handleDrop,
          onPieceDrag: allFound ? undefined : handlePieceDrag,
          onSquareClick: allFound ? undefined : handleSquareClick,
          ...(allFound ? {} : userHighlightHandlers),
        }}
      />
    </div>
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
            <p className="text-sm text-green-600 dark:text-green-500 leading-relaxed">
              <MarkdownText>{step.explanation}</MarkdownText>
            </p>
          </div>
          <Button onClick={() => onComplete(true)} variant="primary" size="lg">
            {isLastStep ? "Finish lesson →" : "Continue →"}
          </Button>
        </div>
      )}
    </LessonLayout>
  )
}
