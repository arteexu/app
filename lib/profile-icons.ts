// lib/profile-icons.ts — curated chess-themed avatar icons for user profiles.
// The chosen glyph is stored directly in profiles.avatar_icon (text). Storing the
// glyph (rather than an id) keeps the nav avatar render trivial. We still validate
// against this allow-list before persisting so only curated icons are saved.

export interface ProfileIcon {
  /** The glyph stored in the DB and rendered in the avatar. */
  glyph: string
  /** Accessible label describing the icon. */
  label: string
}

export const PROFILE_ICONS: ProfileIcon[] = [
  { glyph: "♔", label: "White king" },
  { glyph: "♕", label: "White queen" },
  { glyph: "♖", label: "White rook" },
  { glyph: "♗", label: "White bishop" },
  { glyph: "♘", label: "White knight" },
  { glyph: "♙", label: "White pawn" },
  { glyph: "♚", label: "Black king" },
  { glyph: "♛", label: "Black queen" },
  { glyph: "♜", label: "Black rook" },
  { glyph: "♝", label: "Black bishop" },
  { glyph: "♞", label: "Black knight" },
  { glyph: "♟", label: "Black pawn" },
  { glyph: "🐴", label: "Knight horse" },
  { glyph: "👑", label: "Crown" },
  { glyph: "🏆", label: "Trophy" },
  { glyph: "⚔️", label: "Crossed swords" },
  { glyph: "🧠", label: "Strategist" },
  { glyph: "🔥", label: "On fire" },
]

const VALID_GLYPHS = new Set(PROFILE_ICONS.map((i) => i.glyph))

/** Returns the icon glyph only if it is part of the curated set, else null. */
export function resolveProfileIcon(value: string | null | undefined): string | null {
  if (value && VALID_GLYPHS.has(value)) return value
  return null
}
