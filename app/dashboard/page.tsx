import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress, getNextLesson, findLesson } from "@/lib/progress"
import { getXp, getLevel, getWeekActivity, getTrophies } from "@/lib/gamification"
import { QuestNav } from "@/components/ui/QuestNav"
import { QuestHero } from "@/components/ui/QuestHero"
import { StreakWeek } from "@/components/ui/StreakWeek"
import { WeeklyBarChart } from "@/components/ui/WeeklyBarChart"
import { TrophyStrip } from "@/components/ui/TrophyStrip"
import { QuestPath } from "@/components/ui/QuestPath"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"

const WEEKLY_GOAL_HRS = 5

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [
    { data: profile },
    { data: progressRows },
    { data: streak },
    { data: attempts },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("user_progress").select("lesson_id, completed_step_ids, is_lesson_complete").eq("user_id", user.id),
    supabase.from("user_streaks").select("*").eq("user_id", user.id).single(),
    supabase.from("lesson_attempts").select("attempted_at, is_correct").eq("user_id", user.id),
  ])

  const allProgress = progressRows ?? []
  const completedIds = allProgress.filter((r: any) => r.is_lesson_complete).map((r: any) => r.lesson_id as string)
  const totalCompletedSteps = allProgress.reduce((n: number, r: any) => n + (r.completed_step_ids?.length ?? 0), 0)

  const inProgressMap = new Map<string, string[]>(
    allProgress
      .filter((r: any) => !r.is_lesson_complete && r.completed_step_ids?.length > 0)
      .map((r: any) => [r.lesson_id as string, r.completed_step_ids as string[]])
  )
  const inProgressId = [...inProgressMap.keys()][0]

  const typedCourse = course as unknown as Course
  const progress = getCourseProgress(typedCourse, completedIds)
  const nextLesson = getNextLesson(typedCourse, completedIds)
  const inProgressLesson = inProgressId ? findLesson(typedCourse, inProgressId) : null
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0

  // ── Gamification (derived, no schema change) ──
  const xp = getXp(totalCompletedSteps, completedIds.length)
  const level = getLevel(xp)
  const { days, totalHours } = getWeekActivity((attempts ?? []).map((a: any) => a.attempted_at as string))
  const totalAttempts = attempts?.length ?? 0
  const correct = attempts?.filter((a: any) => a.is_correct).length ?? 0
  const masteryRate = totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : null
  const trophies = getTrophies({
    course: typedCourse, completedLessonIds: completedIds,
    currentStreak, longestStreak, masteryRate, weeklyHours: totalHours, weeklyGoal: WEEKLY_GOAL_HRS,
  })

  // ── Primary CTA ──
  let ctaHref: string | null
  let ctaLabel: string
  const courseComplete = !nextLesson && !inProgressLesson
  if (inProgressLesson) {
    ctaHref = `/lessons/${inProgressLesson.id}`; ctaLabel = `Continue: ${inProgressLesson.title}`
  } else if (nextLesson) {
    ctaHref = `/lessons/${nextLesson.id}`; ctaLabel = progress === 0 ? "Start course" : `Next: ${nextLesson.title}`
  } else {
    ctaHref = `/courses/${typedCourse.id}`; ctaLabel = "Review course"
  }

  return (
    <div className="min-h-screen flex flex-col">
      <QuestNav active="dashboard" avatarInitial={name[0]?.toUpperCase() ?? "?"} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-7">

        {/* Hero + stats */}
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
          <QuestHero name={name} info={level} ctaHref={ctaHref} ctaLabel={ctaLabel} courseComplete={courseComplete} />
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
            <StreakWeek streak={currentStreak} days={days} />
            <WeeklyBarChart days={days} totalHours={totalHours} goal={WEEKLY_GOAL_HRS} />
          </div>
        </div>

        {/* Trophies */}
        <TrophyStrip trophies={trophies} />

        {/* Course header + quest path */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">{typedCourse.title}</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">{progress}% complete · {completedIds.length}/{typedCourse.chapters.flatMap(c => c.lessons).length} lessons</p>
            </div>
            <Link href={`/courses/${typedCourse.id}`} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">All lessons →</Link>
          </div>

          <div className="bg-white/50 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-slate-800 px-4 py-8 mt-3">
            <QuestPath
              course={typedCourse}
              completedLessonIds={completedIds}
              inProgressMap={inProgressMap}
              activeLessonId={inProgressLesson?.id}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
