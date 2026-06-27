import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress, getNextLesson, findLesson } from "@/lib/progress"
import { recordVisit } from "@/lib/streak"
import { getXp, getLevel, getWeekActivity } from "@/lib/gamification"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { QuestHero } from "@/components/ui/QuestHero"
import { StreakWeek } from "@/components/ui/StreakWeek"
import { WeeklyBarChart } from "@/components/ui/WeeklyBarChart"
import { CoursePreviewCard } from "@/components/ui/CoursePreviewCard"
import { getCourse, getCourseLessons } from "@/lib/courses"
import { COURSE_PREVIEWS } from "@/lib/course-previews"
import { WEEKLY_GOAL_HRS } from "@/lib/user-stats"
import { resolveProfileIcon } from "@/lib/profile-icons"

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
    supabase.from("profiles").select("display_name, avatar_icon").eq("id", user.id).single(),
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
  // Count the user's presence today (visiting counts, not only finishing a lesson),
  // so the streak includes today instead of lagging a day behind.
  const { currentStreak } = await recordVisit(user.id, streak)
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
    const lessons = getCourseLessons(course)
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
    <AppPageShell nav={<QuestNav active="dashboard" avatarInitial={name[0]?.toUpperCase() ?? "?"} avatarIcon={resolveProfileIcon(profile?.avatar_icon)} />}>
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

        <section aria-labelledby="review-heading">
          <div className="mb-3">
            <h2 id="review-heading" className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
              Review
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Revisit concepts and tactical patterns you&apos;ve unlocked across lessons.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/key-concepts"
              className="group rounded-2xl border-2 border-indigo-200/70 dark:border-indigo-800/60 bg-white dark:bg-slate-800 p-5 flex items-center gap-4 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-500/10 transition-all"
            >
              <span className="shrink-0 w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 grid place-items-center text-2xl">
                💡
              </span>
              <div className="min-w-0">
                <h3 className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                  Review Key Concepts
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  Strategic ideas from your courses
                </p>
              </div>
              <span className="shrink-0 text-indigo-500 dark:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
            <Link
              href="/tactical-patterns"
              className="group rounded-2xl border-2 border-amber-200/70 dark:border-amber-800/60 bg-white dark:bg-slate-800 p-5 flex items-center gap-4 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md hover:shadow-amber-500/10 transition-all"
            >
              <span className="shrink-0 w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 grid place-items-center text-2xl">
                ⚡
              </span>
              <div className="min-w-0">
                <h3 className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                  Review Tactical Patterns
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  Forks, pins, clearance, and more
                </p>
              </div>
              <span className="shrink-0 text-amber-500 dark:text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="courses-heading">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 id="courses-heading" className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                Your courses
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Two paths to a sharper attack. Open one to see its chapters and lessons.
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

        <Link
          href="/play"
          className="group relative overflow-hidden rounded-3xl border border-emerald-200/60 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-sky-950/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:shadow-lg hover:shadow-emerald-500/10 transition-shadow"
        >
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white grid place-items-center text-3xl shadow-md shadow-emerald-500/30">
            ♟
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              New mode
            </span>
            <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
              Play Chess
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
              Play complete games against the engine at any strength, or a live opponent in real time — with a clock and a separate Play rating.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 text-white font-display font-extrabold px-5 py-2.5 rounded-2xl shadow-md shadow-emerald-500/30 group-hover:scale-[1.03] transition-transform">
            ▶ Play
          </span>
        </Link>

        <div className="relative overflow-hidden rounded-3xl border border-rose-200/60 dark:border-rose-800/60 bg-gradient-to-r from-rose-50 via-fuchsia-50 to-indigo-50 dark:from-rose-950/40 dark:via-fuchsia-950/40 dark:to-indigo-950/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white grid place-items-center text-3xl shadow-md shadow-rose-500/30">
            ⚔️
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">
              New mode
            </span>
            <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
              Multiplayer Solitaire
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
              Get matched with an opponent on the same game — higher score wins, head-to-head Elo. Or practice casually.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="hidden sm:inline-flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-display font-extrabold px-4 py-2.5 rounded-2xl hover:scale-[1.03] transition-transform"
            >
              🏆 Ranks
            </Link>
            <Link
              href="/solitaire?mode=match"
              className="inline-flex items-center gap-2 bg-rose-600 text-white font-display font-extrabold px-5 py-2.5 rounded-2xl shadow-md shadow-rose-500/30 hover:scale-[1.03] transition-transform"
            >
              ⚔️ Find Match
            </Link>
          </div>
        </div>

        <Link
          href="/analysis"
          className="group relative overflow-hidden rounded-3xl border border-sky-200/60 dark:border-sky-800/60 bg-gradient-to-r from-sky-50 via-indigo-50 to-cyan-50 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-cyan-950/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:shadow-lg hover:shadow-sky-500/10 transition-shadow"
        >
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white grid place-items-center text-3xl shadow-md shadow-sky-500/30">
            🔎
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              New mode
            </span>
            <h3 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 leading-tight">
              Free Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
              Play any position for both sides and get live Stockfish evaluation, best moves, and lines.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 bg-sky-600 text-white font-display font-extrabold px-5 py-2.5 rounded-2xl shadow-md shadow-sky-500/30 group-hover:scale-[1.03] transition-transform">
            🔎 Analyze
          </span>
        </Link>
      </main>
    </AppPageShell>
  )
}
