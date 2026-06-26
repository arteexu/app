"use client"
// components/solitaire/SolitaireBoardEditor.tsx
// A lightweight position editor built on the same react-chessboard used by the
// Solitaire player / Free Analysis. The user arms a piece (or the eraser) from a
// palette and clicks squares to place/remove pieces; existing pieces can also be
// dragged to rearrange or dragged off the board to delete. It tracks side-to-move
// and castling rights, continuously derives a FEN, validates it with chess.js,
// and reports both a render-able display FEN and the valid FEN (or null) to the
// parent via onChange.

import { useEffect, useMemo, useState } from "react"
import { Chess } from "chess.js"
import { Chessboard, defaultPieces } from "react-chessboard"
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard"
import { clsx } from "clsx"
import { FlipBoardButton } from "./FlipBoardButton"

const BOARD_DARK = "#769656"
const BOARD_LIGHT = "#eeeed2"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]

/** Standard starting placement as a square → FEN-char map. */
function standardPieces(): Record<string, string> {
  const map: Record<string, string> = {}
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"]
  FILES.forEach((f, i) => {
    map[`${f}8`] = back[i]
    map[`${f}7`] = "p"
    map[`${f}2`] = "P"
    map[`${f}1`] = back[i].toUpperCase()
  })
  return map
}

/** FEN piece char → react-chessboard piece code (e.g. "P" → "wP", "k" → "bK"). */
function toPieceCode(ch: string): string {
  const color = ch === ch.toUpperCase() ? "w" : "b"
  return `${color}${ch.toUpperCase()}`
}

/** Build the FEN placement field (rank 8 → 1) from the piece map. */
function buildBoardField(pieces: Record<string, string>): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ""
    let empty = 0
    for (const file of FILES) {
      const ch = pieces[`${file}${rank}`]
      if (ch) {
        if (empty) {
          row += empty
          empty = 0
        }
        row += ch
      } else {
        empty++
      }
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join("/")
}

type Castling = { K: boolean; Q: boolean; k: boolean; q: boolean }

function castlingField(c: Castling): string {
  const s = `${c.K ? "K" : ""}${c.Q ? "Q" : ""}${c.k ? "k" : ""}${c.q ? "q" : ""}`
  return s.length > 0 ? s : "-"
}

export interface BoardEditorResult {
  /** Valid FEN ready for the engine, or null when the position is illegal. */
  fen: string | null
  /** Always-render-able FEN (placement may be illegal) for the board preview. */
  displayFen: string
  error: string | null
}

interface Props {
  onChange: (result: BoardEditorResult) => void
}

type Tool = string | "erase"

// Palette layout: white pieces, black pieces, then the eraser.
const WHITE_TOOLS = ["K", "Q", "R", "B", "N", "P"]
const BLACK_TOOLS = ["k", "q", "r", "b", "n", "p"]

export function SolitaireBoardEditor({ onChange }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [pieces, setPieces] = useState<Record<string, string>>(() => standardPieces())
  const [sideToMove, setSideToMove] = useState<"w" | "b">("w")
  const [castling, setCastling] = useState<Castling>({ K: true, Q: true, k: true, q: true })
  const [tool, setTool] = useState<Tool>("P")
  const [orientation, setOrientation] = useState<"white" | "black">("white")

  const { displayFen, validFen, error } = useMemo(() => {
    const field = buildBoardField(pieces)
    const display = `${field} ${sideToMove} ${castlingField(castling)} - 0 1`

    const whiteKings = Object.values(pieces).filter((p) => p === "K").length
    const blackKings = Object.values(pieces).filter((p) => p === "k").length
    if (whiteKings !== 1 || blackKings !== 1) {
      return {
        displayFen: display,
        validFen: null as string | null,
        error: "Each side needs exactly one king.",
      }
    }
    // chess.js accepts a structurally-valid FEN but does NOT reject a position
    // where the side NOT to move is in check (an illegal "you could capture the
    // king" position). Probe for that by flipping the side to move and asking
    // whether that side is in check.
    const opponent = sideToMove === "w" ? "b" : "w"
    try {
      const probe = new Chess(`${field} ${opponent} - - 0 1`)
      if (probe.inCheck()) {
        return {
          displayFen: display,
          validFen: null as string | null,
          error: "Illegal position — the side not to move is left in check.",
        }
      }
    } catch {
      /* fall through to the main validation below for a clearer message */
    }

    try {
      const c = new Chess(display)
      return { displayFen: display, validFen: c.fen(), error: null as string | null }
    } catch {
      return {
        displayFen: display,
        validFen: null as string | null,
        error:
          "Illegal position — check the side to move and that no pawns sit on the back ranks.",
      }
    }
  }, [pieces, sideToMove, castling])

  // Report up whenever the derived position changes.
  useEffect(() => {
    onChange({ fen: validFen, displayFen, error })
  }, [validFen, displayFen, error, onChange])

  function placeOn(square: string) {
    setPieces((prev) => {
      const next = { ...prev }
      if (tool === "erase") {
        delete next[square]
      } else {
        next[square] = tool
      }
      return next
    })
  }

  function handleSquareClick({ square }: SquareHandlerArgs) {
    placeOn(square)
  }

  function handleSquareRightClick({ square }: SquareHandlerArgs) {
    setPieces((prev) => {
      if (!prev[square]) return prev
      const next = { ...prev }
      delete next[square]
      return next
    })
  }

  // Drag an existing piece to rearrange; drop off-board to delete.
  function handlePieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    setPieces((prev) => {
      const moving = prev[sourceSquare]
      if (!moving) return prev
      const next = { ...prev }
      delete next[sourceSquare]
      if (targetSquare) next[targetSquare] = moving
      return next
    })
    return true
  }

  function clearBoard() {
    setPieces({})
    setCastling({ K: false, Q: false, k: false, q: false })
  }

  function resetToStart() {
    setPieces(standardPieces())
    setSideToMove("w")
    setCastling({ K: true, Q: true, k: true, q: true })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Board */}
      <div className="rounded-2xl overflow-hidden shadow-md" onContextMenu={(e) => e.preventDefault()}>
        {mounted ? (
          <Chessboard
            options={{
              position: displayFen,
              boardOrientation: orientation,
              allowDragging: true,
              allowDragOffBoard: true,
              darkSquareStyle: { backgroundColor: BOARD_DARK },
              lightSquareStyle: { backgroundColor: BOARD_LIGHT },
              showNotation: true,
              id: "solitaire-board-editor",
              onSquareClick: handleSquareClick,
              onSquareRightClick: handleSquareRightClick,
              onPieceDrop: handlePieceDrop,
            }}
          />
        ) : (
          <div className="aspect-square w-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
        )}
      </div>

      {/* Palette */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          Click a piece, then click squares to place it
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {WHITE_TOOLS.map((p) => (
            <PaletteButton key={p} pieceCode={toPieceCode(p)} active={tool === p} onClick={() => setTool(p)} />
          ))}
          {BLACK_TOOLS.map((p) => (
            <PaletteButton key={p} pieceCode={toPieceCode(p)} active={tool === p} onClick={() => setTool(p)} />
          ))}
          <button
            onClick={() => setTool("erase")}
            aria-pressed={tool === "erase"}
            title="Eraser — click squares to remove pieces"
            className={clsx(
              "h-9 px-3 rounded-lg border-2 text-sm font-bold transition",
              tool === "erase"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-emerald-300",
            )}
          >
            🧽 Erase
          </button>
          <FlipBoardButton
            onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
            className="ml-auto"
          />
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500">
          Tip: drag a piece to move it, drag it off the board to remove it, or right-click a square to clear it.
        </p>
      </div>

      {/* Board controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={resetToStart}
          className="flex-1 min-w-[8rem] font-display font-bold text-sm py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-emerald-300 transition"
        >
          ↺ Reset to start
        </button>
        <button
          onClick={clearBoard}
          className="flex-1 min-w-[8rem] font-display font-bold text-sm py-2 rounded-xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition"
        >
          ✕ Clear board
        </button>
      </div>

      {/* Side to move + castling */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
            Side to move
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-slate-900/60 p-1">
            <SegButton label="♔ White" active={sideToMove === "w"} onClick={() => setSideToMove("w")} />
            <SegButton label="♚ Black" active={sideToMove === "b"} onClick={() => setSideToMove("b")} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
            Castling rights
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(["K", "Q", "k", "q"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setCastling((c) => ({ ...c, [key]: !c[key] }))}
                aria-pressed={castling[key]}
                title={`${key === key.toUpperCase() ? "White" : "Black"} ${key.toUpperCase() === "K" ? "kingside" : "queenside"}`}
                className={clsx(
                  "h-9 w-9 rounded-lg border-2 text-sm font-bold font-mono transition",
                  castling[key]
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 hover:border-emerald-300",
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status */}
      {error ? (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Valid position</p>
      )}
    </div>
  )
}

function PaletteButton({
  pieceCode,
  active,
  onClick,
}: {
  pieceCode: string
  active: boolean
  onClick: () => void
}) {
  // Render the SAME piece SVG the board uses (react-chessboard's defaultPieces),
  // so palette colors are pixel-identical to placed pieces.
  const renderPiece = defaultPieces[pieceCode]
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={pieceCode}
      className={clsx(
        "h-9 w-9 rounded-lg border-2 p-1 flex items-center justify-center transition",
        active
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30"
          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300",
      )}
    >
      <span className="block h-full w-full">{renderPiece ? renderPiece() : null}</span>
    </button>
  )
}

function SegButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-lg py-1.5 text-sm font-bold transition",
        active
          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}
