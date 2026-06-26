import { createClient } from "@/lib/supabase/server"
import { getXp, getLevel, getWeekActivity, getTrophies } from "@/lib/gamification"
import { getAllCourses, getCourse, getCourseLessons } from "@/lib/courses"
import type { Course } from "@/lib/types"
import { getCourseProgress } from "@/lib/progress"

export const WEEKLY_GOAL_HRS = 5

export type ProgressRow = {
  lesson_id: string
  completed_step_ids: string[] | null
  is_lesson_complete: boolean
}

export type AttemptRow = {
  attempted_at: string
  is_correct: boolean
}

export interface UserStats {
  completedLessonIds: string[]
  totalCompletedSteps: number
  lessonsCompleted: number
  totalLessons: number
  currentStreak: number
  longestStreak: number
  xp: number
  level: ReturnType<typeof getLevel>
  days: ReturnType<typeof getWeekActivity>["days"]
  totalHours: number
  totalAttempts: number
  masteryRate: number | null
  trophies: ReturnType<typeof getTrophies>
  courseProgress: Array<{ courseId: string; title: string; progress: number }>
}

export async function fetchUserStats(userId: string, heroCourse?: Course): Promise<UserStats> {
  const supabase = await createClient()
  const course = heroCourse ?? getCourse("chess-attack-and-checkmate")!

  const [{ data: progressRows }, { data: streak }, { data: attempts }] = await Promise.all([
    supabase
      .from("user_progress")
      .select("lesson_id, completed_step_ids, is_lesson_complete")
      .eq("user_id", userId),
    supabase.from("user_streaks").select("*").eq("user_id", userId).single(),
    supabase.from("lesson_attempts").select("attempted_at, is_correct").eq("user_id", userId),
  ])

  const allProgress = (progressRows ?? []) as ProgressRow[]
  const completedLessonIds = allProgress.filter(r => r.is_lesson_complete).map(r => r.lesson_id)
  const totalCompletedSteps = allProgress.reduce((n, r) => n + (r.completed_step_ids?.length ?? 0), 0)

  const attemptRows = (attempts ?? []) as AttemptRow[]
  const totalAttempts = attemptRows.length
  const correct = attemptRows.filter(a => a.is_correct).length
  const masteryRate = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : null

  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0
  const xp = getXp(totalCompletedSteps, completedLessonIds.length)
  const level = getLevel(xp)
  const { days, totalHours } = getWeekActivity(attemptRows.map(a => a.attempted_at))

  const trophies = getTrophies({
    course,
    completedLessonIds,
    currentStreak,
    longestStreak,
    masteryRate,
    weeklyHours: totalHours,
    weeklyGoal: WEEKLY_GOAL_HRS,
  })

  const allCourses = getAllCourses()
  const totalLessons = allCourses.reduce((n, c) => n + getCourseLessons(c).length, 0)

  const courseProgress = allCourses.map(c => ({
    courseId: c.id,
    title: c.title,
    progress: getCourseProgress(c, completedLessonIds),
  }))

  return {
    completedLessonIds,
    totalCompletedSteps,
    lessonsCompleted: completedLessonIds.length,
    totalLessons,
    currentStreak,
    longestStreak,
    xp,
    level,
    days,
    totalHours,
    totalAttempts,
    masteryRate,
    trophies,
    courseProgress,
  }
}
