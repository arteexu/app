import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getCourseProgress } from "@/lib/progress"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"
import { ProgressBar } from "@/components/ui/progress-bar"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: progressRows }, { data: streak }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("user_progress").select("lesson_id, is_lesson_complete, completed_at").eq("user_id", user.id),
    supabase.from("user_streaks").select("*").eq("user_id", user.id).single(),
    supabase.from("lesson_attempts").select("is_correct").eq("user_id", user.id),
  ])

  const typedCourse = course as unknown as Course
  const completedLessonIds = (progressRows ?? [])
    .filter((r: any) => r.is_lesson_complete)
    .map((r: any) => r.lesson_id)

  const progress = getCourseProgress(typedCourse, completedLessonIds)
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const currentStreak = streak?.current_streak ?? 0
  const longestStreak = streak?.longest_streak ?? 0

  const totalAttempts = attempts?.length ?? 0
  const correctAttempts = attempts?.filter((a: any) => a.is_correct).length ?? 0
  const masteryRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null

  // Build progress map: chapter → lessons with status
  const chapterProgress = typedCourse.chapters.map(chapter => ({
    chapter,
    lessons: chapter.lessons.map(lesson => ({
      lesson,
      status: completedLessonIds.includes(lesson.id)
        ? "complete"
        : "locked",
    })),
  }))

  // Determine unlock state (first locked that comes after any complete)
  let foundFirstIncomplete = false
  chapterProgress.forEach(({ lessons }) => {
    lessons.forEach(l => {
      if (!foundFirstIncomplete && l.status !== "complete") {
        l.status = "current"
        foundFirstIncomplete = true
      }
    })
  })

  async function handleSignOut() {
    "use server"
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/signin")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</Link>
        <span className="text-xl font-bold text-indigo-600">ChessMind</span>
        <form action={handleSignOut}>
          <button type="submit" className="text-sm text-gray-400 hover:text-red-500 transition">
            Sign out
          </button>
        </form>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600">
            {name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <p className="text-sm text-gray-400">{user.email}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard emoji="🔥" value={currentStreak} label="Current streak" />
          <StatCard emoji="🏆" value={longestStreak} label="Longest streak" />
          <StatCard
            emoji="🎯"
            value={masteryRate !== null ? `${masteryRate}%` : "—"}
            label="First-attempt rate"
          />
        </div>

        {/* Course progress */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{typedCourse.title}</h2>
            <span className="text-sm font-medium text-indigo-600">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>

        {/* Progress map */}
        <div className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold text-gray-900">Progress Map</h2>

          {chapterProgress.map(({ chapter, lessons }) => (
            <div key={chapter.id} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {chapter.title}
              </h3>

              <div className="flex flex-col gap-2">
                {lessons.map(({ lesson, status }) => (
                  <div
                    key={lesson.id}
                    className={`flex items-center gap-4 rounded-xl border px-5 py-3.5 ${
                      status === "complete"
                        ? "bg-green-50 border-green-200"
                        : status === "current"
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-white border-gray-100 opacity-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      status === "complete"
                        ? "bg-green-200 text-green-800"
                        : status === "current"
                        ? "bg-indigo-200 text-indigo-800"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {status === "complete" ? "✓" : status === "current" ? "→" : "🔒"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{lesson.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{lesson.estimatedMinutes} min · {lesson.description}</p>
                    </div>
                    {status !== "locked" && (
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:underline flex-shrink-0"
                      >
                        {status === "complete" ? "Review" : "Start"}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col items-center gap-1 shadow-sm text-center">
      <span className="text-2xl">{emoji}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
