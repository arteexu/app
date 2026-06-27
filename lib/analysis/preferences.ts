// lib/analysis/preferences.ts
// SSR-safe localStorage preferences scoped to the Free Analysis feature, plus a
// tiny pub/sub so components can subscribe via useSyncExternalStore (mirrors the
// board/sound preference pattern, but kept local to analysis to avoid touching
// the shared board-preferences provider / engine libs). Never throws.

export const ENGINE_ARROW_KEY = "chessmind-analysis-engine-arrow"
export const MULTIPV_KEY = "chessmind-analysis-multipv"

export const MIN_MULTIPV = 1
export const MAX_MULTIPV = 3

let listeners: Array<() => void> = []

/** Subscribe to preference changes (for useSyncExternalStore). */
export function subscribeAnalysisPreferences(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function emitChange() {
  for (const listener of listeners) listener()
}

/** Whether the engine's top-move arrow(s) are drawn on the board. Default ON. */
export function getEngineArrowEnabled(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(ENGINE_ARROW_KEY) !== "false"
}

export function setEngineArrowEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ENGINE_ARROW_KEY, enabled ? "true" : "false")
    } catch {
      /* quota / privacy mode — ignore */
    }
  }
  emitChange()
}

/** How many principal variations (MultiPV) to request/show: 1, 2, or 3. */
export function getMultiPv(): number {
  if (typeof window === "undefined") return MIN_MULTIPV
  const raw = Number(window.localStorage.getItem(MULTIPV_KEY))
  if (!Number.isFinite(raw)) return MIN_MULTIPV
  return Math.min(MAX_MULTIPV, Math.max(MIN_MULTIPV, Math.round(raw)))
}

export function setMultiPv(value: number): void {
  const clamped = Math.min(MAX_MULTIPV, Math.max(MIN_MULTIPV, Math.round(value)))
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MULTIPV_KEY, String(clamped))
    } catch {
      /* quota / privacy mode — ignore */
    }
  }
  emitChange()
}
