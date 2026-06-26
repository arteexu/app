import { Fragment } from "react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress } from "@/lib/progress"
import { getAllCourses, getChapterLessons } from "@/lib/courses"
import type { Course, Lesson } from "@/lib/types"
import { clsx } from "clsx"

type ProgressRow = {
  lesson_id: string
  completed_step_ids: string[] | null
  is_lesson_complete: boolean
}

function lessonStatuses(lessons: Lesson[], completedLessonIds: string[]) {
  let foundFirstIncomplete = false
  return lessons.map(lesson => {
    const isComplete = completedLessonIds.includes(lesson.id)
    let status: "complete" | "current" | "locked" = isComplete ? "complete" : "locked"
    if (!isComplete && !foundFirstIncomplete) {
      status = "current"
      foundFirstIncomplete = true
    }
    return { lesson, status }
  })
}

function LessonProgressRow({
  lesson,
  status,
}: {
  lesson: Lesson
  status: "complete" | "current" | "locked"
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        status === "complete" && "bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800",
        status === "current" && "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
        status === "locked" && "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-50",
      )}
    >
      <div
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
          status === "complete" && "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
          status === "current" && "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
          status === "locked" && "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500",
        )}
      >
        {status === "complete" ? "✓" : status === "current" ? "▶" : "🔒"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{lesson.title}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
          {lesson.estimatedMinutes} min · {lesson.steps.length} steps
        </p>
      </div>
      {status !== "locked" && (
        <Link
          href={`/lessons/${lesson.id}`}
          className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
        >
          {status === "complete" ? "Review" : "Continue"}
        </Link>
      )}
    </div>
  )
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: progressRows } = await supabase
    .from("user_progress")
    .select("lesson_id, completed_step_ids, is_lesson_complete")
    .eq("user_id", user.id)

  const allProgress = (progressRows ?? []) as ProgressRow[]
  const completedLessonIds = allProgress.filter(r => r.is_lesson_complete).map(r => r.lesson_id)

  const courseProgressMaps = getAllCourses().map((course: Course) => ({
    course,
    progress: getCourseProgress(course, completedLessonIds),
    chapters: course.chapters.map(chapter => ({
      chapter,
      lessons: lessonStatuses(getChapterLessons(chapter), completedLessonIds),
    })),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">Your progress</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Track lessons across your courses. For streaks, trophies, and goals, see{" "}
          <Link href="/settings/statistics" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            Statistics
          </Link>
          .
        </p>
      </div>

      {courseProgressMaps.map(({ course, progress, chapters }) => (
        <div
          key={course.id}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm flex flex-col gap-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">{course.title}</h3>
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{progress}%</span>
          </div>

          {chapters.map(({ chapter, lessons }) => (
            <div key={chapter.id} className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                {chapter.title}
              </h4>
              {lessons.map(({ lesson, status }) => {
                const sectionTitle = chapter.sections?.find(s => s.lessons[0]?.id === lesson.id)?.title
                return (
                  <Fragment key={lesson.id}>
                    {sectionTitle && (
                      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 pt-1">{sectionTitle}</p>
                    )}
                    <LessonProgressRow lesson={lesson} status={status} />
                  </Fragment>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
