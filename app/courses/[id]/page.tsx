import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress } from "@/lib/progress"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"
import { ProgressBar } from "@/components/ui/progress-bar"
import { LessonTree } from "@/components/ui/LessonTree"

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

  const inProgressMap = new Map<string, string[]>(
    allProgress
      .filter((r: any) => !r.is_lesson_complete && r.completed_step_ids?.length > 0)
      .map((r: any) => [r.lesson_id as string, r.completed_step_ids as string[]])
  )

  const progress = getCourseProgress(typedCourse, completedIds)

  return (
    <div className="min-h-screen dark:bg-slate-900">
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">← Dashboard</Link>
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600 hover:text-indigo-500 transition mx-auto">
          ChessMind
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">
            Dashboard
          </Link>
          <Link href="/settings/profile" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">
            Profile
          </Link>
        </div>
      </nav>

      {/* Course header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700 px-6 py-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{typedCourse.title}</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{typedCourse.description}</p>
          <ProgressBar value={progress} showLabel className="mt-5" />
        </div>
      </div>

      {/* Lesson tree */}
      <div className="py-10">
        <LessonTree
          course={typedCourse}
          completedLessonIds={completedIds}
          inProgressMap={inProgressMap}
        />
      </div>
    </div>
  )
}
