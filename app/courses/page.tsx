import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllCourses } from "@/lib/courses"
import { getCourseProgress } from "@/lib/progress"
import { QuestNav } from "@/components/ui/QuestNav"

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: progressRows }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("user_progress").select("lesson_id, is_lesson_complete").eq("user_id", user.id),
  ])

  const completedIds = (progressRows ?? [])
    .filter((r: { is_lesson_complete: boolean }) => r.is_lesson_complete)
    .map((r: { lesson_id: string }) => r.lesson_id)

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const courses = getAllCourses()

  return (
    <div className="min-h-screen flex flex-col">
      <QuestNav
        back={{ href: "/dashboard", label: "Quest" }}
        avatarInitial={name[0]?.toUpperCase() ?? "?"}
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            Courses
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-2">
            Pick a course and climb the steps toward mastery.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const totalLessons = course.chapters.reduce((n, ch) => n + ch.lessons.length, 0)
            const progress = getCourseProgress(course, completedIds)
            const totalMinutes = course.chapters
              .flatMap((ch) => ch.lessons)
              .reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0)

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {course.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                  <span className="text-2xl flex-shrink-0">♞</span>
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-gray-500 dark:text-slate-400">
                  <span>{totalLessons} lessons</span>
                  <span>·</span>
                  <span>{totalMinutes} min</span>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{progress}% complete</span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
