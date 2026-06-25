"use client"
// components/solitaire/SolitairePlay.tsx
// The play screen. The learner guesses their side's moves one at a time; the
// opponent's moves auto-play with a short delay + board sound. Correct guesses
// advance the line; wrong guesses can be retried, revealed, or skipped. Play
// stops at full move 50 or the end of the recorded game. Controls are pinned in
// a footer (they never shift as feedback text grows).

import { useEffect, useMemo, useRef, useState } from "react"
import { Chessboard } from "react-chessboard"
import type { Arrow, PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { clsx } from "clsx"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import type { MoveResult, MoveOutcome } from "@/lib/solitaire-scoring"
import {
  getCutoffPly,
  isUserPly,
  chessAt,
  sanMatches,
  fullMoveNumber,
  userPlies,
  describeMove,
  moveFactAt,
} from "@/lib/solitaire/engine"
import { LessonLayout } from "@/components/lesson/LessonLayout"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { FlipBoardButton } from "./FlipBoardButton"
import { AnnotatedGameBadge } from "./AnnotatedGameBadge"
import { isAnnotatedGame } from "@/lib/solitaire/games"
import { useLessonSounds } from "@/hooks/useLessonSounds"
import { isBoardSoundEnabled, playBoardMoveSound } from "@/lib/ui-sounds"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { usePieceLatchRef } from "@/hooks/usePieceLatchRef"
import { useWrongMovePieceBadge } from "@/hooks/useWrongMovePieceBadge"
import {
  buildLastMoveStyles,
  buildSelectionStyles,
  buildUserHighlightStyles,
  buildWrongMoveStyles,
  composeSquareStyles,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"

interface Props {
  setup: SolitaireSetup
  onFinish: (results: MoveResult[]) => void
  onExit: () => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"
// UI-only: highlight the Reveal button after this many wrong tries. Never auto-reveals.
const REVEAL_NUDGE_AFTER = 2

type WrongMove = { from: string; to: string; san: string }

/** Map a clicked/dragged square to the canonical square when a wrong move is still on the board. */
function canonicalSquare(square: string, wrong: WrongMove | null): string {
  if (wrong && square === wrong.to) return wrong.from
  return square
}

/** Map a canonical square to where it appears while a wrong move is displayed. */
function visualSquare(square: string | null, wrong: WrongMove | null): string | null {
  if (!square) return null
  if (wrong && square === wrong.from) return wrong.to
  return square
}

type Feedback =
  | { kind: "idle" }
  | { kind: "correct"; san: string; firstTry: boolean; fact: string | null; comment?: string }
  | { kind: "wrong"; tries: number }
  | { kind: "alternative"; tries: number; label?: string; note: string }
  | { kind: "revealed"; san: string; fact: string | null; comment?: string }

export function SolitairePlay({ setup, onFinish, onExit }: Props) {
  const { game, side, startPly } = setup
  const cutoff = useMemo(() => getCutoffPly(game), [game])
  const totalGuesses = useMemo(() => userPlies(game, side, startPly).length, [game, side, startPly])
  const learnerColor = side === "white" ? "w" : "b"

  const { play } = useLessonSounds()
  const { showLegalMoves } = useBoardPreferences()

  const [cursor, setCursor] = useState(startPly)
  const [phase, setPhase] = useState<"playing" | "finished">("playing")
  const [opponentThinking, setOpponentThinking] = useState(false)
  const [attempts, setAttempts] = useState(0) // wrong tries on the current move (unlimited)
  const [revealing, setRevealing] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" })
  const [wrongMove, setWrongMove] = useState<WrongMove | null>(null)
  const [wrongMoveFen, setWrongMoveFen] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  // Right-click square markers (red). Cleared on any move / navigation below.
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)

  // Manual board flip; default orientation = the side being played (the winner).
  const [flipped, setFlipped] = useState(false)
  const orientation = flipped ? (side === "white" ? "black" : "white") : side

  // Optional authored "Reveal explanation" card for the most-recently-resolved
  // move. Persists across the opponent's reply so there's time to open it; only
  // set when that move actually has an authored explanation.
  const [explainCard, setExplainCard] = useState<{ san: string; text: string } | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)

  // The grandmaster whose moves the learner is guessing (their chosen side).
  const gmName = side === "white" ? game.white : game.black

  // Capture the authored explanation (if any) for a just-resolved ply.
  function captureExplanation(ply: number) {
    const text = game.annotations?.[ply]?.explanation
    setShowExplanation(false)
    setExplainCard(text ? { san: game.moves[ply], text } : null)
  }

  const [results, setResults] = useState<MoveResult[]>([])
  const resultsRef = useRef<MoveResult[]>([])

  // Respect reduced-motion: shorten the opponent delay and board animation.
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])
  const oppDelay = reduce ? 250 : 650
  const animMs = reduce ? 0 : 260

  const currentChess = useMemo(() => chessAt(game, cursor), [game, cursor])
  const isUserTurn = phase === "playing" && cursor < cutoff && isUserPly(cursor, side)
  const canInteract = isUserTurn && !revealing && !opponentThinking

  const {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game: currentChess,
    enabled: showLegalMoves && canInteract,
    isSelectable: (_sq, piece) => !!piece && piece.color === learnerColor,
  })

  const boardRef = usePieceLatchRef(visualSquare(latchAnimSquare, wrongMove))
  useWrongMovePieceBadge(boardRef, wrongMove?.to)

  function recordResult(outcome: MoveOutcome, totalAttempts: number) {
    const r: MoveResult = {
      ply: cursor,
      expectedSan: game.moves[cursor],
      attempts: totalAttempts,
      outcome,
    }
    resultsRef.current = [...resultsRef.current, r]
    setResults(resultsRef.current)
  }

  // Play one ply (the recorded move) with its board sound, then advance.
  function advance(ply: number) {
    const board = chessAt(game, ply)
    let from: string | null = null
    let to: string | null = null
    try {
      const mv = board.move(game.moves[ply])
      if (mv) {
        playBoardMoveSound(mv, board)
        from = mv.from
        to = mv.to
      }
    } catch {
      /* recorded moves are validated; ignore */
    }
    setLastMove(from && to ? { from, to } : null)
    setCursor(ply + 1)
  }

  // ── Progression: auto-play opponent moves; detect end. ──
  useEffect(() => {
    if (phase !== "playing") return
    if (cursor >= cutoff) {
      setPhase("finished")
      return
    }
    if (isUserPly(cursor, side)) return // wait for the learner
    if (revealing) return
    setOpponentThinking(true)
    const t = setTimeout(() => {
      advance(cursor)
      setOpponentThinking(false)
      setFeedback({ kind: "idle" })
    }, oppDelay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, phase, revealing])

  // Clear right-click markers and wrong-move feedback on any move / navigation.
  useEffect(() => {
    setUserHighlights([])
    setWrongMove(null)
    setWrongMoveFen(null)
  }, [cursor])

  function clearAllHighlights() {
    setUserHighlights([])
    clearHighlights()
  }

  function clearWrongMoveFeedback() {
    setWrongMove(null)
    setWrongMoveFen(null)
    if (feedback.kind === "wrong" || feedback.kind === "alternative") {
      setFeedback({ kind: "idle" })
    }
  }

  function retryWrongMove() {
    clearWrongMoveFeedback()
    clearAllHighlights()
  }

  // ── Finish: hand results back exactly once. ──
  const finishedRef = useRef(false)
  useEffect(() => {
    if (phase === "finished" && !finishedRef.current) {
      finishedRef.current = true
      onFinish(resultsRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function onCorrect(firstTry: boolean) {
    if (firstTry) {
      setStreak((s) => {
        const next = s + 1
        setBestStreak((b) => Math.max(b, next))
        if (next >= 2 && !isBoardSoundEnabled()) play("combo")
        return next
      })
    }
    if (!isBoardSoundEnabled()) play("correctMove")
    setWrongMove(null)
    setWrongMoveFen(null)
    clearHighlights()
    setAttempts(0)
    advance(cursor) // plays the (canonical) move + sound + advances
  }

  function attemptMove(from: string, to: string): boolean {
    if (!canInteract || from === to) return false
    const board = chessAt(game, cursor)
    let mv
    try {
      mv = board.move({ from: from as never, to: to as never, promotion: "q" })
    } catch {
      return false
    }
    if (!mv) return false

    if (sanMatches(mv.san, game.moves[cursor])) {
      const firstTry = attempts === 0
      recordResult(firstTry ? "first-try" : "retry", attempts + 1)
      setFeedback({
        kind: "correct",
        san: game.moves[cursor],
        firstTry,
        fact: describeMove(mv),
        comment: game.annotations?.[cursor]?.comment,
      })
      captureExplanation(cursor)
      onCorrect(firstTry)
      return true
    }

    // Wrong guess — keep the attempt visible on the board until Retry (or a new
    // guess replaces it). Guessing stays unlimited.
    const tries = attempts + 1
    setAttempts(tries)
    setStreak(0)
    setWrongMoveFen(board.fen())
    setWrongMove({ from, to, san: mv.san })
    const alt = game.annotations?.[cursor]?.alternatives?.find((a) => sanMatches(a.san, mv.san))
    if (alt) {
      setFeedback({ kind: "alternative", tries, label: alt.label, note: alt.note })
    } else {
      setFeedback({ kind: "wrong", tries })
    }
    if (!isBoardSoundEnabled()) play("wrong")
    clearHighlights()
    return true
  }

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    const from = canonicalSquare(sourceSquare, wrongMove)
    const moved = attemptMove(from, targetSquare)
    onDragEnd()
    return moved
  }

  function handlePieceDrag(args: PieceHandlerArgs) {
    setUserHighlights([])
    if (!args.square) {
      onPieceDrag(args)
      return
    }
    onPieceDrag({ ...args, square: canonicalSquare(args.square, wrongMove) })
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!canInteract) return
    const sq = canonicalSquare(square, wrongMove)
    if (selectedSquare) {
      if (sq === selectedSquare) {
        clearAllHighlights()
        return
      }
      if (attemptMove(selectedSquare, square)) return
      clearAllHighlights()
      selectSquare(sq)
      return
    }
    clearAllHighlights()
    selectSquare(sq)
  }

  function startReveal() {
    if (!isUserTurn || revealing) return
    setRevealing(true)
    setWrongMove(null)
    setWrongMoveFen(null)
    clearHighlights()
  }

  function confirmReveal() {
    if (!revealing || !isUserTurn) return
    recordResult("revealed", attempts)
    setStreak(0)
    setRevealing(false)
    setWrongMove(null)
    setWrongMoveFen(null)
    setAttempts(0)
    setFeedback({
      kind: "revealed",
      san: game.moves[cursor],
      fact: moveFactAt(game, cursor),
      comment: game.annotations?.[cursor]?.comment,
    })
    captureExplanation(cursor)
    advance(cursor)
  }

  function skip() {
    if (!isUserTurn) return
    recordResult("skipped", attempts)
    setStreak(0)
    setRevealing(false)
    setWrongMove(null)
    setWrongMoveFen(null)
    setAttempts(0)
    setFeedback({ kind: "idle" })
    setExplainCard(null)
    setShowExplanation(false)
    clearHighlights()
    advance(cursor)
  }

  const canRetryWrongMove = feedback.kind === "wrong" || feedback.kind === "alternative"

  // Keyboard shortcuts: Enter retry (wrong-move only), R reveal / play-revealed, S skip.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === "Enter") {
        if (canRetryWrongMove && isUserTurn) {
          e.preventDefault()
          retryWrongMove()
        }
        return
      }

      if (!isUserTurn) return
      if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        revealing ? confirmReveal() : startReveal()
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault()
        skip()
      }
    }
    // Capture phase so Enter retry runs before the board wrapper blocks keyboard drag.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserTurn, revealing, attempts, cursor, canRetryWrongMove])

  // ── Reveal arrow ──
  const revealArrow: Arrow[] = useMemo(() => {
    if (!revealing) return []
    const board = chessAt(game, cursor)
    try {
      const mv = board.move(game.moves[cursor])
      if (mv) return [{ startSquare: mv.from, endSquare: mv.to, color: "#f59e0b" }]
    } catch {
      /* ignore */
    }
    return []
  }, [revealing, cursor, game])

  // Layer (bottom → top): last move, user right-click markers, wrong-move red
  // rings (distinct from user markers), legal-move dots (gated by preference),
  // then yellow selection on top.
  const squareStyles = composeSquareStyles(
    buildLastMoveStyles(lastMove?.from, lastMove?.to),
    buildUserHighlightStyles(userHighlights),
    buildWrongMoveStyles(wrongMove?.from, wrongMove?.to),
    canInteract ? legalMoveSquares : null,
    canInteract ? buildSelectionStyles(visualSquare(selectedSquare, wrongMove)) : null,
  )

  const boardPosition = wrongMoveFen ?? currentChess.fen()

  const guessesDone = results.length
  const progressPct = totalGuesses > 0 ? Math.round((guessesDone / totalGuesses) * 100) : 0
  const sessionPlies = useMemo(() => {
    const out: { ply: number; san: string }[] = []
    for (let p = startPly; p < cursor; p++) out.push({ ply: p, san: game.moves[p] })
    return out
  }, [startPly, cursor, game])

  const board = (
    <div ref={boardRef} className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: boardPosition,
          boardOrientation: orientation,
          allowDragging: canInteract,
          // react-chessboard defaults this to 1px, so the tiniest jitter during
          // a quick tap activates a dnd-kit drag and swallows the native click
          // (onSquareClick never fires → the piece doesn't latch). A larger
          // threshold lets quick clicks register as clicks while still allowing
          // real drags (you just move a few px before the piece "picks up").
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          squareStyles,
          arrows: revealArrow,
          animationDurationInMs: animMs,
          darkSquareStyle: { backgroundColor: BOARD_DARK },
          lightSquareStyle: { backgroundColor: BOARD_LIGHT },
          id: "solitaire-play",
          onPieceDrop: canInteract ? handleDrop : undefined,
          onPieceDrag: canInteract ? handlePieceDrag : undefined,
          onSquareClick: canInteract ? handleSquareClick : undefined,
          ...userHighlightHandlers,
        }}
      />
    </div>
  )

  const footer = (
    <div className="flex items-center gap-2.5">
      {revealing ? (
        <button
          onClick={confirmReveal}
          className="flex-1 bg-amber-500 text-white font-display font-extrabold py-3 rounded-2xl shadow-[0_4px_0_#b45309] hover:bg-amber-600 hover:translate-y-[2px] hover:shadow-[0_2px_0_#b45309] active:translate-y-[4px] active:shadow-none transition-all"
        >
          Play {game.moves[cursor] ? game.moves[cursor].replace(/[+#]/g, "") : "move"} →
        </button>
      ) : (
        <>
          <button
            onClick={startReveal}
            disabled={!isUserTurn}
            className={clsx(
              "flex-1 font-display font-bold py-3 rounded-2xl border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
              attempts >= REVEAL_NUDGE_AFTER
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-amber-300"
            )}
          >
            💡 Reveal move
          </button>
          <button
            onClick={skip}
            disabled={!isUserTurn}
            className="flex-1 font-display font-bold py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Skip ⏭
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <LessonLayout board={board} footer={footer}>
        {/* Header: game + progress */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              {game.opening}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h1 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight truncate">
                {game.title}
              </h1>
              {isAnnotatedGame(game) && <AnnotatedGameBadge />}
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
              {game.white} vs {game.black}
            </p>
          </div>
          <button
            onClick={onExit}
            className="shrink-0 text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 transition"
          >
            Exit
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-3 py-1 rounded-full">
            ♟ You play {side}
          </span>
          {streak >= 2 && (
            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full">
              🔥 {streak} streak
            </span>
          )}
          <FlipBoardButton onClick={() => setFlipped((f) => !f)} className="ml-auto" />
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-500 dark:text-slate-400">
              Guess {Math.min(guessesDone + 1, totalGuesses)} of {totalGuesses}
            </span>
            <span className="font-mono text-gray-400 dark:text-slate-500">Move {fullMoveNumber(cursor)}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Live status / feedback (aria-live for a11y) */}
        <div aria-live="polite" className="min-h-[2.5rem]">
          {opponentThinking ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 italic">
              {side === "white" ? "Black" : "White"} is replying…
            </p>
          ) : feedback.kind === "correct" ? (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2.5 text-green-800 dark:text-green-300 text-sm flex flex-col gap-1">
              <span className="font-semibold">
                ✓ Correct — that's the move!
              </span>
              {feedback.fact && <span className="text-xs font-medium opacity-90">{feedback.fact}</span>}
              {feedback.comment && (
                <span className="text-xs italic text-green-700/90 dark:text-green-300/80">“{feedback.comment}”</span>
              )}
            </div>
          ) : feedback.kind === "wrong" ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-red-800 dark:text-red-300 text-sm flex flex-col gap-2.5">
              <span className="font-semibold">Not the move {gmName} played.</span>
              <span className="text-xs opacity-90">Keep guessing — there's no limit on tries.</span>
              {feedback.tries >= REVEAL_NUDGE_AFTER && (
                <span className="text-xs opacity-75">
                  Stuck? Tap <strong>Reveal move</strong> below when you're ready — it never reveals automatically.
                </span>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={retryWrongMove}
                  className="font-display font-bold text-sm px-4 py-2 rounded-xl bg-red-600 text-white shadow-[0_3px_0_#991b1b] hover:bg-red-700 hover:translate-y-[1px] hover:shadow-[0_2px_0_#991b1b] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  ↺ Retry
                </button>
                <span className="self-center text-xs opacity-75">or try another move on the board.</span>
              </div>
            </div>
          ) : feedback.kind === "alternative" ? (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 px-4 py-3 text-sky-800 dark:text-sky-300 text-sm flex flex-col gap-2.5">
              <span className="font-semibold">{feedback.label ?? "Strong alternative"} — but not what {gmName} played.</span>
              <p className="text-sm leading-relaxed opacity-95">{feedback.note}</p>
              <span className="text-xs opacity-90">Keep guessing — there's no limit on tries.</span>
              {feedback.tries >= REVEAL_NUDGE_AFTER && (
                <span className="text-xs opacity-75">
                  Stuck? Tap <strong>Reveal move</strong> below when you're ready — it never reveals automatically.
                </span>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={retryWrongMove}
                  className="font-display font-bold text-sm px-4 py-2 rounded-xl bg-sky-600 text-white shadow-[0_3px_0_#0369a1] hover:bg-sky-700 hover:translate-y-[1px] hover:shadow-[0_2px_0_#0369a1] active:translate-y-[2px] active:shadow-none transition-all"
                >
                  ↺ Retry
                </button>
                <span className="self-center text-xs opacity-75">or try another move on the board.</span>
              </div>
            </div>
          ) : feedback.kind === "revealed" ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-amber-800 dark:text-amber-300 text-sm flex flex-col gap-1">
              <span className="font-semibold">The grandmaster played {feedback.san.replace(/[+#]/g, "")}.</span>
              {feedback.fact && <span className="text-xs font-medium opacity-90">{feedback.fact}</span>}
              {feedback.comment && (
                <span className="text-xs italic text-amber-700/90 dark:text-amber-300/80">“{feedback.comment}”</span>
              )}
            </div>
          ) : revealing ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-amber-800 dark:text-amber-300 text-sm font-semibold">
              The move is shown with an arrow. Play it to continue.
            </div>
          ) : isUserTurn ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Your move — make the move you think the grandmaster played.
            </p>
          ) : null}
        </div>

        {/* Optional authored explanation — revealed on demand, visually distinct
            from the auto-generated mechanical move facts. Only shown when the
            resolved move actually carries an authored explanation. */}
        {explainCard && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-900/20 px-4 py-2.5">
            {showExplanation ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    📖 Explanation · {explainCard.san.replace(/[+#]/g, "")}
                  </span>
                  <button
                    onClick={() => setShowExplanation(false)}
                    className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                  >
                    Hide
                  </button>
                </div>
                <p className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                  <MarkdownText>{explainCard.text}</MarkdownText>
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowExplanation(true)}
                className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
              >
                📖 Reveal explanation
                <span className="font-normal text-indigo-400 dark:text-indigo-500">
                  · {explainCard.san.replace(/[+#]/g, "")}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Played moves */}
        {sessionPlies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {sessionPlies.map(({ ply, san }) => (
              <span
                key={ply}
                className={clsx(
                  "text-xs rounded-lg px-2 py-1 font-mono",
                  isUserPly(ply, side)
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                )}
              >
                {ply % 2 === 0 ? `${fullMoveNumber(ply)}. ` : ""}
                {san}
              </span>
            ))}
          </div>
        )}
      </LessonLayout>
    </div>
  )
}
