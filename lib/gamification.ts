// lib/gamification.ts
// Derives XP, levels, weekly activity, and trophies from data you ALREADY store
// (completed steps/lessons, streak, lesson attempts). No schema changes required.

import type { Course } from "./types"
import { getCourseProgress } from "./progress"

// ── XP model ───────────────────────────────────────────────────────────────
export const STEP_XP = 15
export const LESSON_BONUS_XP = 50

/** Total XP from completed steps + a bonus per completed lesson. */
export function getXp(totalCompletedSteps: number, completedLessons: number): number {
  return totalCompletedSteps * STEP_XP + completedLessons * LESSON_BONUS_XP
}

// ── Levels (chess-themed ranks) ──────────────────────────────────────────────
export const RANKS = [
  { min: 0,    title: "Beginner" },
  { min: 120,  title: "Pawn" },
  { min: 280,  title: "Knight" },
  { min: 500,  title: "Bishop" },
  { min: 780,  title: "Rook" },
  { min: 1120, title: "Queen" },
  { min: 1520, title: "Tactician" },
  { min: 2000, title: "Master" },
  { min: 2600, title: "Grandmaster" },
] as const

const LEVELS = RANKS

export interface LevelInfo {
  level: number          // 1-based
  title: string
  xpIntoLevel: number    // XP earned since this level's floor
  xpForLevel: number     // XP span of the current level
  xpToNext: number       // XP remaining to next level (0 at max)
  nextTitle: string | null
  isMax: boolean
}

export function getLevel(xp: number): LevelInfo {
  let i = 0
  for (let j = 0; j < LEVELS.length; j++) if (xp >= LEVELS[j].min) i = j
  const floor = LEVELS[i].min
  const isMax = i === LEVELS.length - 1
  const next = isMax ? floor : LEVELS[i + 1].min
  const xpForLevel = isMax ? Math.max(xp - floor, 1) : next - floor
  const xpIntoLevel = xp - floor
  return {
    level: i + 1,
    title: LEVELS[i].title,
    xpIntoLevel,
    xpForLevel,
    xpToNext: isMax ? 0 : next - xp,
    nextTitle: isMax ? null : LEVELS[i + 1].title,
    isMax,
  }
}

export interface RankTier {
  level: number
  title: string
  minXp: number
}

export type RankStatus = "surpassed" | "current" | "upcoming"

export interface RankProgressEntry extends RankTier {
  status: RankStatus
  /** XP still needed to reach this rank; 0 if surpassed or current */
  xpToReach: number
}

export function getAllRanks(): RankTier[] {
  return LEVELS.map((rank, i) => ({
    level: i + 1,
    title: rank.title,
    minXp: rank.min,
  }))
}

/** Every rank tier with surpassed / current / upcoming status for the XP ladder UI. */
export function getRankProgress(xp: number): RankProgressEntry[] {
  const current = getLevel(xp)
  return LEVELS.map((rank, i) => {
    const level = i + 1
    let status: RankStatus
    if (level < current.level) status = "surpassed"
    else if (level === current.level) status = "current"
    else status = "upcoming"

    return {
      level,
      title: rank.title,
      minXp: rank.min,
      status,
      xpToReach: status === "upcoming" ? rank.min - xp : 0,
    }
  })
}

// ── Weekly activity (for streak dots + bar chart) ────────────────────────────
export const MINS_PER_ATTEMPT = 2

export interface DayActivity {
  label: string      // single-letter weekday: M T W T F S S
  date: string       // YYYY-MM-DD (local)
  minutes: number
  hours: number
  active: boolean
  isToday: boolean
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Buckets attempt timestamps into the trailing 7 days (oldest → today).
 * @param attemptDates ISO timestamps from lesson_attempts.attempted_at
 */
export function getWeekActivity(attemptDates: string[]): { days: DayActivity[]; totalHours: number } {
  const WD = ["S", "M", "T", "W", "T", "F", "S"]
  const today = new Date()
  const todayStr = localDateStr(today)

  // Count attempts per local date
  const counts = new Map<string, number>()
  for (const iso of attemptDates) {
    const key = localDateStr(new Date(iso))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const days: DayActivity[] = []
  let totalMin = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = localDateStr(d)
    const n = counts.get(key) ?? 0
    const minutes = n * MINS_PER_ATTEMPT
    totalMin += minutes
    days.push({
      label: WD[d.getDay()],
      date: key,
      minutes,
      hours: minutes / 60,
      active: n > 0,
      isToday: key === todayStr,
    })
  }
  return { days, totalHours: totalMin / 60 }
}

// ── Trophies (derived milestones) ────────────────────────────────────────────
export interface Trophy {
  key: string
  emoji: string
  name: string
  /** Short flavor copy shown in the detail panel. */
  description: string
  /** How to unlock — shown when locked or as a subtitle when earned. */
  hint: string
  earned: boolean
}

export interface TrophyInput {
  course: Course
  completedLessonIds: string[]
  currentStreak: number
  longestStreak: number
  masteryRate: number | null   // 0–100 first-attempt accuracy, or null
  weeklyHours: number
  weeklyGoal: number
}

export function getTrophies(input: TrophyInput): Trophy[] {
  const { course, completedLessonIds, currentStreak, longestStreak, masteryRate, weeklyHours, weeklyGoal } = input
  const progress = getCourseProgress(course, completedLessonIds)
  const chaptersDone = course.chapters.filter(ch =>
    ch.lessons.every(l => completedLessonIds.includes(l.id))
  ).length

  return [
    {
      key: "first-mate",
      emoji: "🏅",
      name: "First Mate",
      description: "You finished your first lesson. Every grandmaster started with a single step — this one's yours.",
      hint: "Finish your first lesson",
      earned: completedLessonIds.length >= 1,
    },
    {
      key: "on-fire",
      emoji: "🔥",
      name: "On Fire",
      description: "Three days in a row studying chess. Consistency beats talent when you're building real skill.",
      hint: "Reach a 3-day streak",
      earned: Math.max(currentStreak, longestStreak) >= 3,
    },
    {
      key: "sharpshooter",
      emoji: "🎯",
      name: "Sharpshooter",
      description: "You're nailing puzzles on the first try. Your board vision is getting sharp.",
      hint: "Hit 90% first-attempt accuracy",
      earned: (masteryRate ?? 0) >= 90,
    },
    {
      key: "week-warrior",
      emoji: "⚡",
      name: "Week Warrior",
      description: "You hit your weekly study goal. Steady practice is how mating patterns stick.",
      hint: "Hit your weekly time goal",
      earned: weeklyHours >= weeklyGoal,
    },
    {
      key: "chapter-boss",
      emoji: "🛡️",
      name: "Chapter Boss",
      description: "You cleared an entire chapter. That's a whole skill set mastered, not just one trick.",
      hint: "Complete a full chapter",
      earned: chaptersDone >= 1,
    },
    {
      key: "endgame-king",
      emoji: "👑",
      name: "Endgame King",
      description: "Every lesson in the course — done. You think in checkmate now.",
      hint: "Complete the whole course",
      earned: progress >= 100,
    },
  ]
}
