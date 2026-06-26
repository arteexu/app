"use client"

import { clsx } from "clsx"
import { defaultPieces } from "react-chessboard"
import {
  colorForMoveIndex,
  colorFromPly,
  colorFromSide,
  parseSanSegments,
  type PieceColor,
} from "@/lib/san-notation"

interface Props {
  san: string
  /** Explicit piece color. Prefer `color`, or derive via `ply` / `fen`+`moveIndex`. */
  color?: PieceColor
  /** 0-based ply; color alternates from `startWhite` (default true). */
  ply?: number
  startWhite?: boolean
  /** Starting FEN + move index within a line (e.g. lesson continuation). */
  fen?: string
  moveIndex?: number
  /** Side to move for a single candidate move from `fen`. */
  side?: "w" | "b" | "white" | "black"
  className?: string
  /** `default` = text-sm; `compact` = text-xs; `inherit` = match parent font-size. */
  size?: "default" | "compact" | "inherit"
  /** Legacy px override; prefer `size` + em-based icons. */
  iconSize?: number
  /** Override accessible label (defaults to full SAN). */
  ariaLabel?: string
}

const SIZE_CLASS = {
  default: "text-sm",
  compact: "text-xs",
  inherit: "",
} as const

function resolveColor({
  color,
  ply,
  startWhite,
  fen,
  moveIndex,
  side,
}: Pick<Props, "color" | "ply" | "startWhite" | "fen" | "moveIndex" | "side">): PieceColor {
  if (color) return color
  if (side === "w" || side === "white") return "white"
  if (side === "b" || side === "black") return "black"
  if (fen != null && moveIndex != null) return colorForMoveIndex(fen, moveIndex)
  if (ply != null) return colorFromPly(ply, startWhite ?? true)
  return "white"
}

function PieceIcon({ pieceType, px }: { pieceType: string; px?: number }) {
  const Piece = defaultPieces[pieceType]
  if (!Piece) return null
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      style={
        px != null
          ? { width: px, height: px, transform: "translateY(0.08em)" }
          : { width: "1.12em", height: "1.12em", transform: "translateY(0.08em)" }
      }
      aria-hidden
    >
      <Piece />
    </span>
  )
}

/** Renders SAN with piece letters replaced by board-style piece icons. */
export function SanNotation({
  san,
  color,
  ply,
  startWhite,
  fen,
  moveIndex,
  side,
  className,
  size = "default",
  iconSize,
  ariaLabel,
}: Props) {
  const pieceColor = resolveColor({ color, ply, startWhite, fen, moveIndex, side })
  const segments = parseSanSegments(san, pieceColor)

  return (
    <span
      className={clsx(
        "inline-flex items-baseline gap-0.5 font-mono tabular-nums leading-none",
        SIZE_CLASS[size],
        className,
      )}
      aria-label={ariaLabel ?? san}
    >
      {segments.map((seg, i) =>
        seg.type === "piece" ? (
          <PieceIcon key={i} pieceType={seg.pieceType} px={iconSize} />
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  )
}
