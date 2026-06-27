"use client"
// components/solitaire/SolitaireGenerate.tsx
// "Generate a game" tab of Solitaire setup. The user picks a starting position
// (a known opening or a pasted FEN), the side they want to solve as, and an
// engine strength/speed. On Generate, a Stockfish worker plays both sides until
// the game ends naturally, with live progress + cancel. The finished
// line is converted to a transient SolitaireGame and handed to the player.

import { useEffect, useMemo, useState } from "react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { clsx } from "clsx"
import type { Side, SolitaireSetup } from "@/lib/solitaire/types"
import { STANDARD_START_FEN } from "@/lib/solitaire/engine"
import { OPENINGS, fenForOpening, getOpening } from "@/lib/solitaire/openings"
import { SPEED_PRESETS, type SpeedId } from "@/lib/solitaire/generate"
import { saveGame } from "@/lib/solitaire/saved-games"
import { promoteToPool } from "@/lib/multiplayer/engine-games"
import { useGameGenerator } from "@/hooks/useGameGenerator"
import { FlipBoardButton } from "./FlipBoardButton"
import { SolitaireBoardEditor, type BoardEditorResult } from "./SolitaireBoardEditor"
import { ChessMindLoader } from "@/components/ui/ChessMindLoader"

interface Props {
  onStart: (setup: SolitaireSetup) => void
}

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

type StartMode = "opening" | "fen" | "board"

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function SolitaireGenerate({ onStart }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [mode, setMode] = useState<StartMode>("opening")
  const [openingId, setOpeningId] = useState<string>("standard")
  const [fenInput, setFenInput] = useState("")
  const [side, setSide] = useState<Side>("white")
  const [speed, setSpeed] = useState<SpeedId>("fast")
  const [flipped, setFlipped] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [savedId, setSavedId] = useState<string | null>(null)
  const [promoteState, setPromoteState] = useState<"idle" | "saving" | "done" | "error">("idle")
  const [boardResult, setBoardResult] = useState<BoardEditorResult>({
    fen: null,
    displayFen: STANDARD_START_FEN,
    error: null,
  })

  const { state, generate, cancel, reset } = useGameGenerator()
  const isBusy = state.status === "starting" || state.status === "running"
  const isDone = state.status === "done" && state.game != null

  const opening = getOpening(openingId) ?? OPENINGS[0]

  // Validate the pasted FEN (chess.js throws on invalid input).
  const fenValidation = useMemo(() => {
    const fen = fenInput.trim()
    if (!fen) return { fen: null as string | null, error: null as string | null }
    try {
      const c = new Chess(fen)
      return { fen: c.fen(), error: null as string | null }
    } catch {
      return { fen: null as string | null, error: "Invalid FEN — please check the position string." }
    }
  }, [fenInput])

  // The position the engine will start from, given the current config. The
  // "Custom FEN" and "Set up board" paths both resolve to a validated FEN; the
  // board editor reports null while the position is illegal.
  const startFen = useMemo(() => {
    if (mode === "fen") return fenValidation.fen
    if (mode === "board") return boardResult.fen
    return fenForOpening(opening)
  }, [mode, fenValidation.fen, boardResult.fen, opening])

  // Default the solved side to whoever is to move in the chosen FEN (custom FEN
  // or board editor), tracking only the side-to-move so editing pieces doesn't
  // clobber a manual choice. They can still flip it.
  const startStm = startFen ? (startFen.split(/\s+/)[1] === "b" ? "black" : "white") : null
  useEffect(() => {
    if ((mode === "fen" || mode === "board") && startStm) setSide(startStm)
  }, [mode, startStm])

  // The board only ever shows the chosen STARTING position — never the engine's
  // live/finished position — so it can't spoil the moves the user will solve.
  // In board mode show the live (possibly-illegal) placement so the right-hand
  // preview always mirrors the editor.
  const previewFen =
    mode === "board" ? boardResult.displayFen : startFen ?? STANDARD_START_FEN
  const orientation = flipped ? (side === "white" ? "black" : "white") : side

  const canGenerate = startFen != null && !isBusy

  function handleGenerate() {
    if (!startFen) return
    const preset = SPEED_PRESETS[speed]
    void generate({
      startFen,
      openingName: mode === "opening" ? opening.name : "Custom Position",
      eco: mode === "opening" ? opening.eco : undefined,
      movetime: preset.movetime,
      speedLabel: preset.label,
    })
  }

  // When a generation finishes, seed a default save name and clear any prior
  // "saved" state so the user can save this fresh game.
  useEffect(() => {
    if (state.status === "done" && state.game) {
      setSaveName(`${state.game.title} (${new Date().toLocaleDateString()})`)
      setSavedId(null)
      setPromoteState("idle")
    }
  }, [state.status, state.game])

  async function handlePromote() {
    if (!state.game || promoteState === "saving" || promoteState === "done") return
    setPromoteState("saving")
    const res = await promoteToPool(state.game)
    setPromoteState(res.ok ? "done" : "error")
  }

  function handlePlay() {
    if (!state.game) return
    onStart({ game: state.game, side, startPly: 0 })
  }

  function handleSave() {
    if (!state.game || savedId) return
    const entry = saveGame({ game: state.game, side, name: saveName })
    setSavedId(entry.id)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col gap-7">
        {/* ── Hero ── */}
        <header className="relative overflow-hidden rounded-3xl p-7 md:p-8 text-white shadow-xl shadow-emerald-600/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500">
          <span className="pointer-events-none select-none absolute -right-5 -top-8 text-[150px] leading-none opacity-10">🤖</span>
          <p className="text-sm font-bold uppercase tracking-widest text-white/80">Training mode</p>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5">
            Generate a game
          </h1>
          <p className="text-white/95 text-lg md:text-xl font-semibold mt-1.5">
            Let the engine play itself — then solve it move by move.
          </p>
          <p className="text-white/85 text-sm md:text-base font-medium mt-2 max-w-2xl">
            Pick a starting position and a side. Stockfish plays both sides; the result
            becomes a Solitaire exercise where you predict your side&apos;s moves.
          </p>
        </header>

        <section className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          {/* ── Config column ── */}
          <div className="flex flex-col gap-5">
            {/* Start position */}
            <div className="rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex flex-col gap-4">
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                1 · Starting position
              </h2>
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-900/60 p-1">
                <ModeTab label="♟ Opening" active={mode === "opening"} onClick={() => setMode("opening")} disabled={isBusy} />
                <ModeTab label="⌨ Custom FEN" active={mode === "fen"} onClick={() => setMode("fen")} disabled={isBusy} />
                <ModeTab label="🎨 Set up board" active={mode === "board"} onClick={() => setMode("board")} disabled={isBusy} />
              </div>

              {mode === "board" ? (
                <SolitaireBoardEditor onChange={setBoardResult} />
              ) : mode === "opening" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Opening
                  </span>
                  <select
                    value={openingId}
                    onChange={(e) => setOpeningId(e.target.value)}
                    disabled={isBusy}
                    aria-label="Choose an opening"
                    className="appearance-none rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-50 cursor-pointer"
                  >
                    {OPENINGS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.eco ? ` (${o.eco})` : ""}
                      </option>
                    ))}
                  </select>
                  {opening.moves.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                      {opening.moves.join(" ")}
                    </span>
                  )}
                </label>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Paste a FEN
                  </span>
                  <textarea
                    value={fenInput}
                    onChange={(e) => setFenInput(e.target.value)}
                    disabled={isBusy}
                    rows={2}
                    placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    className="resize-none rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-3.5 py-2.5 text-xs font-mono text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-50"
                  />
                  {fenValidation.error && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">{fenValidation.error}</span>
                  )}
                  {fenValidation.fen && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Valid position</span>
                  )}
                </div>
              )}
            </div>

            {/* Side */}
            <div className="rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                2 · You solve as
              </h2>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-900/60 p-1">
                <ModeTab label="♔ White" active={side === "white"} onClick={() => setSide("white")} disabled={isBusy} />
                <ModeTab label="♚ Black" active={side === "black"} onClick={() => setSide("black")} disabled={isBusy} />
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                You&apos;ll predict every {side} move; the opponent&apos;s replies are played for you.
              </p>
            </div>

            {/* Speed */}
            <div className="rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-5 flex flex-col gap-3">
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                3 · Engine strength
              </h2>
              <div className="flex flex-col gap-2">
                {(Object.keys(SPEED_PRESETS) as SpeedId[]).map((id) => {
                  const p = SPEED_PRESETS[id]
                  return (
                    <button
                      key={id}
                      onClick={() => setSpeed(id)}
                      disabled={isBusy}
                      aria-pressed={speed === id}
                      className={clsx(
                        "text-left rounded-2xl border-2 p-3.5 transition-all flex items-center justify-between gap-3 disabled:opacity-50",
                        speed === id
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/20 shadow-sm"
                          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">{p.label}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{p.blurb}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {p.movetime} ms
                      </span>
                    </button>
                  )
                })}
              </div>
              {speed === "high" && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                  ⚠ High strength uses 10s per move, and games now run to their natural finish — this can take many minutes (sometimes 10+). You can cancel anytime.
                </p>
              )}
            </div>

            {state.status === "error" && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3">
                {state.error ?? "Something went wrong generating the game."}
              </p>
            )}

            {!isBusy && !isDone && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full bg-emerald-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#065f46,0_8px_20px_rgba(5,150,105,0.35)] hover:bg-emerald-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#065f46] active:translate-y-[4px] active:shadow-[0_1px_0_#065f46] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                ⚙ Generate game
              </button>
            )}
          </div>

          {/* ── Preview / progress column ── */}
          <div className="lg:sticky lg:top-4 flex flex-col gap-4 bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">
                {isBusy ? "Generating…" : isDone ? "Game ready" : "Preview"}
              </h2>
              {!isBusy && <FlipBoardButton onClick={() => setFlipped((f) => !f)} />}
            </div>

            {isBusy ? (
              /* No board / move list while generating — that would reveal the
                 moves the user is about to solve. Show only non-spoiling progress. */
              <div className="flex flex-col items-center justify-center gap-3 aspect-square w-full rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 px-6 text-center">
                <ChessMindLoader size="lg" label="Generating game" hideLabel />
                <p className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
                  {state.moveCount} {state.moveCount === 1 ? "move" : "moves"} played
                </p>
                <p className="font-mono text-sm text-gray-500 dark:text-slate-400 tabular-nums">
                  {formatClock(state.elapsedMs)} elapsed · {SPEED_PRESETS[speed].movetime} ms/move
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
                  The engine is playing both sides. The moves are hidden so they won&apos;t
                  spoil the puzzle — you&apos;ll solve them next.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden shadow-md">
                {mounted ? (
                  <Chessboard
                    options={{
                      position: previewFen,
                      boardOrientation: orientation,
                      allowDragging: false,
                      darkSquareStyle: { backgroundColor: BOARD_DARK },
                      lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                      showNotation: true,
                      id: "solitaire-generate-preview",
                    }}
                  />
                ) : (
                  <div className="aspect-square w-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                )}
              </div>
            )}

            {isBusy && (
              <button
                onClick={cancel}
                className="w-full font-display font-bold py-3 rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
              >
                ✕ Cancel generation
              </button>
            )}

            {isDone && state.game && (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex flex-col gap-1">
                  <p className="font-display font-extrabold text-emerald-800 dark:text-emerald-300">
                    Game ready — {state.moveCount} {state.moveCount === 1 ? "move" : "moves"}
                  </p>
                  <p className="text-xs text-emerald-700/90 dark:text-emerald-300/80">
                    {state.game.opening} · solved in {formatClock(state.elapsedMs)}. The board shows the
                    starting position; the moves stay hidden until you play.
                  </p>
                </div>

                {/* Save for later (does not block the Play handoff) */}
                <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 dark:border-slate-700 p-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    Save for later
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => {
                        setSaveName(e.target.value)
                        setSavedId(null)
                      }}
                      disabled={savedId != null}
                      aria-label="Saved game name"
                      className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 px-3 py-2 text-sm font-medium text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition disabled:opacity-60"
                    />
                    <button
                      onClick={handleSave}
                      disabled={savedId != null}
                      className={clsx(
                        "shrink-0 font-display font-bold text-sm px-4 rounded-xl transition-all",
                        savedId != null
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 cursor-default"
                          : "bg-emerald-600 text-white hover:bg-emerald-700",
                      )}
                    >
                      {savedId != null ? "Saved ✓" : "Save game"}
                    </button>
                  </div>
                </div>

                {/* Share to the multiplayer pool so everyone can compete on it */}
                <div className="flex flex-col gap-2 rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-900/15 p-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-rose-500 dark:text-rose-400">
                    ⚔️ Multiplayer
                  </span>
                  <p className="text-xs text-rose-700/90 dark:text-rose-300/80">
                    Add this game to the shared pool so other players can compete on it and you all rank up.
                  </p>
                  <button
                    onClick={handlePromote}
                    disabled={promoteState === "saving" || promoteState === "done"}
                    className={clsx(
                      "font-display font-bold text-sm py-2.5 rounded-xl transition-all",
                      promoteState === "done"
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 cursor-default"
                        : "bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60",
                    )}
                  >
                    {promoteState === "saving"
                      ? "Adding…"
                      : promoteState === "done"
                        ? "Added to pool ✓"
                        : promoteState === "error"
                          ? "Couldn’t add — tap to retry"
                          : "⚔️ Add to multiplayer pool"}
                  </button>
                </div>

                <button
                  onClick={handlePlay}
                  className="w-full bg-indigo-600 text-white font-display font-extrabold text-lg py-3.5 rounded-2xl shadow-[0_5px_0_#312e81,0_8px_20px_rgba(79,70,229,0.35)] hover:bg-indigo-700 hover:translate-y-[2px] hover:shadow-[0_3px_0_#312e81] active:translate-y-[4px] active:shadow-[0_1px_0_#312e81] transition-all"
                >
                  ▶ Play as {side}
                </button>
                <button
                  onClick={reset}
                  className="w-full font-display font-bold py-2.5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:border-emerald-300 transition-all"
                >
                  ↺ Generate another
                </button>
              </div>
            )}

            {state.status === "cancelled" && (
              <button
                onClick={reset}
                className="w-full font-display font-bold py-3 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-emerald-300 transition-all"
              >
                ↺ Start over
              </button>
            )}

            {!isBusy && !isDone && state.status !== "cancelled" && (
              <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                The board shows your chosen starting position.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function ModeTab({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2 text-sm font-bold transition disabled:opacity-50",
        active
          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}
