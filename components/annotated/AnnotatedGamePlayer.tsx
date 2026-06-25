"use client"
// components/annotated/AnnotatedGamePlayer.tsx
// Step-through player for an annotated master game. Walks the main line one ply
// at a time: board on one side, the annotator's notes + sidelines + concept
// checks on the other (reusing LessonLayout's board branch so the controls stay
// pinned while the notes scroll). Navigate with ◀/▶ buttons or ←/→ keys; a
// concept check blocks advancing until the learner answers it.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { clsx } from "clsx"
import type { AnnotatedGame } from "@/lib/annotated/types"
import { conceptChecksByPly, fenAtStep, plyLabel } from "@/lib/annotated/games"
import { nagStyle, primaryGlyph } from "@/lib/annotated/nags"
import { buildUserHighlightStyles, composeSquareStyles } from "@/lib/legal-move-highlights"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { LessonLayout } from "@/components/lesson/LessonLayout"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { LessonSoundProvider, useLessonSounds } from "@/hooks/useLessonSounds"
import { playBoardMoveSound } from "@/lib/ui-sounds"
import { Confetti } from "@/components/lesson/RewardFx"
import { VariationLine } from "./VariationLine"
import { ConceptCheckCard } from "./ConceptCheckCard"

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
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)
  const reduce = usePrefersReducedMotion()

  const currentPly = step >= 1 ? game.plies[step - 1] : null
  const currentCheck = currentPly ? checksByPly.get(currentPly.ply) : undefined
  const checkAnswered = currentCheck ? currentCheck.id in answered : true
  const gateBlocked = !!currentCheck && !checkAnswered
  const isComplete = step === total

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

  // Keep a ref of answered checks so the keyboard/goNext closures stay current.
  const answeredRef = useRef(answered)
  useEffect(() => {
    answeredRef.current = answered
  }, [answered])

  // Navigating to another ply clears the learner's right-click square markers
  // (done in the handlers — the choke point for every ply change — so we avoid a
  // setState-in-effect and keep the scratch markers scoped to a single position).
  const goNext = useCallback(() => {
    setUserHighlights([])
    setStep((s) => {
      if (s >= total) return s
      const ply = s >= 1 ? game.plies[s - 1] : null
      const check = ply ? checksByPly.get(ply.ply) : undefined
      if (check && !(check.id in answeredRef.current)) return s
      return s + 1
    })
  }, [total, game, checksByPly])

  const goPrev = useCallback(() => {
    setUserHighlights([])
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const jumpTo = useCallback(
    (target: number) => {
      if (target < 0 || target > total) return
      if (!canJumpTo(target)) return
      setUserHighlights([])
      setStep(target)
    },
    [total, canJumpTo]
  )

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
    celebratedRef.current = false
  }

  // ── Last-move highlight ──
  const lastMoveSquares = useMemo(() => {
    if (step < 1) return {}
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
  }, [step, game])

  const fen = fenAtStep(game, step)
  const orientation = flipped ? "black" : "white"
  const progressPct = total > 0 ? Math.round((step / total) * 100) : 0
  const glyph = currentPly ? primaryGlyph(currentPly.nags) : undefined

  // User right-click markers layer above the last-move highlight.
  const squareStyles = composeSquareStyles(
    lastMoveSquares,
    buildUserHighlightStyles(userHighlights),
  )

  const board = (
    <div className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
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
          disabled={step === 0}
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
        {gateBlocked ? (
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
              {step === 0 ? "Starting position" : `Move ${currentPly!.moveNumber} · ply ${step} of ${total}`}
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

        {/* Move + annotation */}
        {step === 0 ? (
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
                      "text-xs rounded-md px-1.5 py-0.5 font-mono transition-colors mr-1 motion-reduce:transition-none",
                      isCurrent
                        ? "bg-indigo-600 text-white"
                        : locked
                          ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                          : "text-gray-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40",
                      checksByPly.has(p.ply) && !isCurrent && !locked && "ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700"
                    )}
                    title={checksByPly.has(p.ply) ? "Concept check here" : undefined}
                  >
                    {p.san}
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
