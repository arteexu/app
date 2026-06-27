import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCompletedLessonCount, getCourseProgress, getNextLesson } from "@/lib/progress"
import { getCourse, getCourseLessons } from "@/lib/courses"
import type { Course } from "@/lib/types"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { CourseMasteryHeader } from "@/components/ui/CourseMasteryHeader"
import { MasteryStaircase } from "@/components/ui/MasteryStaircase"
import { CourseKeyConceptsPanel } from "@/components/key-concepts/CourseKeyConceptsPanel"
import { CourseTacticalPatternsPanel } from "@/components/tactical-patterns/CourseTacticalPatternsPanel"
import { resolveProfileIcon } from "@/lib/profile-icons"

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const typedCourse = getCourse(id) as Course | undefined
  if (!typedCourse) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: progressRows }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_icon").eq("id", user.id).single(),
    supabase.from("user_progress").select("lesson_id, completed_step_ids, is_lesson_complete").eq("user_id", user.id),
  ])

  const allProgress = progressRows ?? []
  const completedIds = allProgress
    .filter((r: any) => r.is_lesson_complete)
    .map((r: any) => r.lesson_id as string)

  const inProgressMap = new Map<string, string[]>(
    allProgress
      .filter((r: any) => !r.is_lesson_complete && r.completed_step_ids?.length > 0)
      .map((r: any) => [r.lesson_id as string, r.completed_step_ids as string[]])
  )

  const inProgressId = [...inProgressMap.keys()][0]
  const progress = getCourseProgress(typedCourse, completedIds)
  const nextLesson = getNextLesson(typedCourse, completedIds)
  const flatLessons = getCourseLessons(typedCourse)
  const totalMinutes = flatLessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0)
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"

  return (
    <AppPageShell
      nav={
        <QuestNav
          active="courses"
          back={{ href: "/courses", label: "Courses" }}
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <CourseMasteryHeader
        course={typedCourse}
        progress={progress}
        completedCount={getCompletedLessonCount(typedCourse, completedIds)}
        totalLessons={flatLessons.length}
        nextLesson={nextLesson}
        totalMinutes={totalMinutes}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <div className="mb-8 lg:mb-10 text-center lg:text-left">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            Climb the steps
          </h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-2 max-w-xl mx-auto lg:mx-0">
            Each lesson is one tread higher toward checkmate mastery. Work through them in order — or jump to any step you like.
          </p>
        </div>

        <div className="rounded-[2rem] border border-gray-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 backdrop-blur-sm px-3 sm:px-6 py-8 lg:py-12">
          <MasteryStaircase
            course={typedCourse}
            completedLessonIds={completedIds}
            inProgressMap={inProgressMap}
            activeLessonId={inProgressId}
          />
        </div>

        <CourseKeyConceptsPanel lessonIds={flatLessons.map((l) => l.id)} />
        <CourseTacticalPatternsPanel lessonIds={flatLessons.map((l) => l.id)} />
      </main>
    </AppPageShell>
  )
}
