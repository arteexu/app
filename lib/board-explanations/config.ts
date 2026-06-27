// lib/board-explanations/config.ts
// Feature flags for the on-board explanation layer (square markers + popovers
// that move the "why" of a move onto the board, decluttering the side panel).

/**
 * Master switch for the on-board explanation experience. When false, lessons
 * fall back to the classic always-on right-panel explanation prose and the
 * concept/pattern cards render expanded (no behavior change). Flip to disable
 * everywhere without touching component code.
 */
export const BOARD_EXPLANATIONS_ENABLED = true

/**
 * When true, derive a fallback on-board marker from the solved line (the last
 * move's destination square) for steps that have no explicit `boardAnnotations`.
 * Keeps the feature useful on existing lessons without new authoring.
 */
export const BOARD_EXPLANATIONS_FALLBACK = true
