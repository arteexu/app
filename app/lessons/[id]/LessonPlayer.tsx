"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import type { Course, Lesson } from "@/lib/types"
import { StepRenderer } from "@/components/lesson/StepRenderer"
import { LessonCompleteScreen } from "@/components/lesson/LessonCompleteScreen"
import { LessonHud } from "@/components/lesson/LessonHud"
import { LessonBoardOrientationProvider } from "@/hooks/useLessonBoardOrientation"
import { LessonSoundProvider } from "@/hooks/useLessonSounds"
import { playLessonSound } from "@/lib/ui-sounds"
import { createClient } from "@/lib/supabase/client"
import { calculateStreak, todayString, getNextLesson } from "@/lib/progress"

interface Props {
  lesson: Lesson
  course: Course
  courseId: string
  chapterId: string
  chapterTitle: string
  initialCompletedStepIds: string[]
  initialCompletedLessonIds: string[]
  userId: string
}

// XP credited to the HUD per graded step solved (keep in sync with lib/gamification STEP_XP if desired)
const SOLVE_XP = 40
const GRADED = ["puzzle", "multiple-choice", "move-multiple-choice", "identify", "find-all-checkmates", "play-vs-bot"]

export function LessonPlayer(props: Props) {
  const [replayKey, setReplayKey] = useState(0)
  return (
    <LessonSoundProvider>
      <LessonBoardOrientationProvider>
        <LessonSession key={replayKey} {...props} onReplay={() => setReplayKey(k => k + 1)} />
      </LessonBoardOrientationProvider>
    </LessonSoundProvider>
  )
}

interface SessionProps extends Props { onReplay: () => void }

function LessonSession({
  lesson, course, courseId, chapterId, chapterTitle,
  initialCompletedStepIds, initialCompletedLessonIds, userId, onReplay,
}: SessionProps) {
  const supabase = createClient()

  const alreadyComplete = initialCompletedStepIds.length >= lesson.steps.length
  const firstIncomplete = lesson.steps.findIndex(s => !initialCompletedStepIds.includes(s.id))
  const startIndex      = alreadyComplete ? 0 : firstIncomplete === -1 ? 0 : firstIncomplete

  const [viewIndex,          setViewIndex]          = useState(startIndex)
  const [currentIndex,       setCurrentIndex]       = useState(startIndex)
  const [completedStepIds,   setCompletedStepIds]   = useState<string[]>(alreadyComplete ? [] : initialCompletedStepIds)
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(initialCompletedLessonIds)
  const [finished,           setFinished]           = useState(false)

  // ── HUD gamification state ──
  const [combo,     setCombo]     = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  const [lit,       setLit]       = useState(false)
  const [elapsed,   setElapsed]   = useState(0)
  useEffect(() => { const id = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(id) }, [])
  const timerLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
  const timerPct   = (elapsed % 60) / 60

  const currentStep = lesson.steps[viewIndex]
  const isLastStep  = viewIndex === lesson.steps.length - 1
  const isReviewing = viewIndex < currentIndex

  function goTo(index: number) {
    if (index >= 0 && index <= currentIndex) setViewIndex(index)
  }

  async function handleStepComplete(isCorrect: boolean) {
    if (isReviewing) { setViewIndex(v => Math.min(currentIndex, v + 1)); return }
    if (!currentStep) return

    // HUD: combo / XP / ignite
    if (GRADED.includes(currentStep.type)) {
      if (isCorrect) {
        setCombo(c => {
          const next = c + 1
          if (next >= 2) playLessonSound("combo")
          return next
        })
        setSessionXp(x => x + SOLVE_XP)
        setLit(true)
        setTimeout(() => setLit(false), 1600)
      } else {
        setCombo(0)
      }
    }

    const stepId       = currentStep.id
    const nowCompleted = completedStepIds.includes(stepId) ? completedStepIds : [...completedStepIds, stepId]
    setCompletedStepIds(nowCompleted)

    await supabase.from("lesson_attempts").insert({
      user_id: userId, lesson_id: lesson.id, step_id: stepId, is_correct: isCorrect,
    })

    const isLessonDone = nowCompleted.length === lesson.steps.length

    await supabase.from("user_progress").upsert({
      user_id: userId, course_id: courseId, lesson_id: lesson.id,
      completed_step_ids: nowCompleted, is_lesson_complete: isLessonDone,
      ...(isLessonDone ? { completed_at: new Date().toISOString() } : {}),
    }, { onConflict: "user_id,lesson_id" })

    if (isLessonDone) {
      const { data: streakRow } = await supabase.from("user_streaks").select("*").eq("user_id", userId).single()
      const newStreak = calculateStreak(streakRow?.last_activity_date ?? null, streakRow?.current_streak ?? 0)
      await supabase.from("user_streaks").upsert({
        user_id: userId, current_streak: newStreak,
        longest_streak: Math.max(newStreak, streakRow?.longest_streak ?? 0), last_activity_date: todayString(),
      }, { onConflict: "user_id" })
      setCompletedLessonIds(prev => prev.includes(lesson.id) ? prev : [...prev, lesson.id])
      setFinished(true)
      return
    }

    const next = viewIndex + 1
    setCurrentIndex(next)
    setViewIndex(next)
  }

  // ── Completion screen ──
  if (finished) {
    const nextLesson = getNextLesson(course, completedLessonIds)
    return (
      <div className="h-screen flex flex-col dark:bg-slate-900">
        <LessonNav chapterTitle={chapterTitle} lessonTitle={lesson.title} courseId={courseId} />
        <LessonCompleteScreen
          lesson={lesson}
          course={course}
          courseId={courseId}
          chapterTitle={chapterTitle}
          completedLessonIds={completedLessonIds}
          nextLesson={nextLesson}
          sessionXp={sessionXp}
          elapsedSeconds={elapsed}
          onReplay={onReplay}
        />
      </div>
    )
  }

  // ── Active lesson ──
  if (!currentStep) return null

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 flex flex-col">
      <LessonNav chapterTitle={chapterTitle} lessonTitle={lesson.title} courseId={courseId} />

      <LessonHud
        steps={lesson.steps}
        viewIndex={viewIndex}
        currentIndex={currentIndex}
        completedStepIds={completedStepIds}
        onGoTo={goTo}
        combo={combo}
        sessionXp={sessionXp}
        timerLabel={timerLabel}
        timerPct={timerPct}
        lit={lit}
      />

      {isReviewing && (
        <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 sm:px-6 py-1.5 flex items-center justify-between gap-3">
          <span className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-medium truncate">Reviewing a completed step</span>
          <button onClick={() => setViewIndex(currentIndex)} className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap flex-shrink-0">
            Jump to current →
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <StepRenderer
          key={`${lesson.id}-${viewIndex}`}
          step={currentStep}
          onStepComplete={handleStepComplete}
          isLastStep={isLastStep}
        />
      </div>
    </div>
  )
}

// White Quest nav (brand left-aligned mark + breadcrumb + links)
function LessonNav({ chapterTitle, lessonTitle, courseId }: { chapterTitle: string; lessonTitle: string; courseId: string }) {
  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 h-[52px] flex items-center gap-3 flex-shrink-0">
      <Link href={`/courses/${courseId}`} className="text-sm text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition flex-shrink-0">
        ← {chapterTitle}
      </Link>
      <span className="text-gray-300 dark:text-slate-600">/</span>
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate min-w-0">{lessonTitle}</span>
      <div className="ml-auto flex items-center gap-4 flex-shrink-0">
        <Link href="/dashboard" className="font-display text-xl font-extrabold text-indigo-600 hover:text-indigo-500 transition">ChessMind</Link>
        <Link href="/dashboard" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">Dashboard</Link>
        <Link href="/settings/profile" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">Profile</Link>
      </div>
    </nav>
  )
}
