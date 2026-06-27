"use client"
// components/play/PromotionPicker.tsx
// A small overlay shown when a pawn move reaches the last rank, letting the player
// pick the promotion piece (queen / rook / bishop / knight) — full chess supports
// underpromotion, so we never silently auto-queen.

import type { PieceColor } from "@/lib/play/types"

const PIECES: { id: "q" | "r" | "b" | "n"; whiteGlyph: string; blackGlyph: string; label: string }[] = [
  { id: "q", whiteGlyph: "♕", blackGlyph: "♛", label: "Queen" },
  { id: "r", whiteGlyph: "♖", blackGlyph: "♜", label: "Rook" },
  { id: "b", whiteGlyph: "♗", blackGlyph: "♝", label: "Bishop" },
  { id: "n", whiteGlyph: "♘", blackGlyph: "♞", label: "Knight" },
]

export function PromotionPicker({
  color,
  onChoose,
  onCancel,
}: {
  color: PieceColor
  onChoose: (piece: "q" | "r" | "b" | "n") => void
  onCancel: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center bg-slate-900/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex gap-2 rounded-2xl bg-white dark:bg-slate-800 p-3 shadow-xl border border-gray-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose promotion piece"
      >
        {PIECES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChoose(p.id)}
            aria-label={`Promote to ${p.label}`}
            title={p.label}
            className="w-14 h-14 grid place-items-center text-4xl rounded-xl bg-gray-50 dark:bg-slate-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border-2 border-transparent hover:border-indigo-400 transition"
          >
            <span className={color === "white" ? "text-gray-900" : "text-gray-900 dark:text-slate-100"}>
              {color === "white" ? p.whiteGlyph : p.blackGlyph}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
