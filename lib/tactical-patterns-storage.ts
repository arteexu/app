const STORAGE_KEY = "chessmind-tactical-patterns-unlocked"

function readUnlocked(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [])
  } catch {
    return new Set()
  }
}

function writeUnlocked(ids: Set<string>): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function getUnlockedTacticalPatternIds(): string[] {
  return [...readUnlocked()]
}

export function isTacticalPatternUnlocked(id: string): boolean {
  return readUnlocked().has(id)
}

export function unlockTacticalPattern(id: string): boolean {
  const unlocked = readUnlocked()
  if (unlocked.has(id)) return false
  unlocked.add(id)
  writeUnlocked(unlocked)
  return true
}
