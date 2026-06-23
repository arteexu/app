import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { findLesson, findChapterForLesson } from "@/lib/progress"
import course from "@/content/courses/chess-attack-and-checkmate.json"
import type { Course } from "@/lib/types"
import { LessonPlayer } from "./LessonPlayer"

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const typedCourse = course as unknown as Course
  const lesson = findLesson(typedCourse, id)
  if (!lesson) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: progress } = await supabase
    .from("user_progress")
    .select("completed_step_ids")
    .eq("user_id", user.id)
    .eq("lesson_id", id)
    .single()

  const completedStepIds: string[] = progress?.completed_step_ids ?? []
  const chapter = findChapterForLesson(typedCourse, id)

  return (
    <LessonPlayer
      lesson={lesson}
      courseId={typedCourse.id}
      chapterId={chapter?.id ?? ""}
      chapterTitle={chapter?.title ?? ""}
      initialCompletedStepIds={completedStepIds}
      userId={user.id}
    />
  )
}
