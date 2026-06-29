import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { findLessonInCourses } from "@/lib/courses"
import { LessonPlayer } from "./LessonPlayer"

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { id } = await params
  const { step: initialStepId } = await searchParams
  const match = findLessonInCourses(id)
  if (!match) notFound()
  const { course: typedCourse, lesson, chapter } = match

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  // Fetch current lesson's step-level progress AND all completed lessons
  const [{ data: stepProgress }, { data: lessonProgress }] = await Promise.all([
    supabase
      .from("user_progress")
      .select("completed_step_ids")
      .eq("user_id", user.id)
      .eq("lesson_id", id)
      .single(),
    supabase
      .from("user_progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("is_lesson_complete", true),
  ])

  const completedStepIds: string[] = stepProgress?.completed_step_ids ?? []
  const completedLessonIds: string[] = (lessonProgress ?? []).map((r: any) => r.lesson_id)
  return (
    <LessonPlayer
      lesson={lesson}
      course={typedCourse}
      courseId={typedCourse.id}
      chapterId={chapter?.id ?? ""}
      chapterTitle={chapter?.title ?? ""}
      initialCompletedStepIds={completedStepIds}
      initialCompletedLessonIds={completedLessonIds}
      initialStepId={initialStepId}
      userId={user.id}
    />
  )
}
