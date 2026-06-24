"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import type { Course, Lesson } from "@/lib/types"
import { StepRenderer } from "@/components/lesson/StepRenderer"
import { LessonHud } from "@/components/lesson/LessonHud"
import { createClient } from "@/lib/supabase/client"
import { calculateStreak, todayString, getNextLesson, isLessonUnlocked } from "@/lib/progress"
import { clsx } from "clsx"

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
  return <LessonSession key={replayKey} {...props} onReplay={() => setReplayKey(k => k + 1)} />
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
      if (isCorrect) { setCombo(c => c + 1); setSessionXp(x => x + SOLVE_XP); setLit(true); setTimeout(() => setLit(false), 1600) }
      else setCombo(0)
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

  // ── Completion screen (unchanged) ──
  if (finished) {
    const nextLesson = getNextLesson(course, completedLessonIds)
    return (
      <div className="h-screen flex flex-col dark:bg-slate-900">
        <LessonNav chapterTitle={chapterTitle} lessonTitle={lesson.title} courseId={courseId} />
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div className="lg:w-96 flex flex-col items-center lg:items-start justify-center gap-6 px-10 py-10 lg:border-r border-gray-100 dark:border-slate-800">
            <div className="text-6xl">🎉</div>
            <div className="text-center lg:text-left">
              <h2 className="font-display text-3xl font-extrabold text-gray-900 dark:text-slate-100">Lesson complete!</h2>
              <p className="text-gray-500 dark:text-slate-400 mt-2 max-w-xs">
                You finished <strong className="text-gray-700 dark:text-slate-200">{lesson.title}</strong>.
                {nextLesson ? " The next lesson is now unlocked." : " You've completed the entire course!"}
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              {nextLesson && (
                <Link href={`/lessons/${nextLesson.id}`} className="flex items-center justify-center bg-indigo-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-indigo-500 transition">
                  Next: {nextLesson.title} →
                </Link>
              )}
              <button onClick={onReplay} className="flex items-center justify-center border border-gray-200 dark:border-slate-700 rounded-xl px-6 py-3 font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                ↺ Replay lesson
              </button>
              <Link href={`/courses/${courseId}`} className="flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition">View all lessons</Link>
              <Link href="/dashboard" className="flex items-center justify-center text-sm text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition">Go to dashboard</Link>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">Your path</p>
            <div className="flex flex-col gap-8">
              {course.chapters.map(chapter => (
                <div key={chapter.id}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">{chapter.title}</p>
                  <div className="flex flex-col gap-2">
                    {chapter.lessons.map(l => {
                      const isDone    = completedLessonIds.includes(l.id)
                      const isCurrent = l.id === lesson.id
                      const isNext    = nextLesson?.id === l.id
                      const unlocked  = isLessonUnlocked(course, l.id, completedLessonIds)
                      return (
                        <div key={l.id} className="flex items-center gap-3">
                          <div className={clsx(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                            isDone && isCurrent  && "bg-green-500 text-white ring-2 ring-green-200 dark:ring-green-800",
                            isDone && !isCurrent && "bg-indigo-600 text-white",
                            isNext               && "bg-white dark:bg-slate-800 border-2 border-amber-400 text-amber-500",
                            !isDone && !isNext && unlocked && "bg-white dark:bg-slate-800 border-2 border-indigo-300 text-indigo-400",
                            !unlocked && "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600"
                          )}>
                            {isDone ? "✓" : !unlocked ? "🔒" : "→"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={clsx("text-sm font-medium truncate",
                                isDone ? "text-gray-900 dark:text-slate-100" : unlocked ? "text-gray-700 dark:text-slate-300" : "text-gray-400 dark:text-slate-600"
                              )}>{l.title}</span>
                              {isCurrent && isDone && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Just finished!</span>}
                              {isNext && <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Up next</span>}
                            </div>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{l.estimatedMinutes} min · {l.steps.length} steps</p>
                          </div>
                          {unlocked && (
                            <Link href={`/lessons/${l.id}`} className={clsx(
                              "flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition",
                              isNext ? "bg-amber-500 text-white hover:bg-amber-400"
                              : isCurrent && isDone ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"
                              : "text-indigo-600 dark:text-indigo-400 hover:underline"
                            )}>
                              {isNext ? "Start →" : isDone ? "Replay" : "Start"}
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active lesson ──
  if (!currentStep) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
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
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-2 flex items-center justify-between">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Reviewing a completed step</span>
          <button onClick={() => setViewIndex(currentIndex)} className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline">
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
