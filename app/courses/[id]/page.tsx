import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isLessonUnlocked, getCourseProgress, findLesson } from "@/lib/progress"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"
import { ProgressBar } from "@/components/ui/progress-bar"
import { clsx } from "clsx"

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const typedCourse = course as unknown as Course
  if (id !== typedCourse.id) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: progressRows } = await supabase
    .from("user_progress")
    .select("lesson_id, completed_step_ids, is_lesson_complete")
    .eq("user_id", user.id)

  const allProgress = progressRows ?? []
  const completedIds = allProgress
    .filter((r: any) => r.is_lesson_complete)
    .map((r: any) => r.lesson_id as string)

  // Map of lesson_id → completed step IDs for in-progress lessons
  const inProgressMap = new Map<string, string[]>(
    allProgress
      .filter((r: any) => !r.is_lesson_complete && r.completed_step_ids?.length > 0)
      .map((r: any) => [r.lesson_id as string, r.completed_step_ids as string[]])
  )

  const progress = getCourseProgress(typedCourse, completedIds)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</Link>
        <span className="text-xl font-bold text-indigo-600 ml-auto">ChessMind</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{typedCourse.title}</h1>
          <p className="text-gray-500 mt-1">{typedCourse.description}</p>
          <ProgressBar value={progress} showLabel className="mt-4" />
        </div>

        {typedCourse.chapters.map(chapter => (
          <div key={chapter.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-gray-800">{chapter.title}</h2>
            <p className="text-sm text-gray-500 -mt-1">{chapter.description}</p>

            {chapter.lessons.map(lesson => {
              const completed = completedIds.includes(lesson.id)
              const unlocked = isLessonUnlocked(typedCourse, lesson.id, completedIds)
              const inProgressSteps = inProgressMap.get(lesson.id) ?? null
              const isInProgress = !!inProgressSteps
              const stepsDone = inProgressSteps?.length ?? 0
              const totalSteps = lesson.steps.length
              const stepPct = Math.round((stepsDone / totalSteps) * 100)

              return (
                <div
                  key={lesson.id}
                  className={clsx(
                    "bg-white rounded-xl border px-5 py-4 flex items-center gap-4 transition-all",
                    completed && "border-green-200",
                    isInProgress && "border-amber-300 shadow-sm",
                    !completed && !isInProgress && unlocked && "border-gray-200 shadow-sm",
                    !unlocked && "border-gray-100 opacity-50"
                  )}
                >
                  {/* Status icon */}
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                    completed && "bg-green-100 text-green-700",
                    isInProgress && "bg-amber-100 text-amber-700",
                    !completed && !isInProgress && unlocked && "bg-indigo-100 text-indigo-700",
                    !unlocked && "bg-gray-100 text-gray-400"
                  )}>
                    {completed ? "✓" : isInProgress ? "▶" : unlocked ? "→" : "🔒"}
                  </div>

                  {/* Title + metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{lesson.title}</p>
                    {isInProgress ? (
                      <div className="mt-1.5 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{stepsDone} of {totalSteps} steps done</span>
                          <span>{stepPct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${stepPct}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {lesson.description} · {lesson.estimatedMinutes} min
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  {isInProgress && (
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="flex-shrink-0 px-3.5 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-400 transition"
                    >
                      Continue
                    </Link>
                  )}
                  {!isInProgress && unlocked && !completed && (
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="text-sm font-semibold text-indigo-600 hover:underline flex-shrink-0"
                    >
                      Start
                    </Link>
                  )}
                  {completed && (
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className="text-sm text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      Review
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
