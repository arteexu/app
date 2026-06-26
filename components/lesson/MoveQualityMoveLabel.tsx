import { clsx } from "clsx"
import type { MoveQuality } from "@/lib/move-quality"
import { moveQualityStyle } from "@/lib/move-quality"
import { SanNotation } from "@/components/chess/SanNotation"
import type { PieceColor } from "@/lib/san-notation"

interface Props {
  san: string
  quality?: MoveQuality
  className?: string
  color?: PieceColor
  ply?: number
  startWhite?: boolean
  fen?: string
  moveIndex?: number
}

/** Renders SAN with optional move-quality color and suffix (e.g. Nxf7!!, Nxd5?). */
export function MoveQualityMoveLabel({
  san,
  quality,
  className,
  color,
  ply,
  startWhite,
  fen,
  moveIndex,
}: Props) {
  const notation = (
    <SanNotation
      san={san}
      color={color}
      ply={ply}
      startWhite={startWhite}
      fen={fen}
      moveIndex={moveIndex}
      className={className}
    />
  )

  if (!quality) {
    return notation
  }

  const { glyph, notationClassName } = moveQualityStyle(quality)

  return (
    <span className={clsx(notationClassName)}>
      {notation}
      <span className="font-bold">{glyph}</span>
    </span>
  )
}
