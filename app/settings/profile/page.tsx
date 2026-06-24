import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress } from "@/lib/progress"
import { getXp, getLevel, getWeekActivity, getTrophies } from "@/lib/gamification"
import { XpBar } from "@/components/ui/XpBar"
import { WeeklyBarChart } from "@/components/ui/WeeklyBarChart"
import { TrophyStrip } from "@/components/ui/TrophyStrip"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"
import { clsx } from "clsx"

const WEEKLY_GOAL_HRS = 5

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: progressRows }, { data: streak }, { data: attempts }] = await Promise.all([
    supabase.from("user_progress").select("lesson_id, completed_step_ids, is_lesson_complete").eq("user_id", user.id),
    supabase.from("user_streaks").select("*").eq("user_id", user.id).single(),
    supabase.from("lesson_attempts").select("attempted_at, is_correct").eq("user_id", user.id),
  ])

  const typedCourse = course as unknown as Course
  const allProgress = progressRows ?? []
  const completedLessonIds = allProgress.filter((r: any) => r.is_lesson_complete).map((r: any) => r.lesson_id as string)
  const totalCompletedSteps = allProgress.reduce((n: number, r: any) => n + (r.completed_step_ids?.length ?? 0), 0)

  const progress = getCourseProgress(typedCourse, completedLessonIds)
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0

  const totalAttempts = attempts?.length ?? 0
  const correct = attempts?.filter((a: any) => a.is_correct).length ?? 0
  const masteryRate = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : null

  const xp = getXp(totalCompletedSteps, completedLessonIds.length)
  const level = getLevel(xp)
  const { days, totalHours } = getWeekActivity((attempts ?? []).map((a: any) => a.attempted_at as string))
  const trophies = getTrophies({
    course: typedCourse, completedLessonIds, currentStreak, longestStreak,
    masteryRate, weeklyHours: totalHours, weeklyGoal: WEEKLY_GOAL_HRS,
  })

  // Progress map statuses
  let foundFirstIncomplete = false
  const chapterProgress = typedCourse.chapters.map(chapter => ({
    chapter,
    lessons: chapter.lessons.map(lesson => {
      const isComplete = completedLessonIds.includes(lesson.id)
      let status: "complete" | "current" | "locked" = isComplete ? "complete" : "locked"
      if (!isComplete && !foundFirstIncomplete) { status = "current"; foundFirstIncomplete = true }
      return { lesson, status }
    }),
  }))

  return (
    <div className="flex flex-col gap-6">

      {/* Level / XP card */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-600/20
                      bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500">
        <span className="pointer-events-none select-none absolute -right-4 -top-6 text-[130px] leading-none opacity-10">♛</span>
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">Rank</p>
        <p className="font-display text-3xl font-extrabold mt-1">Level {level.level} · {level.title}</p>
        <p className="text-white/85 text-sm font-medium mt-0.5">{xp.toLocaleString()} XP earned</p>
        <div className="mt-4 max-w-md"><XpBar info={level} tone="light" /></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard emoji="🔥" value={currentStreak} label="Streak" />
        <StatCard emoji="🏆" value={longestStreak} label="Best streak" />
        <StatCard emoji="🎯" value={masteryRate !== null ? `${masteryRate}%` : "—"} label="First-attempt" />
      </div>

      {/* Weekly activity */}
      <WeeklyBarChart days={days} totalHours={totalHours} goal={WEEKLY_GOAL_HRS} />

      {/* Trophies */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <TrophyStrip trophies={trophies} />
      </div>

      {/* Progress map */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">Progress Map</h2>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
        </div>

        {chapterProgress.map(({ chapter, lessons }) => (
          <div key={chapter.id} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{chapter.title}</h3>
            {lessons.map(({ lesson, status }) => (
              <div key={lesson.id} className={clsx(
                "flex items-center gap-3 rounded-xl border px-4 py-3",
                status === "complete" && "bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800",
                status === "current"  && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                status === "locked"   && "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-50"
              )}>
                <div className={clsx(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                  status === "complete" && "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
                  status === "current"  && "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
                  status === "locked"   && "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"
                )}>
                  {status === "complete" ? "✓" : status === "current" ? "▶" : "🔒"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{lesson.title}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{lesson.estimatedMinutes} min · {lesson.steps.length} steps</p>
                </div>
                {status !== "locked" && (
                  <Link href={`/lessons/${lesson.id}`} className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0">
                    {status === "complete" ? "Review" : "Continue"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 flex flex-col items-center gap-1 text-center">
      <span className="text-2xl">{emoji}</span>
      <span className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">{value}</span>
      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{label}</span>
    </div>
  )
}
