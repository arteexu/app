"use client"
import { useState } from "react"
import { Chess } from "chess.js"
import type { PlayVsBotStep as PlayVsBotStepType } from "@/lib/types"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { Button } from "@/components/ui/button"
import { FeedbackPanel } from "./FeedbackPanel"
import { LessonLayout } from "./LessonLayout"
import { clsx } from "clsx"

interface Props {
  step: PlayVsBotStepType
  onComplete: (isCorrect: boolean) => void
  isLastStep?: boolean
}

export function PlayVsBotStep({ step, onComplete, isLastStep }: Props) {
  const [game, setGame] = useState(() => new Chess(step.fen))
  const [moveCount, setMoveCount] = useState(0)
  const [outcome, setOutcome] = useState<"won" | "lost" | "draw" | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoveSquares, setLegalMoveSquares] = useState<Record<string, React.CSSProperties>>({})
  const [moveHistory, setMoveHistory] = useState<string[]>([])

  const learnerColor = (step.orientation ?? "white") === "white" ? "w" : "b"

  function checkOutcome(g: Chess, history: string[]): boolean {
    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "b" : "w"
      setOutcome(winner === learnerColor ? "won" : "lost")
      return true
    }
    if (g.isDraw() || g.isStalemate()) { setOutcome("draw"); return true }
    const learnerMoves = history.filter((_, i) => i % 2 === 0).length
    if (step.maxMoves && learnerMoves >= step.maxMoves) { setOutcome("lost"); return true }
    return false
  }

  function makeBotMove(g: Chess, history: string[]) {
    setBotThinking(true)
    setTimeout(() => {
      const moves = g.moves()
      if (!moves.length) { setBotThinking(false); return }
      const move = moves[Math.floor(Math.random() * moves.length)]
      g.move(move)
      const newHistory = [...history, move]
      setMoveHistory(newHistory)
      setGame(new Chess(g.fen()))
      setBotThinking(false)
      checkOutcome(g, newHistory)
    }, 500)
  }

  function attemptMove(from: string, to: string): boolean {
    if (from === to || game.turn() !== learnerColor || outcome || botThinking) return false
    const g = new Chess(game.fen())
    let result
    try {
      result = g.move({ from: from as any, to: to as any, promotion: "q" })
    } catch { return false }
    if (!result) return false

    const newHistory = [...moveHistory, result.san]
    setMoveHistory(newHistory)
    setGame(new Chess(g.fen()))
    setMoveCount(c => c + 1)
    setSelectedSquare(null)
    setLegalMoveSquares({})

    if (!checkOutcome(g, newHistory)) makeBotMove(g, newHistory)
    return true
  }

  function selectSquare(square: string) {
    const piece = game.get(square as any)
    if (!piece || piece.color !== learnerColor) { setSelectedSquare(null); setLegalMoveSquares({}); return }
    setSelectedSquare(square)
    const moves = game.moves({ square: square as any, verbose: true })
    const hl: Record<string, React.CSSProperties> = { [square]: { backgroundColor: "rgba(99,102,241,0.4)" } }
    moves.forEach(m => { hl[m.to] = { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: "50%" } })
    setLegalMoveSquares(hl)
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    return attemptMove(sourceSquare, targetSquare)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (outcome || botThinking || game.turn() !== learnerColor) return
    if (selectedSquare) {
      // Clicking the same piece again deselects it
      if (square === selectedSquare) { setSelectedSquare(null); setLegalMoveSquares({}); return }
      if (!attemptMove(selectedSquare, square)) selectSquare(square); return
    }
    selectSquare(square)
  }

  function reset() {
    setGame(new Chess(step.fen))
    setMoveCount(0)
    setOutcome(null)
    setBotThinking(false)
    setSelectedSquare(null)
    setLegalMoveSquares({})
    setMoveHistory([])
  }

  const isWon = outcome === "won"

  const board = (
    <Chessboard
      options={{
        position: game.fen(),
        boardOrientation: step.orientation ?? "white",
        allowDragging: !outcome && !botThinking,
        squareStyles: legalMoveSquares,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#eeeed2" },
        onPieceDrop: (!outcome && !botThinking) ? handleDrop : undefined,
        onSquareClick: (!outcome && !botThinking) ? handleSquareClick : undefined,
      }}
    />
  )

  return (
    <LessonLayout board={board}>
      <div>
        <p className="text-lg font-semibold text-gray-900 leading-snug">{step.question}</p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full">
            🎯 {step.objective}
          </span>
          {/* Live move counter — always visible during play */}
          {!outcome && (
            <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
              Move {moveCount}
            </span>
          )}
        </div>
      </div>

      {botThinking && <p className="text-sm text-gray-400 dark:text-slate-500 italic">Bot is thinking…</p>}

      {game.inCheck() && !outcome && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-red-800 dark:text-red-400 text-sm font-semibold">⚠️ Check!</div>
      )}

      {/* Move list */}
      {moveHistory.length > 0 && !outcome && (
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {moveHistory.map((m, i) => (
            <span key={i} className={clsx("text-xs rounded px-1.5 py-0.5 font-mono", i % 2 === 0 ? "bg-gray-800 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300")}>
              {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ""}{m}
            </span>
          ))}
        </div>
      )}

      {!outcome && moveHistory.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-slate-500">Make your move on the board.</p>
      )}

      {/* Win screen — prominent move counter */}
      {outcome === "won" && (
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4 flex flex-col gap-1">
            <p className="text-2xl font-extrabold text-green-700 dark:text-green-400">
              ♟ Checkmate in {moveCount} {moveCount === 1 ? "move" : "moves"}!
            </p>
            <p className="text-sm text-green-600 dark:text-green-500">
              {moveRating(moveCount)}
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{step.explanation}</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
            >
              ↺ Play again
            </button>
            <button
              onClick={() => onComplete(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition"
            >
              {isLastStep ? "Finish lesson →" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* Loss / draw screen */}
      {outcome && outcome !== "won" && (
        <FeedbackPanel
          isCorrect={false}
          explanation="The king escaped — or the game ended in a draw (stalemate). Reset and try again. Remember: always check for stalemate before delivering the final check."
          onNext={reset}
          nextLabel="Try again"
        />
      )}
    </LessonLayout>
  )
}

function moveRating(moves: number): string {
  if (moves <= 10) return "⭐⭐⭐ Brilliant — that's grandmaster efficiency!"
  if (moves <= 15) return "⭐⭐ Great technique! Can you do it in fewer?"
  if (moves <= 20) return "⭐ Solid — try to finish in under 15 next time."
  return "Keep at it — aim for under 20 moves as your next goal."
}
