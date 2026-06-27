"use client"
// components/analysis/FreeAnalysis.tsx
// Free Analysis mode: play moves for BOTH sides on a board with legal-move
// enforcement (chess.js), while a client-side Stockfish (WASM, Web Worker)
// streams live evaluation, best move, and principal variation. Includes an eval
// bar, variation tree with back/forward navigation, reset, flip, and FEN paste.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Chess, type Square } from "chess.js"
import { Chessboard } from "react-chessboard"
import type { Arrow, PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { clsx } from "clsx"
import { useStockfish } from "@/hooks/useStockfish"
import { sideToMove, formatEval } from "@/lib/engine/format"
import { useBoardPreferences } from "@/components/BoardPreferencesProvider"
import { useLegalMoveHighlights } from "@/hooks/useLegalMoveHighlights"
import { usePieceLatchRef } from "@/hooks/usePieceLatchRef"
import { useUserSquareHighlightHandlers } from "@/hooks/useUserSquareHighlightHandlers"
import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"
import { EvalBar } from "./EvalBar"
import { MoveTreeList } from "./MoveTreeList"
import { VariationPicker } from "./VariationPicker"
import { AnalysisSaved } from "./AnalysisSaved"
import { SanNotation } from "@/components/chess/SanNotation"
import { colorFromPly } from "@/lib/san-notation"
import { playBoardMoveSound } from "@/lib/ui-sounds"
import {
  appendMovesAt,
  canBranchAt,
  countPlies,
  emptyMoveTree,
  forwardChildIndex,
  getChildrenAt,
  getFenAt,
  getLastMoveAt,
  pathsEqual,
  stepForward,
  stepToLineEnd,
  type MovePath,
  type MoveTree,
  type PlayedMove,
} from "@/lib/analysis/move-tree"
import {
  getEngineArrowEnabled,
  getMultiPv,
  MAX_MULTIPV,
  MIN_MULTIPV,
  setEngineArrowEnabled,
  setMultiPv,
  subscribeAnalysisPreferences,
} from "@/lib/analysis/preferences"
import { saveAnalysis, type SavedAnalysis } from "@/lib/analysis/saved-analyses"
import {
  buildLastMoveStyles,
  buildSelectionStyles,
  buildUserHighlightStyles,
  composeSquareStyles,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/legal-move-highlights"

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const DEPTH_OPTIONS = [12, 16, 20, 24]
const MULTIPV_OPTIONS = Array.from(
  { length: MAX_MULTIPV - MIN_MULTIPV + 1 },
  (_, i) => MIN_MULTIPV + i,
)
// Board arrow colors by MultiPV rank: primary (best) is the strong indigo;
// secondary lines are progressively lighter / distinct so they don't compete.
const ARROW_COLORS = ["rgba(99,102,241,0.85)", "rgba(245,158,11,0.7)", "rgba(20,184,166,0.65)"]
// Matching dots for the lines list, so panel lines correlate with board arrows.
const RANK_DOT_COLORS = ["bg-indigo-500", "bg-amber-500", "bg-teal-500"]

export function FreeAnalysis() {
  const { showLegalMoves } = useBoardPreferences()

  const [moveTree, setMoveTree] = useState<MoveTree>(() => emptyMoveTree(START_FEN))
  const [cursorPath, setCursorPath] = useState<MovePath>([])
  const prevCursorPathRef = useRef<MovePath>(cursorPath)
  const [forwardHintPath, setForwardHintPath] = useState<MovePath>([])
  const [variationIntentPath, setVariationIntentPath] = useState<MovePath | null>(null)
  const [orientation, setOrientation] = useState<"white" | "black">("white")
  const [engineOn, setEngineOn] = useState(true)
  const [depth, setDepth] = useState(16)
  const [fenInput, setFenInput] = useState("")
  const [fenError, setFenError] = useState<string | null>(null)
  const [userHighlights, setUserHighlights] = useState<string[]>([])
  const userHighlightHandlers = useUserSquareHighlightHandlers(setUserHighlights)
  // Variation picker: opens when stepping forward (→) into a branch with >1 line.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIndex, setPickerIndex] = useState(0)

  // Persisted analysis preferences (engine-arrow toggle + MultiPV count).
  const engineArrowEnabled = useSyncExternalStore(
    subscribeAnalysisPreferences,
    getEngineArrowEnabled,
    () => true,
  )
  const multiPv = useSyncExternalStore(subscribeAnalysisPreferences, getMultiPv, () => MIN_MULTIPV)

  // Panel tabs: live analysis vs the saved-studies collection.
  const [view, setView] = useState<"analyze" | "saved">("analyze")
  const [analysisName, setAnalysisName] = useState("")
  const [saveFlash, setSaveFlash] = useState(false)

  const currentFen = getFenAt(moveTree, cursorPath)
  const lastMove = getLastMoveAt(moveTree, cursorPath)

  const chess = useMemo(() => {
    try {
      return new Chess(currentFen)
    } catch {
      return new Chess()
    }
  }, [currentFen])

  const stm = sideToMove(currentFen)
  const gameOver = chess.isGameOver()
  const isCheckmate = chess.isCheckmate()
  const inCheck = chess.inCheck()
  const canInteract = !gameOver

  const { analysis, lines, ready, running, error, reconnecting, retry } = useStockfish({
    fen: currentFen,
    enabled: engineOn && !gameOver,
    depth,
    multiPv,
  })

  const totalPlies = countPlies(moveTree)
  const canGoForward = stepForward(moveTree, cursorPath, forwardHintPath) != null
  const canBranchFromCursor = canBranchAt(moveTree, cursorPath)
  // Continuations available from the current position (mainline first, then
  // sibling variations). When more than one exists, → opens the picker.
  const nextOptions = getChildrenAt(moveTree, cursorPath)
  const variationIntentActive =
    variationIntentPath != null && pathsEqual(variationIntentPath, cursorPath)

  function rememberPath(path: MovePath) {
    setForwardHintPath(path)
  }

  function clearVariationIntent() {
    setVariationIntentPath(null)
  }

  function startVariation(parentPath: MovePath) {
    rememberPath(parentPath)
    setCursorPath(parentPath)
    setVariationIntentPath(parentPath)
    setPickerOpen(false)
  }

  function navigateTo(path: MovePath) {
    rememberPath(path)
    setCursorPath(path)
    clearVariationIntent()
    setPickerOpen(false)
  }

  // Reset transient highlights whenever the position changes.
  useEffect(() => {
    setUserHighlights([])
  }, [cursorPath, moveTree.rootFen])

  // Board move sound when navigating to a new position (arrows, nav buttons, tree).
  useEffect(() => {
    const prev = prevCursorPathRef.current
    prevCursorPathRef.current = cursorPath
    if (pathsEqual(prev, cursorPath) || cursorPath.length === 0) return

    const played = getLastMoveAt(moveTree, cursorPath)
    if (!played) return

    try {
      const chess = new Chess(getFenAt(moveTree, cursorPath.slice(0, -1)))
      const mv = chess.move(played.san)
      if (mv) playBoardMoveSound(mv, new Chess(played.fenAfter))
    } catch {
      /* tree moves are validated at play time */
    }
  }, [cursorPath, moveTree])

  const {
    selectedSquare,
    latchAnimSquare,
    legalMoveSquares,
    selectSquare,
    clearHighlights,
    onPieceDrag,
    onDragEnd,
  } = useLegalMoveHighlights({
    game: chess,
    enabled: showLegalMoves && canInteract,
    isSelectable: (_sq, piece) => !!piece && piece.color === stm,
  })

  const boardRef = usePieceLatchRef(latchAnimSquare)

  // ── Move application ──────────────────────────────────────────────────────
  function pushMoves(newMoves: PlayedMove[]) {
    if (newMoves.length === 0) return
    setMoveTree((prev) => {
      const { tree, path } = appendMovesAt(prev, cursorPath, newMoves)
      rememberPath(path)
      setCursorPath(path)
      clearVariationIntent()
      return tree
    })
    setPickerOpen(false)
  }

  function attemptMove(from: string, to: string): boolean {
    if (!canInteract || from === to) return false
    const work = new Chess(currentFen)
    let mv
    try {
      mv = work.move({ from: from as Square, to: to as Square, promotion: "q" })
    } catch {
      return false
    }
    if (!mv) return false
    pushMoves([{ san: mv.san, from: mv.from, to: mv.to, fenAfter: work.fen() }])
    clearHighlights()
    return true
  }

  /** Play a UCI PV up to (and including) ply `count` from the live position. */
  function playPvLine(pvUci: string[], count: number) {
    if (pvUci.length === 0) return
    const work = new Chess(currentFen)
    const newMoves: PlayedMove[] = []
    for (let i = 0; i < count && i < pvUci.length; i++) {
      const uci = pvUci[i]
      try {
        const mv = work.move({
          from: uci.slice(0, 2) as Square,
          to: uci.slice(2, 4) as Square,
          promotion: uci.length > 4 ? uci[4] : undefined,
        })
        if (!mv) break
        newMoves.push({ san: mv.san, from: mv.from, to: mv.to, fenAfter: work.fen() })
      } catch {
        break
      }
    }
    pushMoves(newMoves)
  }

  /** Play the best line (MultiPV rank 1) up to ply `count`. */
  function playPv(count: number) {
    if (analysis) playPvLine(analysis.pvUci, count)
  }

  // ── Board event handlers ──────────────────────────────────────────────────
  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    const moved = attemptMove(sourceSquare, targetSquare)
    onDragEnd()
    return moved
  }

  function handlePieceDrag(args: PieceHandlerArgs) {
    setUserHighlights([])
    onPieceDrag(args)
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (!canInteract) return
    setUserHighlights([])
    if (selectedSquare) {
      if (square === selectedSquare) {
        clearHighlights()
        return
      }
      if (attemptMove(selectedSquare, square)) return
      clearHighlights()
      selectSquare(square)
      return
    }
    clearHighlights()
    selectSquare(square)
  }

  // ── Navigation / controls ─────────────────────────────────────────────────
  const goStart = () => navigateTo([])
  const goBack = () => {
    setCursorPath((path) => {
      rememberPath(path)
      return path.slice(0, -1)
    })
    clearVariationIntent()
    setPickerOpen(false)
  }
  const goForward = () => {
    const next = stepForward(moveTree, cursorPath, forwardHintPath)
    if (next) navigateTo(next)
  }
  const goEnd = () => navigateTo(stepToLineEnd(moveTree, cursorPath, forwardHintPath))

  // ── Variation picker (keyboard branch chooser) ────────────────────────────
  function openPicker() {
    const startIndex = forwardChildIndex(moveTree, cursorPath, forwardHintPath) ?? 0
    setPickerIndex(startIndex)
    setPickerOpen(true)
  }
  function choosePickerOption(index: number) {
    setPickerOpen(false)
    navigateTo([...cursorPath, index])
  }
  // Step forward: follow the only line, or open the picker when it branches.
  function stepForwardOrPick() {
    if (nextOptions.length === 0) return
    if (nextOptions.length === 1) {
      goForward()
      return
    }
    openPicker()
  }

  function resetBoard() {
    setMoveTree(emptyMoveTree(START_FEN))
    setCursorPath([])
    setForwardHintPath([])
    clearVariationIntent()
    setFenError(null)
    clearHighlights()
    setPickerOpen(false)
  }

  function loadFen(raw: string) {
    const fen = raw.trim()
    if (!fen) return
    try {
      const c = new Chess(fen)
      setMoveTree(emptyMoveTree(c.fen()))
      setCursorPath([])
      setForwardHintPath([])
      clearVariationIntent()
      setFenError(null)
      setFenInput("")
      clearHighlights()
      setPickerOpen(false)
    } catch {
      setFenError("Invalid FEN — please check the position string.")
    }
  }

  function copyFen() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(currentFen)
    }
  }

  // ── Saved analyses (localStorage collection) ──────────────────────────────
  function saveCurrentAnalysis() {
    const snapshotEval =
      engineOn && !gameOver && analysis
        ? formatEval(analysis.whiteCp, analysis.whiteMate)
        : null
    saveAnalysis({
      name: analysisName,
      tree: moveTree,
      cursorPath,
      evalText: snapshotEval,
    })
    setAnalysisName("")
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 1800)
  }

  function openSavedAnalysis(entry: SavedAnalysis) {
    setMoveTree(entry.tree)
    setCursorPath(entry.cursorPath ?? [])
    setForwardHintPath(entry.cursorPath ?? [])
    clearVariationIntent()
    setPickerOpen(false)
    setFenError(null)
    clearHighlights()
    setView("analyze")
  }

  // Keyboard: ← → step through moves; Space plays engine best move. When a
  // position branches, → opens the variation picker where ↑ ↓ move the
  // highlight, Enter selects, and Esc / ← dismiss. Never hijack typing in
  // inputs, textareas, or contenteditable fields (e.g. the FEN box).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (target instanceof HTMLElement && target.isContentEditable) return

      // Picker open: ↑ ↓ change highlight, Enter selects, Esc / ← dismiss.
      if (pickerOpen && nextOptions.length > 1) {
        const count = nextOptions.length
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setPickerIndex((i) => (count ? (i + 1) % count : 0))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setPickerIndex((i) => (count ? (i - 1 + count) % count : 0))
        } else if (e.key === "Enter") {
          e.preventDefault()
          choosePickerOption(pickerIndex)
        } else if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault()
          setPickerOpen(false)
        }
        return
      }

      // Don't fight keyboard activation when a button (nav/controls) has focus.
      if (target instanceof HTMLButtonElement) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goBack()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        stepForwardOrPick()
      } else if (e.key === " ") {
        if (!engineOn || !canInteract || !analysis?.bestMoveUci) return
        e.preventDefault()
        playPv(1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveTree, cursorPath, engineOn, canInteract, analysis, pickerOpen, pickerIndex, nextOptions, forwardHintPath])

  const moveNumbering = useMemo(() => {
    const parts = moveTree.rootFen.split(/\s+/)
    return {
      startWhite: parts[1] !== "b",
      baseFull: Number(parts[5]) || 1,
    }
  }, [moveTree.rootFen])

  // ── Eval (engine, or terminal override for game-over positions) ───────────
  const evalForBar = useMemo(() => {
    if (gameOver) {
      if (isCheckmate) {
        // Side to move is mated → the other side is winning.
        return { whiteCp: null, whiteMate: stm === "w" ? -0 : 0, active: true, mate: true }
      }
      return { whiteCp: 0, whiteMate: null, active: true, mate: false } // draw
    }
    if (!engineOn || !analysis) return { whiteCp: null, whiteMate: null, active: false, mate: false }
    return { whiteCp: analysis.whiteCp, whiteMate: analysis.whiteMate, active: true, mate: false }
  }, [gameOver, isCheckmate, stm, engineOn, analysis])

  // For the eval bar, encode a decisive checkmate as a large mate value.
  const barWhiteMate = gameOver && isCheckmate ? (stm === "w" ? -1 : 1) : evalForBar.whiteMate
  const barWhiteCp = evalForBar.whiteCp

  const evalText = useMemo(() => {
    if (gameOver) {
      if (isCheckmate) return "#"
      return "½"
    }
    if (!engineOn) return "–"
    if (!analysis) return ready ? "…" : "…"
    return formatEval(analysis.whiteCp, analysis.whiteMate)
  }, [gameOver, isCheckmate, engineOn, analysis, ready])

  const statusText = useMemo(() => {
    if (isCheckmate) return `Checkmate — ${stm === "w" ? "Black" : "White"} wins`
    if (chess.isStalemate()) return "Stalemate — draw"
    if (chess.isInsufficientMaterial()) return "Draw — insufficient material"
    if (chess.isThreefoldRepetition()) return "Draw — threefold repetition"
    if (chess.isDraw()) return "Draw"
    if (inCheck) return `${stm === "w" ? "White" : "Black"} is in check`
    return `${stm === "w" ? "White" : "Black"} to move`
  }, [chess, isCheckmate, inCheck, stm])

  // ── Board styles + best-move arrow ────────────────────────────────────────
  const squareStyles = composeSquareStyles(
    buildLastMoveStyles(lastMove?.from, lastMove?.to),
    buildUserHighlightStyles(userHighlights),
    canInteract ? legalMoveSquares : null,
    canInteract ? buildSelectionStyles(selectedSquare) : null,
  )

  const engineArrows: Arrow[] = useMemo(() => {
    if (!engineOn || gameOver || !engineArrowEnabled) return []
    return lines
      .slice(0, multiPv)
      .map((ln, i): Arrow | null => {
        const uci = ln.bestMoveUci
        if (!uci) return null
        return {
          startSquare: uci.slice(0, 2),
          endSquare: uci.slice(2, 4),
          color: ARROW_COLORS[i] ?? ARROW_COLORS[ARROW_COLORS.length - 1],
        }
      })
      .filter((a): a is Arrow => a !== null)
  }, [engineOn, gameOver, engineArrowEnabled, lines, multiPv])

  const board = (
    <div ref={boardRef} className="w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <Chessboard
        options={{
          position: currentFen,
          boardOrientation: orientation,
          allowDragging: canInteract,
          dragActivationDistance: DRAG_ACTIVATION_DISTANCE,
          squareStyles,
          arrows: engineArrows,
          animationDurationInMs: 200,
          darkSquareStyle: { backgroundColor: BOARD_DARK },
          lightSquareStyle: { backgroundColor: BOARD_LIGHT },
          id: "free-analysis",
          onPieceDrop: canInteract ? handleDrop : undefined,
          onPieceDrag: canInteract ? handlePieceDrag : undefined,
          onSquareClick: canInteract ? handleSquareClick : undefined,
          ...userHighlightHandlers,
        }}
      />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden h-full min-w-0">
      {/* Board side */}
      <div className="flex-[0_0_auto] lg:flex-[1_1_0] min-h-0 min-w-0 w-full flex flex-col items-center justify-center gap-2 p-2 sm:p-3 lg:p-6 bg-slate-900 overflow-hidden max-h-[min(56vh,calc(100vw-1rem))] lg:max-h-none">
        <div className="flex items-stretch justify-center gap-2 sm:gap-3 w-full h-full min-h-0">
          <EvalBar
            whiteCp={barWhiteCp}
            whiteMate={barWhiteMate}
            orientation={orientation}
            active={evalForBar.active}
          />
          <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
            <div className="w-full aspect-square max-h-full max-w-[min(100%,calc(100vw-4rem))] lg:max-w-[min(100%,calc(100vh-9rem))]">
              {board}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis panel */}
      <div className="relative flex-1 min-h-0 min-w-0 w-full lg:w-[420px] xl:w-[460px] lg:flex-none flex flex-col overflow-hidden bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                Free Analysis
              </p>
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
                Engine board
              </h1>
            </div>
            <FlipBoardButton onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))} />
          </div>

          {/* Tabs: live analysis vs the saved-studies collection */}
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/50">
            <TabButton label="Analysis" active={view === "analyze"} onClick={() => setView("analyze")} />
            <TabButton label="Saved" active={view === "saved"} onClick={() => setView("saved")} />
          </div>

          {view === "saved" ? (
            <AnalysisSaved onOpen={openSavedAnalysis} />
          ) : (
          <>
          {/* Eval summary */}
          <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={clsx(
                    "font-display text-3xl font-extrabold tabular-nums",
                    gameOver
                      ? "text-gray-900 dark:text-slate-100"
                      : (analysis?.whiteCp ?? 0) >= 0 || analysis?.whiteMate
                        ? "text-gray-900 dark:text-slate-100"
                        : "text-gray-900 dark:text-slate-100",
                  )}
                >
                  {evalText}
                </span>
                {engineOn && !gameOver && (
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                    depth {analysis?.depth ?? 0}
                    {running && <span className="ml-1 animate-pulse">●</span>}
                  </span>
                )}
              </div>
              {/* Engine toggle */}
              <button
                onClick={() => setEngineOn((v) => !v)}
                role="switch"
                aria-checked={engineOn}
                className={clsx(
                  "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400",
                  engineOn ? "bg-indigo-600" : "bg-gray-300 dark:bg-slate-600",
                )}
                title={engineOn ? "Turn engine off" : "Turn engine on"}
              >
                <span
                  className={clsx(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    engineOn ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>

            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">{statusText}</p>

            {reconnecting ? (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="animate-pulse" aria-hidden>●</span> Reconnecting to engine…
              </p>
            ) : error ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/50 px-2.5 py-1.5">
                <p className="min-w-0 text-xs text-red-600 dark:text-red-400">Engine error: {error}</p>
                <button
                  onClick={retry}
                  className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Retry
                </button>
              </div>
            ) : engineOn && !ready ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">Loading engine…</p>
            ) : null}

            {/* Engine lines (MultiPV: top 1–3 principal variations) */}
            {engineOn && !gameOver && lines.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  {multiPv > 1 ? `Top ${Math.min(multiPv, lines.length)} lines` : "Best line"}
                </span>
                {lines.slice(0, multiPv).map((ln, rank) => (
                  <div key={rank} className="flex items-start gap-2">
                    {multiPv > 1 && (
                      <span
                        className={clsx(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          RANK_DOT_COLORS[rank] ?? RANK_DOT_COLORS[RANK_DOT_COLORS.length - 1],
                        )}
                        aria-hidden
                      />
                    )}
                    <span className="shrink-0 w-12 text-sm font-bold tabular-nums text-gray-900 dark:text-slate-100">
                      {formatEval(ln.whiteCp, ln.whiteMate)}
                    </span>
                    <div className="min-w-0 flex flex-wrap gap-x-1.5 gap-y-1 items-center">
                      {ln.pvSan.slice(0, 12).map((san, i) => (
                        <button
                          key={`${rank}-${i}-${san}`}
                          onClick={() => playPvLine(ln.pvUci, i + 1)}
                          className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition inline-flex items-baseline"
                          title={
                            rank === 0 && i === 0
                              ? "Play best move (Space)"
                              : "Play this line up to here"
                          }
                        >
                          <SanNotation san={san} color={colorFromPly(i, stm === "w")} size="inherit" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Depth selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Depth
              </span>
              <div className="flex gap-1">
                {DEPTH_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={clsx(
                      "text-xs font-bold px-2 py-1 rounded-lg transition",
                      depth === d
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Lines (MultiPV) selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Lines
              </span>
              <div className="flex gap-1">
                {MULTIPV_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMultiPv(n)}
                    aria-pressed={multiPv === n}
                    className={clsx(
                      "text-xs font-bold px-2 py-1 rounded-lg transition",
                      multiPv === n
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600",
                    )}
                    title={`Show top ${n} engine ${n === 1 ? "move" : "moves"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Engine board-arrow toggle */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Board arrows
              </span>
              <button
                onClick={() => setEngineArrowEnabled(!engineArrowEnabled)}
                role="switch"
                aria-checked={engineArrowEnabled}
                className={clsx(
                  "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400",
                  engineArrowEnabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-slate-600",
                )}
                title={engineArrowEnabled ? "Hide engine move arrows on the board" : "Show engine move arrows on the board"}
              >
                <span
                  className={clsx(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    engineArrowEnabled ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>
          </div>

          {/* Move list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                Moves
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startVariation(cursorPath)}
                  disabled={!canBranchFromCursor || !canInteract}
                  className={clsx(
                    "text-[11px] font-bold px-2 py-1 rounded-lg transition",
                    canBranchFromCursor && canInteract
                      ? variationIntentActive
                        ? "bg-amber-500 text-white"
                        : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                      : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed",
                  )}
                  title={
                    canBranchFromCursor
                      ? "Play a different move on the board to add a variation from here"
                      : "Go back to a position that already has moves, then add a variation"
                  }
                >
                  + Variation
                </button>
                <span className="text-xs font-mono text-gray-400 dark:text-slate-500">
                  {cursorPath.length}/{totalPlies}
                </span>
              </div>
            </div>

            {variationIntentActive && (
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-xl px-3 py-2">
                Variation mode — play a different move on the board. It will appear as a sibling line in parentheses.
              </p>
            )}

            {pickerOpen && nextOptions.length > 1 && (
              <VariationPicker
                options={nextOptions}
                ply={cursorPath.length}
                numbering={moveNumbering}
                activeIndex={pickerIndex}
                onHover={setPickerIndex}
                onSelect={choosePickerOption}
                onClose={() => setPickerOpen(false)}
              />
            )}

            <MoveTreeList
              tree={moveTree}
              cursorPath={cursorPath}
              numbering={moveNumbering}
              onNavigate={navigateTo}
              onStartVariation={startVariation}
            />

            <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
              {moveTree.children.length === 0
                ? "Make a move to start the main line."
                : "Tip: ← → step through moves. At a branch, → opens a picker — use ↑ ↓ then Enter to choose a line (Esc cancels). Right-click any move to add a variation."}
            </p>
          </div>

          {/* Navigation controls */}
          <div className="grid grid-cols-4 gap-1.5">
            <NavButton label="⏮" title="Start" onClick={goStart} disabled={cursorPath.length === 0} />
            <NavButton label="◀" title="Back (←)" onClick={goBack} disabled={cursorPath.length === 0} />
            <NavButton label="▶" title="Forward (→)" onClick={stepForwardOrPick} disabled={!canGoForward} />
            <NavButton
              label="⏭"
              title="End"
              onClick={goEnd}
              disabled={!canGoForward}
            />
          </div>

          <button
            onClick={resetBoard}
            className="w-full font-display font-bold py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            ↺ Reset to start position
          </button>

          {/* Save analysis (localStorage collection) */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Save analysis
            </span>
            <div className="flex gap-2">
              <input
                value={analysisName}
                onChange={(e) => setAnalysisName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCurrentAnalysis()
                }}
                placeholder="Name this analysis…"
                className="flex-1 min-w-0 text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={saveCurrentAnalysis}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                💾 Save
              </button>
            </div>
            {saveFlash && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Saved — open it from the Saved tab.
              </p>
            )}
          </div>

          {/* FEN */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Position (FEN)
            </span>
            <div className="flex gap-2">
              <input
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadFen(fenInput)
                }}
                placeholder="Paste a FEN to set up a position…"
                className="flex-1 min-w-0 text-xs font-mono px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => loadFen(fenInput)}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Load
              </button>
            </div>
            {fenError && <p className="text-xs text-red-600 dark:text-red-400">{fenError}</p>}
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-gray-400 dark:text-slate-500">
                {currentFen}
              </code>
              <button
                onClick={copyFen}
                className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                title="Copy current FEN"
              >
                Copy
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex-1 text-xs font-display font-bold py-1.5 rounded-lg transition",
        active
          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100",
      )}
    >
      {label}
    </button>
  )
}

function NavButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="font-bold py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-slate-700"
    >
      {label}
    </button>
  )
}
