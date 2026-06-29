"use client"
// components/annotated/AnnotatedGamePlayer.tsx
// Step-through player for an annotated master game. Walks the main line one ply
// at a time: board on one side, the annotator's notes + sidelines + concept
// checks on the other (reusing LessonLayout's board branch so the controls stay
// pinned while the notes scroll). Navigate with ◀/▶ buttons or ←/→ keys.
//
// Board-integrated concept checks: at a ply that carries a concept check, the
// move does NOT auto-play. Instead the learner is asked to *find the move on the
// board* (the same on-board interaction lessons use in PuzzleStep) — playing the
// actual game move with inline feedback. Only once they find it (or reveal it)
// does the annotator's commentary + the multiple-choice concept check appear,
// and the multiple-choice still blocks advancing until answered. This keeps the
// learning on the board instead of splitting attention into a separate quiz.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { clsx } from "clsx"
import type { AnnotatedGame } from "@/lib/annotated/types"
import { conceptChecksByPly, fenAtStep, plyLabel, INITIAL_FEN } from "@/lib/annotated/games"
import { nagStyle, primaryGlyph } from "@/lib/annotated/nags"
import {
  buildSelectionStyles,
  buildUserHighlightStyles,
  buildWrongMoveStyles,
  composeSquareStyles,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/legal-move-highlights"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { LessonLayout } from "@/components/lesson/LessonLayout"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { LessonSoundProvider, useLessonSounds } from "@/hooks/useLessonSounds"
import { playBoardMoveSound } from "@/lib/ui-sounds"
import { Confetti } from "@/components/lesson/RewardFx"
import { VariationLine } from "./VariationLine"
import { ConceptCheckCard } from "./ConceptCheckCard"
import { FindMovePrompt } from "./FindMovePrompt"
import { SanNotation } from "@/components/chess/SanNotation"

/** SAN compare ignoring check/mate decorations (e.g. "Qe7+" === "Qe7"). */
function movesMatch(a: string, b: string): boolean {
  return a.replace(/[+#]/g, "") === b.replace(/[+#]/g, "")
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** SSR-safe prefers-reduced-motion (server snapshot = false; no effect needed). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  )
}

export function AnnotatedGamePlayer({ game }: { game: AnnotatedGame }) {
  return (
    <LessonSoundProvider>
      <PlayerInner game={game} />
    </LessonSoundProvider>
  )
}

function PlayerInner({ game }: { game: AnnotatedGame }) {
  const total = game.plies.length
  const checksByPly = useMemo(() => conceptChecksByPly(game), [game])
  const { play } = useLessonSounds()

  const [step, setStep] = useState(0)
  const [answered, setAnswered] = useState<Record<string, number>>({})
  const [flipped, setFlipped] = useState(false)
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const reduce = usePrefersReducedMotion()

  // ── Board-integrated "find the move" challenge state ──
  // When the learner is about to advance INTO a ply that carries a concept
  // check, we pause at the position *before* that move (step stays at
  // challengeStep - 1) and ask them to play it on the board. `solvedFinds`
  // remembers which challenge plies are already done so review navigation never
  // re-quizzes. `findWrongSan` holds the last wrong attempt for inline feedback.
  const [challengeStep, setChallengeStep] = useState<number | null>(null)
  const [solvedFinds, setSolvedFinds] = useState<Record<number, true>>({})
  const [findWrongSan, setFindWrongSan] = useState<string | null>(null)
  const challengeActive = challengeStep !== null

  const { showLegalMoves } = useBoardPreferences()
  const challengePly = challengeStep ? game.plies[challengeStep - 1] : null
  const learnerColor: "w" | "b" = challengePly?.side === "black" ? "b" : "w"
  const challengeGame = useMemo(
    () => new Chess(challengeStep ? fenAtStep(game, challengeStep - 1) : INITIAL_FEN),
    [game, challengeStep],
  )
  const {
    selectedSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game: challengeGame,
    enabled: showLegalMoves && challengeActive,
    isSelectable: (_square, piece) => !!piece && piece.color === learnerColor,
  })

  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights, true)

  const currentPly = step >= 1 ? game.plies[step - 1] : null
  const currentCheck = currentPly ? checksByPly.get(currentPly.ply) : undefined
  const checkAnswered = currentCheck ? currentCheck.id in answered : true
  const gateBlocked = (!!currentCheck && !checkAnswered) || challengeActive
  const isComplete = step === total && !challengeActive

  // A ply can be jumped to only if every concept check *before* it is answered —
  // this enforces the same gate as linear stepping, without tracking "max seen".
  const canJumpTo = useCallback(
    (targetPly: number) => {
      for (const cc of game.conceptChecks ?? []) {
        if (cc.ply < targetPly && !(cc.id in answered)) return false
      }
      return true
    },
    [game, answered]
  )

  // ── Board move sound on every step change ──
  const prevStepRef = useRef(step)
  useEffect(() => {
    const prev = prevStepRef.current
    prevStepRef.current = step
    if (step === prev || step < 1) return
    try {
      const chess = new Chess(fenAtStep(game, step - 1))
      const mv = chess.move(game.plies[step - 1].san)
      if (mv) playBoardMoveSound(mv, chess)
    } catch {
      /* validated at ingest; ignore */
    }
  }, [step, game])

  // ── Celebrate once on completion ──
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (isComplete && !celebratedRef.current) {
      celebratedRef.current = true
      play("lessonComplete")
    }
  }, [isComplete, play])

  // Right-click scratch markers are cleared at each navigation choke point
  // (goNext/goPrev/jumpTo/resolveFind) so they stay scoped to a single position.
  //
  // Commit a found/revealed challenge: mark it solved and reveal the move (the
  // step-change effect plays the move sound), surfacing commentary + the check.
  const resolveFind = useCallback(
    (target: number) => {
      setSolvedFinds((f) => ({ ...f, [target]: true }))
      setFindWrongSan(null)
      setChallengeStep(null)
      clearHighlights()
      setUserHighlights([])
      setStep(target)
    },
    [clearHighlights],
  )

  const goNext = useCallback(() => {
    if (challengeStep !== null) return // must play (or reveal) the move first
    if (step >= total) return
    setUserHighlights([])
    const cur = step >= 1 ? game.plies[step - 1] : null
    const curCheck = cur ? checksByPly.get(cur.ply) : undefined
    if (curCheck && !(curCheck.id in answered)) return // multiple-choice gate
    const target = step + 1
    const nextPly = game.plies[target - 1]
    const nextCheck = nextPly ? checksByPly.get(nextPly.ply) : undefined
    if (nextCheck && !solvedFinds[target]) {
      // Pause before the move and hand control to the board.
      setFindWrongSan(null)
      setChallengeStep(target)
      return
    }
    setStep(target)
  }, [challengeStep, step, total, game, checksByPly, answered, solvedFinds])

  const goPrev = useCallback(() => {
    setUserHighlights([])
    if (challengeStep !== null) {
      // Back out of a challenge without advancing.
      setChallengeStep(null)
      setFindWrongSan(null)
      clearHighlights()
      return
    }
    setStep((s) => Math.max(0, s - 1))
  }, [challengeStep, clearHighlights])

  const jumpTo = useCallback(
    (target: number) => {
      if (challengeStep !== null) return
      if (target < 0 || target > total) return
      if (!canJumpTo(target)) return
      setUserHighlights([])
      setStep(target)
    },
    [challengeStep, total, canJumpTo]
  )

  // ── Challenge move handling (mirrors the lessons' PuzzleStep interaction) ──
  const attemptFind = useCallback(
    (from: string, to: string): boolean => {
      if (challengeStep === null) return false
      const target = challengeStep
      const expected = game.plies[target - 1]
      const g = new Chess(fenAtStep(game, target - 1))
      let result
      try {
        result = g.move({ from: from as never, to: to as never, promotion: "q" })
      } catch {
        return false
      }
      if (!result) return false
      if (movesMatch(result.san, expected.san)) {
        resolveFind(target) // correct — reveal the move + annotation
        return true
      }
      setFindWrongSan(result.san)
      play("wrong")
      return false
    },
    [challengeStep, game, resolveFind, play],
  )

  function handleChallengeDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!challengeActive || !targetSquare) return false
    setFindWrongSan(null)
    const moved = attemptFind(sourceSquare, targetSquare)
    onDragEnd()
    return moved
  }

  function handleChallengePieceDrag(args: PieceHandlerArgs) {
    if (!challengeActive) return
    setFindWrongSan(null)
    setUserHighlights([])
    onPieceDrag(args)
  }

  function handleChallengeSquareClick({ square }: SquareHandlerArgs) {
    if (!challengeActive) return
    setFindWrongSan(null)
    setUserHighlights([])
    if (selectedSquare) {
      if (square === selectedSquare) {
        clearHighlights()
        return
      }
      if (!attemptFind(selectedSquare, square)) selectSquare(square)
      return
    }
    selectSquare(square)
  }

  // ── Keyboard navigation ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev])

  function onAnswered(checkId: string, selectedIndex: number) {
    setAnswered((a) => ({ ...a, [checkId]: selectedIndex }))
  }

  function restart() {
    setStep(0)
    setUserHighlights([])
    setChallengeStep(null)
    setFindWrongSan(null)
    setSolvedFinds({})
    clearHighlights()
    celebratedRef.current = false
  }

  // ── Last-move highlight (suppressed while finding a move) ──
  const lastMoveSquares = useMemo(() => {
    if (challengeActive || step < 1) return {}
    try {
      const chess = new Chess(fenAtStep(game, step - 1))
      const mv = chess.move(game.plies[step - 1].san)
      if (mv) {
        return {
          [mv.from]: { background: "rgba(245,158,11,0.22)" },
          [mv.to]: { background: "rgba(245,158,11,0.38)" },
        } as Record<string, React.CSSProperties>
      }
    } catch {
      /* ignore */
    }
    return {}
  }, [challengeActive, step, game])

  // Highlight a wrong challenge attempt's from/to in red.
  const wrongMoveSquares = useMemo(() => {
    if (!challengeActive || !findWrongSan || challengeStep === null) return {}
    try {
      const g = new Chess(fenAtStep(game, challengeStep - 1))
      const mv = g.move(findWrongSan)
      if (mv) return buildWrongMoveStyles(mv.from, mv.to)
    } catch {
      /* ignore */
    }
    return {}
  }, [challengeActive, findWrongSan, challengeStep, game])

  const fen = fenAtStep(game, step)
  const orientation = flipped ? "black" : "white"
  const progressPct = total > 0 ? Math.round((step / total) * 100) : 0
  const glyph = currentPly ? primaryGlyph(currentPly.nags) : undefined

  // While solving: legal-move dots + selection + wrong-move feedback. Otherwise:
  // the last-move highlight. User right-click markers layer on top of both.
  const squareStyles = challengeActive
    ? composeSquareStyles(
        legalMoveSquares,
        buildSelectionStyles(selectedSquare),
        wrongMoveSquares,
        buildUserHighlightStyles(userHighlights),
      )
    : composeSquareStyles(lastMoveSquares, buildUserHighlightStyles(userHighlights))

  const board = (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: challengeActive,
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          onPieceDrop: challengeActive ? handleChallengeDrop : undefined,
          onPieceDrag: challengeActive ? handleChallengePieceDrag : undefined,
          onSquareClick: challengeActive ? handleChallengeSquareClick : undefined,
          squareStyles,
          animationDurationInMs: reduce ? 0 : 220,
          darkSquareStyle: { backgroundColor: BOARD_DARK },
          lightSquareStyle: { backgroundColor: BOARD_LIGHT },
          id: "annotated-board",
          ...userHighlightHandlers,
        }}
      />
    </div>
  )

  const footer = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={step === 0 && !challengeActive}
          className="flex-1 font-display font-bold py-2.5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ◀ Prev
        </button>
        <button
          onClick={goNext}
          disabled={step >= total || gateBlocked}
          className="flex-[1.4] font-display font-extrabold py-2.5 rounded-2xl bg-indigo-600 text-white shadow-[0_4px_0_#312e81] hover:bg-indigo-700 hover:translate-y-[2px] hover:shadow-[0_2px_0_#312e81] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
        >
          {step >= total ? "End" : "Next ▶"}
        </button>
        <button
          onClick={restart}
          className="shrink-0 font-display font-bold px-3 py-2.5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-gray-300 transition-all"
          aria-label="Restart from the beginning"
          title="Restart"
        >
          ↺
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
        {challengeActive ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">Find the move on the board →</span>
        ) : gateBlocked ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">Answer the concept check to continue →</span>
        ) : (
          <>Use ← → arrow keys to step through the game</>
        )}
      </p>
    </div>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <LessonLayout board={board} footer={footer}>
        {isComplete && !reduce && <Confetti run={isComplete} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-indigo-600 dark:text-indigo-400">
              Annotated game
            </p>
            <h1 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
              {game.headers.white} <span className="text-gray-400 font-bold">vs</span> {game.headers.black}
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {[game.headers.event, game.headers.year, game.headers.eco].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Link
            href="/games"
            className="shrink-0 text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 transition"
          >
            Exit
          </Link>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-500 dark:text-slate-400">
              {challengeActive && challengePly
                ? `Find move ${challengePly.moveNumber} · ${challengePly.side === "white" ? "White" : "Black"} to play`
                : step === 0
                  ? "Starting position"
                  : `Move ${currentPly!.moveNumber} · ply ${step} of ${total}`}
            </span>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="font-semibold text-indigo-500 hover:underline"
            >
              ⇅ Flip board
            </button>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300 motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Move + annotation (or the on-board "find the move" challenge) */}
        {challengeActive && challengePly ? (
          <FindMovePrompt
            moverName={challengePly.side === "white" ? game.headers.white : game.headers.black}
            side={challengePly.side}
            moveNumber={challengePly.moveNumber}
            wrongSan={findWrongSan}
            hint={checksByPly.get(challengePly.ply)?.hint}
            onReveal={() => { if (challengeStep !== null) resolveFind(challengeStep) }}
          />
        ) : step === 0 ? (
          <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/50 px-4 py-4">
            <p className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
              {game.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">{game.description}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-3">
              Press <span className="font-bold">Next ▶</span> (or the <span className="font-mono">→</span> key) to play
              through the game move by move. White to move.
            </p>
          </div>
        ) : (
          currentPly && (
            <div className="flex flex-col gap-3" aria-live="polite">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">
                  {plyLabel(currentPly.moveNumber, currentPly.side, currentPly.san)}
                </span>
                {glyph && (
                  <span className={clsx("px-2 py-0.5 rounded-lg text-sm font-extrabold", nagStyle(glyph).className)}>
                    {glyph} <span className="font-semibold">{nagStyle(glyph).label}</span>
                  </span>
                )}
              </div>

              {currentPly.comment && (
                <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-900/25 border border-indigo-100 dark:border-indigo-800/60 px-4 py-3 text-indigo-900 dark:text-indigo-100 text-[15px] leading-relaxed">
                  <MarkdownText>{currentPly.comment}</MarkdownText>
                </div>
              )}

              {currentPly.variations?.map((v, i) => (
                <VariationLine
                  key={i}
                  variation={v}
                  insteadOf={plyLabel(currentPly.moveNumber, currentPly.side, currentPly.san)}
                />
              ))}

              {currentCheck && (
                <ConceptCheckCard
                  key={currentCheck.id}
                  check={currentCheck}
                  answeredIndex={currentCheck.id in answered ? answered[currentCheck.id] : null}
                  onAnswered={(idx) => onAnswered(currentCheck.id, idx)}
                />
              )}
            </div>
          )
        )}

        {/* Completion banner */}
        {isComplete && (
          <div className="relative z-10 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-center">
            <p className="font-display text-xl font-extrabold text-amber-700 dark:text-amber-400">
              Game complete · {game.headers.result}
            </p>
            <p className="text-sm text-amber-800/90 dark:text-amber-300/90 mt-1">
              You stepped through all {total} moves of {game.headers.white} vs {game.headers.black}.
            </p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                onClick={restart}
                className="font-display font-bold px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
              >
                ↺ Replay
              </button>
              <Link
                href="/games"
                className="font-display font-bold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                More games →
              </Link>
            </div>
          </div>
        )}

        {/* Move list */}
        <div className="mt-1">
          <p className="text-[11px] font-extrabold tracking-[0.1em] uppercase text-gray-400 dark:text-slate-500 mb-1.5">
            Moves
          </p>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pr-1">
            {game.plies.map((p) => {
              const locked = !canJumpTo(p.ply)
              const isCurrent = p.ply === step
              return (
                <span key={p.ply} className="inline-flex items-baseline">
                  {p.side === "white" && (
                    <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 mr-0.5 self-center">
                      {p.moveNumber}.
                    </span>
                  )}
                  <button
                    onClick={() => jumpTo(p.ply)}
                    disabled={locked}
                    aria-current={isCurrent ? "true" : undefined}
                    className={clsx(
                      "text-xs sm:text-sm rounded-md px-1.5 py-0.5 font-mono transition-colors mr-1 motion-reduce:transition-none",
                      isCurrent
                        ? "bg-indigo-600 text-white"
                        : locked
                          ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                          : "text-gray-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
                      checksByPly.has(p.ply) && !isCurrent && !locked && "ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700"
                    )}
                    title={checksByPly.has(p.ply) ? "Concept check here" : undefined}
                  >
                    <SanNotation san={p.san} color={p.side} size="inherit" />
                    {primaryGlyph(p.nags) ?? ""}
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      </LessonLayout>
    </div>
  )
}
