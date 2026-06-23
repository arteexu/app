"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lesson } from "@/lib/types"
import { StepRenderer } from "@/components/lesson/StepRenderer"
import { ProgressBar } from "@/components/ui/progress-bar"
import { createClient } from "@/lib/supabase/client"
import { calculateStreak, todayString } from "@/lib/progress"

interface Props {
  lesson: Lesson
  courseId: string
  chapterId: string
  chapterTitle: string
  initialCompletedStepIds: string[]
  userId: string
}

export function LessonPlayer({ lesson, courseId, chapterId, chapterTitle, initialCompletedStepIds, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const alreadyComplete = initialCompletedStepIds.length >= lesson.steps.length
  const firstIncomplete = lesson.steps.findIndex(s => !initialCompletedStepIds.includes(s.id))

  // Already-complete lessons start from step 0 with a fresh slate so the learner can replay.
  // In-progress lessons resume from the first incomplete step.
  const [currentIndex, setCurrentIndex] = useState(
    alreadyComplete ? 0 : firstIncomplete === -1 ? 0 : firstIncomplete
  )
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(
    alreadyComplete ? [] : initialCompletedStepIds
  )
  const [finished, setFinished] = useState(false)

  const currentStep = lesson.steps[currentIndex]
  const isLastStep = currentIndex === lesson.steps.length - 1
  const progressPct = Math.round((completedStepIds.length / lesson.steps.length) * 100)

  // Guard: currentStep undefined means index ran past the end — treat as finished
  if (!currentStep && !finished) {
    setFinished(true)
    return null
  }

  async function handleStepComplete(isCorrect: boolean) {
    const stepId = currentStep.id
    const nowCompleted = completedStepIds.includes(stepId)
      ? completedStepIds
      : [...completedStepIds, stepId]

    setCompletedStepIds(nowCompleted)

    // Record attempt
    await supabase.from("lesson_attempts").insert({
      user_id: userId,
      lesson_id: lesson.id,
      step_id: stepId,
      is_correct: isCorrect,
    })

    const isLessonDone = nowCompleted.length === lesson.steps.length

    // Upsert progress
    await supabase.from("user_progress").upsert({
      user_id: userId,
      course_id: courseId,
      lesson_id: lesson.id,
      completed_step_ids: nowCompleted,
      is_lesson_complete: isLessonDone,
      ...(isLessonDone ? { completed_at: new Date().toISOString() } : {}),
    }, { onConflict: "user_id,lesson_id" })

    if (isLessonDone) {
      // Update streak
      const { data: streakRow } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .single()
      const newStreak = calculateStreak(streakRow?.last_activity_date ?? null, streakRow?.current_streak ?? 0)
      await supabase.from("user_streaks").upsert({
        user_id: userId,
        current_streak: newStreak,
        longest_streak: Math.max(newStreak, streakRow?.longest_streak ?? 0),
        last_activity_date: todayString(),
      }, { onConflict: "user_id" })
      setFinished(true)
      return
    }

    if (!isLastStep) {
      setCurrentIndex(i => i + 1)
    }
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <LessonNav chapterTitle={chapterTitle} lessonTitle={lesson.title} courseId={courseId} />
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6 text-center">
          <div className="text-6xl">🎉</div>
          <h2 className="text-3xl font-bold text-gray-900">Lesson complete!</h2>
          <p className="text-gray-500 max-w-sm">
            You finished <strong>{lesson.title}</strong>. The next lesson is now unlocked.
          </p>
          <div className="flex gap-3">
            <Link
              href={`/courses/${courseId}`}
              className="px-6 py-3 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Back to course
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition"
            >
              Go to dashboard →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <LessonNav chapterTitle={chapterTitle} lessonTitle={lesson.title} courseId={courseId} />

      {/* Step progress bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2">
        <ProgressBar value={progressPct} />
        <p className="text-xs text-gray-400 mt-1">
          Step {Math.min(currentIndex + 1, lesson.steps.length)} of {lesson.steps.length}
        </p>
      </div>

      {/* Step content — fills remaining height; each step component manages its own layout */}
      <div className="flex-1 min-h-0 flex flex-col">
        <StepRenderer
          key={currentStep.id}
          step={currentStep}
          onStepComplete={handleStepComplete}
          isLastStep={isLastStep}
        />
      </div>
    </div>
  )
}

function LessonNav({ chapterTitle, lessonTitle, courseId }: { chapterTitle: string; lessonTitle: string; courseId: string }) {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
      <Link href={`/courses/${courseId}`} className="text-sm text-gray-400 hover:text-gray-700">
        ← {chapterTitle}
      </Link>
      <span className="text-gray-300">/</span>
      <span className="text-sm font-medium text-gray-700 truncate">{lessonTitle}</span>
      <span className="ml-auto text-xl font-bold text-indigo-600">ChessMind</span>
    </nav>
  )
}
