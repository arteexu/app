import { Chess } from "chess.js"

/** Move-quality marker for lesson steps. Named aliases or standard NAG glyphs. */
export type MoveQuality =
  | "brilliant"
  | "good"
  | "interesting"
  | "dubious"
  | "mistake"
  | "blunder"
  | "!!"
  | "!"
  | "!?"
  | "?!"
  | "?"
  | "??"

export interface MoveQualityStyle {
  glyph: string
  /** CSS class applied to the piece on the destination square. */
  pieceBadgeClass: string
  /** Tailwind text color classes for move notation. */
  notationClassName: string
}

const BRILLIANT: MoveQualityStyle = {
  glyph: "!!",
  pieceBadgeClass: "move-quality-brilliant",
  notationClassName: "text-violet-600 dark:text-violet-400",
}

const DUBIOUS: MoveQualityStyle = {
  glyph: "?",
  pieceBadgeClass: "move-quality-dubious",
  notationClassName: "text-orange-600 dark:text-orange-400",
}

const GOOD: MoveQualityStyle = {
  glyph: "!",
  pieceBadgeClass: "move-quality-good",
  notationClassName: "text-emerald-600 dark:text-emerald-400",
}

const INTERESTING: MoveQualityStyle = {
  glyph: "!?",
  pieceBadgeClass: "move-quality-interesting",
  notationClassName: "text-amber-600 dark:text-amber-400",
}

const MISTAKE: MoveQualityStyle = {
  glyph: "?",
  pieceBadgeClass: "move-quality-mistake",
  notationClassName: "text-orange-600 dark:text-orange-400",
}

const BLUNDER: MoveQualityStyle = {
  glyph: "??",
  pieceBadgeClass: "move-quality-blunder",
  notationClassName: "text-red-600 dark:text-red-400",
}

const QUALITY_ALIASES: Record<string, MoveQualityStyle> = {
  brilliant: BRILLIANT,
  good: GOOD,
  interesting: INTERESTING,
  dubious: DUBIOUS,
  mistake: MISTAKE,
  blunder: BLUNDER,
  "!!": BRILLIANT,
  "!": GOOD,
  "!?": INTERESTING,
  "?!": DUBIOUS,
  "?": MISTAKE,
  "??": BLUNDER,
}

export function moveQualityStyle(quality: MoveQuality): MoveQualityStyle {
  return QUALITY_ALIASES[quality] ?? MISTAKE
}

export function moveQualitySuffix(quality: MoveQuality): string {
  return moveQualityStyle(quality).glyph
}

/** Destination square after playing moves[0..moveIndex] from startFen. */
export function destinationSquareForMove(
  startFen: string,
  moves: string[],
  moveIndex: number,
): string | null {
  const game = new Chess(startFen)
  let result
  for (let i = 0; i <= moveIndex; i++) {
    try {
      result = game.move(moves[i])
    } catch {
      return null
    }
  }
  return result?.to ?? null
}
