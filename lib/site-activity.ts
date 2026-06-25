// lib/site-activity.ts
// Client-side time-on-site tracking per local hour bucket (0–23), stored in localStorage.

const STORAGE_KEY = "chessmind-site-activity"
const RETENTION_DAYS = 30

export type HourlySeconds = number[] // length 24, seconds per hour

type ActivityStore = Record<string, HourlySeconds>

let listeners: Array<() => void> = []

/** Stable empty buckets — safe for useSyncExternalStore getServerSnapshot. */
export const EMPTY_HOURLY: HourlySeconds = Array.from({ length: 24 }, () => 0)

let storeCache: ActivityStore | null = null
const hourlySnapshotCache = new Map<string, HourlySeconds>()

function invalidateStoreCache(): void {
  storeCache = null
  hourlySnapshotCache.clear()
}

function readAllCached(): ActivityStore {
  if (storeCache === null) {
    storeCache = readAll()
  }
  return storeCache
}

function emitChange() {
  invalidateStoreCache()
  for (const listener of listeners) listener()
}

export function subscribeSiteActivity(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function readAll(): ActivityStore {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? (parsed as ActivityStore) : {}
  } catch {
    return {}
  }
}

function writeAll(store: ActivityStore): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota / privacy mode */
  }
}

function pruneOldEntries(store: ActivityStore): ActivityStore {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffStr = localDateStr(cutoff)
  const next: ActivityStore = {}
  for (const [date, buckets] of Object.entries(store)) {
    if (date >= cutoffStr) next[date] = buckets
  }
  return next
}

function normalizeBuckets(raw: unknown): HourlySeconds {
  if (!Array.isArray(raw) || raw.length !== 24) return EMPTY_HOURLY
  return raw.map(v => (typeof v === "number" && v > 0 ? Math.round(v) : 0))
}

/** Seconds spent on site for each hour of a local calendar day. */
export function getHourlyActivity(date: string): HourlySeconds {
  const cached = hourlySnapshotCache.get(date)
  if (cached) return cached

  const store = readAllCached()
  const buckets = normalizeBuckets(store[date])
  hourlySnapshotCache.set(date, buckets)
  return buckets
}

export function getDayTotalSeconds(date: string): number {
  return getHourlyActivity(date).reduce((sum, s) => sum + s, 0)
}

/** Add active seconds to the current (or given) local hour bucket. */
export function addActiveSeconds(seconds: number, at: Date = new Date()): void {
  if (seconds <= 0 || typeof window === "undefined") return

  const date = localDateStr(at)
  const hour = at.getHours()
  let store = pruneOldEntries(readAll())
  const buckets = normalizeBuckets(store[date]).slice()
  buckets[hour] += Math.round(seconds)
  store[date] = buckets
  writeAll(store)
  emitChange()
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? "<1m" : "0m"
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a"
  if (hour < 12) return `${hour}a`
  if (hour === 12) return "12p"
  return `${hour - 12}p`
}
