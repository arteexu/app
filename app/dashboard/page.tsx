import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress, getNextLesson, findLesson } from "@/lib/progress"
import { getXp, getLevel, getWeekActivity } from "@/lib/gamification"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { QuestHero } from "@/components/ui/QuestHero"
import { StreakWeek } from "@/components/ui/StreakWeek"
import { WeeklyBarChart } from "@/components/ui/WeeklyBarChart"
import { CoursePreviewCard } from "@/components/ui/CoursePreviewCard"
import { getCourse } from "@/lib/courses"
import { COURSE_PREVIEWS } from "@/lib/course-previews"
import { WEEKLY_GOAL_HRS } from "@/lib/user-stats"

type ProgressRow = {
  lesson_id: string
  completed_step_ids: string[] | null
  is_lesson_complete: boolean
}

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

  const allProgress = (progressRows ?? []) as ProgressRow[]
  const completedIds = allProgress.filter(r => r.is_lesson_complete).map(r => r.lesson_id)
  const totalCompletedSteps = allProgress.reduce((n, r) => n + (r.completed_step_ids?.length ?? 0), 0)

  const inProgressMap = new Map<string, string[]>(
    allProgress
      .filter(r => !r.is_lesson_complete && (r.completed_step_ids?.length ?? 0) > 0)
      .map(r => [r.lesson_id, r.completed_step_ids ?? []]),
  )
  const inProgressIds = [...inProgressMap.keys()]

  const heroCourse = getCourse("chess-attack-and-checkmate")!
  const heroProgress = getCourseProgress(heroCourse, completedIds)
  const heroNext = getNextLesson(heroCourse, completedIds)
  const heroFlat = heroCourse.chapters.flatMap(c => c.lessons)
  const heroInProgressId = inProgressIds.find(id => heroFlat.some(l => l.id === id))
  const heroInProgress = heroInProgressId ? findLesson(heroCourse, heroInProgressId) : null

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const currentStreak = streak?.current_streak ?? 0
  const xp = getXp(totalCompletedSteps, completedIds.length)
  const level = getLevel(xp)
  const { days, totalHours } = getWeekActivity((attempts ?? []).map(a => a.attempted_at))

  let ctaHref: string | null
  let ctaLabel: string
  const courseComplete = !heroNext && !heroInProgress
  if (heroInProgress) {
    ctaHref = `/lessons/${heroInProgress.id}`
    ctaLabel = `Continue: ${heroInProgress.title}`
  } else if (heroNext) {
    ctaHref = `/lessons/${heroNext.id}`
    ctaLabel = heroProgress === 0 ? "Start learning" : `Next: ${heroNext.title}`
  } else {
    ctaHref = `/courses/${heroCourse.id}`
    ctaLabel = "Review course"
  }

  const courseCards = COURSE_PREVIEWS.map(preview => {
    const course = getCourse(preview.id)
    if (!course) return null
    const lessons = course.chapters.flatMap(ch => ch.lessons)
    const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0)
    const completedCount = completedIds.filter(id => lessons.some(l => l.id === id)).length
    return {
      preview,
      chapterCount: course.chapters.length,
      lessonCount: lessons.length,
      totalMinutes,
      progress: getCourseProgress(course, completedIds),
      completedCount,
    }
  }).filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <AppPageShell nav={<QuestNav active="dashboard" avatarInitial={name[0]?.toUpperCase() ?? "?"} />}>
      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-7">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
          <QuestHero
            name={name}
            xp={xp}
            info={level}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            courseComplete={courseComplete}
          />
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-1 gap-5">
            <StreakWeek streak={currentStreak} days={days} />
            <WeeklyBarChart days={days} totalHours={totalHours} goal={WEEKLY_GOAL_HRS} />
          </div>
        </div>

        <section aria-labelledby="courses-heading">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 id="courses-heading" className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                Your courses
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Two paths to a sharper attack. Open one to see its chapters and quest.
              </p>
            </div>
            <Link href="/courses" className="shrink-0 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              All courses →
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {courseCards.map(c => (
              <CoursePreviewCard
                key={c.preview.id}
                preview={c.preview}
                chapterCount={c.chapterCount}
                lessonCount={c.lessonCount}
                totalMinutes={c.totalMinutes}
                progress={c.progress}
                completedCount={c.completedCount}
              />
            ))}
          </div>
        </section>

        <Link
          href="/solitaire"
          className="group relative overflow-hidden rounded-3xl border border-violet-200/60 dark:border-violet-800/60 bg-gradient-to-r from-violet-50 via-indigo-50 to-fuchsia-50 dark:from-violet-950/40 dark:via-indigo-950/40 dark:to-fuchsia-950/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:shadow-lg hover:shadow-violet-500/10 transition-shadow"
        >
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-3xl shadow-md shadow-indigo-500/30">
            ♟
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              New mode
            </span>
            <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
              Solitaire Chess
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
              Follow a grandmaster&apos;s game and guess their moves — pick an opening, a side, and play.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 bg-indigo-600 text-white font-display font-extrabold px-5 py-2.5 rounded-2xl shadow-md shadow-indigo-500/30 group-hover:scale-[1.03] transition-transform">
            ▶ Play
          </span>
        </Link>
      </main>
    </AppPageShell>
  )
}
