// lib/insights/saved-insights.ts
// SSR-safe localStorage persistence for GENERATED game insights, so the (often
// slow, Deep-mode) coach analysis can be saved once and revisited later without
// re-running the engine. This mirrors the existing saved-game stores
// (lib/play/saved-play-games.ts, lib/solitaire/saved-games.ts): the app keeps
// game/replay data in localStorage, so insights live alongside it the same way.
//
// The stored payload is the SAME computed GameInsights object the live pipeline
// produces (notable moves, aggregated concepts/patterns/motifs, the game-summary
// report, motif practice sources, and the analysis mode used). It is plain JSON
// — re-rendering a saved record needs no engine, no network. Records are keyed by
// a stable `gameKey` so the surface that generated them re-loads them later.
//
// Never throws; degrades to no-ops when window/localStorage is unavailable.

import type { AnalysisDepthMode } from "./analyze-game"

const STORAGE_KEY = "chessmind-saved-insights"
/** Bump when the payload shape changes incompatibly — old records are ignored. */
export const SAVED_INSIGHTS_VERSION = 1

export type InsightsSurface = "play" | "solitaire"

/** A persisted insights record. `payload` is the surface's GameInsights object. */
export interface StoredInsightsRecord<TPayload = unknown> {
  gameKey: string
  surface: InsightsSurface
  version: number
  /** Analysis depth used to produce these insights ("standard" | "deep"). */
  mode: AnalysisDepthMode
  savedAt: string
  /** Human label for any future list UI (e.g. the game name). */
  label: string
  /** Quick stats for list/badge rendering without parsing the payload. */
  notableCount: number
  analyzedCount: number
  payload: TPayload
}

type Store = Record<string, StoredInsightsRecord>

function readStore(): Store {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return parsed as Store
  } catch {
    return {}
  }
}

function writeStore(store: Store): boolean {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    // quota / privacy mode — saving silently fails (caller surfaces an error).
    return false
  }
}

/** Get the saved insights for a game key, or null. Drops version-mismatched rows. */
export function getSavedInsights<TPayload = unknown>(
  gameKey: string,
): StoredInsightsRecord<TPayload> | null {
  const rec = readStore()[gameKey]
  if (!rec) return null
  if (rec.version !== SAVED_INSIGHTS_VERSION) return null
  return rec as StoredInsightsRecord<TPayload>
}

export function hasSavedInsights(gameKey: string): boolean {
  return getSavedInsights(gameKey) !== null
}

export interface SaveInsightsInput<TPayload> {
  gameKey: string
  surface: InsightsSurface
  mode: AnalysisDepthMode
  label: string
  notableCount: number
  analyzedCount: number
  payload: TPayload
}

/** Upsert insights for a game key. Returns true on success (false if storage failed). */
export function saveInsights<TPayload>(input: SaveInsightsInput<TPayload>): boolean {
  const store = readStore()
  store[input.gameKey] = {
    gameKey: input.gameKey,
    surface: input.surface,
    version: SAVED_INSIGHTS_VERSION,
    mode: input.mode,
    savedAt: new Date().toISOString(),
    label: input.label,
    notableCount: input.notableCount,
    analyzedCount: input.analyzedCount,
    payload: input.payload,
  }
  return writeStore(store)
}

/** Remove saved insights for a game key. Returns true on success. */
export function deleteSavedInsights(gameKey: string): boolean {
  const store = readStore()
  if (!(gameKey in store)) return true
  delete store[gameKey]
  return writeStore(store)
}

/** All saved insight records, newest first. */
export function listSavedInsights(): StoredInsightsRecord[] {
  return Object.values(readStore())
    .filter((r) => r.version === SAVED_INSIGHTS_VERSION)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/**
 * Build a stable game key from a game's content. Used when no natural saved-game
 * id exists (e.g. an uploaded /review PGN): the same moves always hash the same,
 * so re-opening that game re-loads its saved insights. `scope` namespaces keys so
 * identical move lists on different surfaces never collide.
 */
export function gameKeyFromContent(scope: string, parts: readonly string[]): string {
  // FNV-1a 32-bit over the joined content — fast, dependency-free, stable.
  let h = 0x811c9dc5
  const str = parts.join("|")
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const hash = (h >>> 0).toString(36)
  return `${scope}:${hash}`
}
