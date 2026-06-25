import type { Chess, Square } from "chess.js"

// react-chessboard defaults the dnd-kit drag activation distance to 1px, so a
// tiny pointer jitter during a fast click activates a drag and swallows the
// native click (onSquareClick never fires → the piece won't select). Bumping it
// to 10px lets quick clicks register as clicks while real drags (>10px) work.
export const DRAG_ACTIVATION_DISTANCE = 10

// Brief tactile jitter when a piece is click-latched (selected).
export const PIECE_LATCH_DURATION_MS = 200
export const PIECE_LATCH_CLASS = "piece-latch"

export function buildLegalMoveSquareStyles(
  game: Chess,
  square: string,
): Record<string, React.CSSProperties> {
  const moves = game.moves({ square: square as Square, verbose: true })
  const hl: Record<string, React.CSSProperties> = {
    [square]: { backgroundColor: "rgba(99,102,241,0.4)" },
  }
  for (const move of moves) {
    hl[move.to] = { backgroundColor: "rgba(99,102,241,0.2)", borderRadius: "50%" }
  }
  return hl
}

// ── Shared board highlight palette ──────────────────────────────────────────
// Selection: a clear "slightly yellow" tint on the clicked piece's square.
// Shown on click regardless of the show-legal-moves preference.
export const SELECTED_SQUARE_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(250, 204, 21, 0.5)",
}

// Last move: chess.com-style translucent amber on the move's from/to squares.
// Slightly more saturated than selection so the two reads remain distinct.
const LAST_MOVE_FROM_STYLE: React.CSSProperties = { backgroundColor: "rgba(245, 158, 11, 0.22)" }
const LAST_MOVE_TO_STYLE: React.CSSProperties = { backgroundColor: "rgba(245, 158, 11, 0.4)" }

export function buildSelectionStyles(square?: string | null): Record<string, React.CSSProperties> {
  if (!square) return {}
  return { [square]: { ...SELECTED_SQUARE_STYLE } }
}

export function buildLastMoveStyles(
  from?: string | null,
  to?: string | null,
): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {}
  if (from) styles[from] = { ...LAST_MOVE_FROM_STYLE }
  if (to) styles[to] = { ...LAST_MOVE_TO_STYLE }
  return styles
}

// User highlight: right-click marker (chess.com/lichess style). A translucent
// red, deliberately distinct from selection (yellow), legal dots (indigo) and
// last-move (amber) — and from the green/cream board itself, so a green tint
// would blend on the dark squares. Generic + reusable for any board.
//
// Touch: a long-press fires a native `contextmenu` event on most mobile
// browsers, which react-chessboard routes to `onSquareRightClick`, so toggling
// works there for free. TODO: dedicated long-press touch handling isn't exposed
// by react-chessboard's options API (no per-square touch/long-press hook), so
// devices that don't emit `contextmenu` on long-press won't toggle highlights.
export const USER_HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(235, 97, 80, 0.65)",
}

export function buildUserHighlightStyles(squares: string[]): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {}
  for (const square of squares) styles[square] = { ...USER_HIGHLIGHT_STYLE }
  return styles
}

// Wrong-move feedback: inset red ring — distinct from user right-click markers (flat fill).
const WRONG_MOVE_FROM_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(220, 38, 38, 0.35)",
  boxShadow: "inset 0 0 0 3px rgba(185, 28, 28, 0.9)",
}
const WRONG_MOVE_TO_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(220, 38, 38, 0.5)",
  boxShadow: "inset 0 0 0 3px rgba(185, 28, 28, 0.9)",
}

export function buildWrongMoveStyles(
  from?: string | null,
  to?: string | null,
): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {}
  if (from) styles[from] = { ...WRONG_MOVE_FROM_STYLE }
  if (to) styles[to] = { ...WRONG_MOVE_TO_STYLE }
  return styles
}

// Toggle a square in a user-highlight list (add if absent, remove if present).
// Centralised so every board's right-click behaviour stays identical.
// Boards wire this through useUserSquareHighlightHandlers so highlights work
// on arrow destination squares (react-chessboard suppresses contextmenu there).
export function toggleUserHighlight(squares: string[], square: string): string[] {
  return squares.includes(square)
    ? squares.filter(s => s !== square)
    : [...squares, square]
}

// Layer several square-style maps, with later layers winning per square.
// Styles for the same square are shallow-merged so e.g. a dot's borderRadius
// can combine with a fill from a lower layer.
export function composeSquareStyles(
  ...layers: (Record<string, React.CSSProperties> | undefined | null)[]
): Record<string, React.CSSProperties> {
  const out: Record<string, React.CSSProperties> = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const square of Object.keys(layer)) {
      out[square] = { ...out[square], ...layer[square] }
    }
  }
  return out
}
