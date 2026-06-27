// lib/analysis/saved-analyses.ts
// SSR-safe localStorage persistence for user-saved Free Analysis studies, so a
// position + its full variation tree can be reopened later. Mirrors the
// Solitaire saved-games storage style (save/list/get/rename/delete). The
// MoveTree is plain JSON (rootFen + nested children), so it serializes verbatim
// and restores exactly. Never throws; degrades to no-ops without localStorage.

import type { MoveTree } from "./move-tree"

const STORAGE_KEY = "chessmind-saved-analyses"

export interface SavedAnalysis {
  /** Unique id for this saved entry. */
  id: string
  /** User-facing display name. */
  name: string
  /** Starting position of the study (same as tree.rootFen, stored for clarity). */
  startFen: string
  /** The full variation tree, preserved verbatim for exact restore. */
  tree: MoveTree
  /** Cursor path at save time, so reopening lands on the same move. */
  cursorPath: number[]
  /** Snapshot of the current eval text (e.g. "+1.32", "M3"), if available. */
  evalText: string | null
  /** ISO timestamp of when it was saved. */
  savedAt: string
}

function readAll(): SavedAnalysis[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedAnalysis[]) : []
  } catch {
    return []
  }
}

function writeAll(list: SavedAnalysis[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function makeId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** All saved analyses, newest first. */
export function listSavedAnalyses(): SavedAnalysis[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getSavedAnalysis(id: string): SavedAnalysis | null {
  return readAll().find((a) => a.id === id) ?? null
}

/**
 * Persist a study under a display name. Returns the new saved entry (with its
 * generated id + savedAt). Newest entries sort first.
 */
export function saveAnalysis(input: {
  name: string
  tree: MoveTree
  cursorPath: number[]
  evalText: string | null
}): SavedAnalysis {
  const entry: SavedAnalysis = {
    id: makeId(),
    name: input.name.trim() || "Untitled analysis",
    startFen: input.tree.rootFen,
    tree: input.tree,
    cursorPath: input.cursorPath,
    evalText: input.evalText,
    savedAt: new Date().toISOString(),
  }
  const list = readAll()
  list.push(entry)
  writeAll(list)
  return entry
}

/** Rename a saved analysis by id. Returns the updated list (newest first). */
export function renameSavedAnalysis(id: string, name: string): SavedAnalysis[] {
  const trimmed = name.trim()
  const next = readAll().map((a) =>
    a.id === id ? { ...a, name: trimmed || a.name } : a,
  )
  writeAll(next)
  return next.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Remove a saved analysis by id. Returns the remaining list (newest first). */
export function deleteSavedAnalysis(id: string): SavedAnalysis[] {
  const next = readAll().filter((a) => a.id !== id)
  writeAll(next)
  return next.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}
