export const SHOW_LEGAL_MOVES_KEY = "chessmind-show-legal-moves"
export const BOARD_SOUNDS_KEY = "chessmind-board-sounds-enabled"

export function getShowLegalMoves(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(SHOW_LEGAL_MOVES_KEY) !== "false"
}

export function setShowLegalMoves(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SHOW_LEGAL_MOVES_KEY, enabled ? "true" : "false")
}

export function getBoardSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true
  // Board move/capture/check sounds are functional audio feedback, not motion,
  // so they are NOT gated by prefers-reduced-motion. Use the explicit toggle.
  return localStorage.getItem(BOARD_SOUNDS_KEY) !== "false"
}

export function setBoardSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BOARD_SOUNDS_KEY, enabled ? "true" : "false")
}
