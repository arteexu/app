import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ProgressBar } from "@/components/ui/progress-bar"
import { getCourseProgress, getNextLesson, findLesson } from "@/lib/progress"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: progressRows }, { data: streak }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("user_progress").select("lesson_id, completed_step_ids, is_lesson_complete").eq("user_id", user.id),
    supabase.from("user_streaks").select("*").eq("user_id", user.id).single(),
  ])

  const allProgress = progressRows ?? []
  const completedIds = allProgress
    .filter((r: any) => r.is_lesson_complete)
    .map((r: any) => r.lesson_id as string)

  // First in-progress lesson (started but not complete)
  const inProgressRow = allProgress.find(
    (r: any) => !r.is_lesson_complete && r.completed_step_ids?.length > 0
  ) as { lesson_id: string; completed_step_ids: string[] } | undefined

  const typedCourse = course as unknown as Course
  const progress = getCourseProgress(typedCourse, completedIds)
  const nextLesson = getNextLesson(typedCourse, completedIds)
  const inProgressLesson = inProgressRow ? findLesson(typedCourse, inProgressRow.lesson_id) : null
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const currentStreak = streak?.current_streak ?? 0

  const stepsDone = inProgressRow?.completed_step_ids?.length ?? 0
  const totalSteps = inProgressLesson?.steps.length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-indigo-600">ChessMind</span>
        <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-900">
          {name}
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hey, {name}! 👋</h1>
          <p className="text-gray-500 mt-1">
            {currentStreak > 0 ? `${currentStreak}-day streak — keep it going!` : "Start your streak today."}
          </p>
        </div>

        {/* In-progress lesson — shown only when a lesson is partially complete */}
        {inProgressLesson && (
          <div className="bg-white rounded-2xl border border-amber-300 p-6 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-lg">▶</span>
              <span className="text-sm font-semibold text-amber-700 uppercase tracking-wide">In progress</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900">{inProgressLesson.title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{inProgressLesson.description}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>{stepsDone} of {totalSteps} steps done</span>
                <span>{Math.round((stepsDone / totalSteps) * 100)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((stepsDone / totalSteps) * 100)}%` }}
                />
              </div>
            </div>

            <Link
              href={`/lessons/${inProgressLesson.id}`}
              className="inline-flex items-center justify-center bg-amber-500 text-white rounded-xl px-6 py-3 font-semibold hover:bg-amber-400 transition self-start"
            >
              Continue lesson →
            </Link>
          </div>
        )}

        {/* Streak */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5 shadow-sm">
          <div className="text-4xl">🔥</div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{currentStreak}</p>
            <p className="text-sm text-gray-500">day streak</p>
          </div>
        </div>

        {/* Course card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{typedCourse.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{typedCourse.description}</p>
          </div>

          <ProgressBar value={progress} showLabel />

          {nextLesson && !inProgressLesson && (
            <Link
              href={`/lessons/${nextLesson.id}`}
              className="inline-flex items-center justify-center bg-indigo-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-indigo-500 transition self-start"
            >
              {progress === 0 ? "Start course →" : `Next: ${nextLesson.title} →`}
            </Link>
          )}

          {!nextLesson && (
            <p className="text-green-600 font-semibold">🎉 Course complete!</p>
          )}

          <Link href={`/courses/${typedCourse.id}`} className="text-sm text-indigo-500 hover:underline">
            View all lessons
          </Link>
        </div>
      </div>
    </div>
  )
}
