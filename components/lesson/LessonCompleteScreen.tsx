"use client"

import Link from "next/link"
import { useSoundOnActive } from "@/hooks/useLessonSounds"
import type { Course, Lesson } from "@/lib/types"
import { getChapterLessons, getCourseLessons } from "@/lib/courses"
import { isLessonUnlocked } from "@/lib/progress"
import { getLessonIcon } from "@/lib/lesson-icons"
import { clsx } from "clsx"

interface Props {
  lesson: Lesson
  course: Course
  courseId: string
  chapterTitle: string
  completedLessonIds: string[]
  nextLesson: Lesson | null
  sessionXp: number
  elapsedSeconds: number
  onReplay: () => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function LessonCompleteScreen({
  lesson,
  course,
  courseId,
  chapterTitle,
  completedLessonIds,
  nextLesson,
  sessionXp,
  elapsedSeconds,
  onReplay,
}: Props) {
  useSoundOnActive(true, "lessonComplete")
  const icon = getLessonIcon(lesson.id)
  const courseComplete = !nextLesson
  const totalLessons = getCourseLessons(course).length
  const lessonsDone = completedLessonIds.filter(id =>
    course.chapters.some(ch => getChapterLessons(ch).some(l => l.id === id))
  ).length

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
      {/* Celebration panel */}
      <div className="lg:w-[420px] flex flex-col items-center lg:items-start justify-center gap-6 px-8 py-10 lg:py-12 lg:border-r border-gray-100 dark:border-slate-800 bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900">
        <div className="relative flex flex-col items-center lg:items-start w-full">
          <div
            className="absolute top-8 left-1/2 lg:left-[3.5rem] -translate-x-1/2 w-40 h-40 rounded-full bg-amber-300/25 blur-2xl motion-reduce:blur-none"
            aria-hidden
          />

          <div className="relative flex flex-col items-center lg:items-start">
            <div className="relative">
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[80%] h-4 rounded-[100%] bg-indigo-500/30 blur-[2px]"
                aria-hidden
              />
              <div className="relative w-[120px] h-[120px] rounded-[2rem] flex items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-white shadow-xl shadow-indigo-500/45 ring-[4px] ring-amber-300/75 dark:ring-amber-400/55">
                <span
                  className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.25)_0%,transparent_55%)]"
                  aria-hidden
                />
                <span className="relative z-10 text-[3rem] leading-none drop-shadow-md">{icon}</span>
              </div>
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Mastered
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-1 text-center lg:text-left">
              Lesson complete
            </h2>
            <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 mt-2 text-center lg:text-left max-w-sm">
              {lesson.title}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 text-center lg:text-left max-w-sm leading-relaxed">
              {courseComplete
                ? `You finished all ${totalLessons} lessons in ${chapterTitle ? "this course" : "the course"}.`
                : nextLesson
                  ? `"${nextLesson.title}" is ready when you are.`
                  : "Nice work — keep building your chess intuition."}
            </p>
          </div>
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
          {[
            { label: "Steps", value: String(lesson.steps.length) },
            { label: "Time", value: formatTime(elapsedSeconds) },
            { label: "XP", value: `+${sessionXp}` },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 px-3 py-3 text-center shadow-sm"
            >
              <p className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">{stat.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {nextLesson && (
            <Link
              href={`/lessons/${nextLesson.id}`}
              className="flex items-center gap-3 justify-center bg-indigo-600 text-white rounded-2xl px-6 py-3.5 font-bold hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/25 hover:scale-[1.01]"
            >
              <span className="text-2xl leading-none">{getLessonIcon(nextLesson.id)}</span>
              <span className="text-left">
                <span className="block text-[10px] uppercase tracking-wide opacity-80">Up next</span>
                <span className="block text-sm">{nextLesson.title}</span>
              </span>
              <span className="ml-auto">→</span>
            </Link>
          )}
          {courseComplete && (
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/30 border border-amber-200/80 dark:border-amber-800/50 px-5 py-4">
              <span className="text-4xl leading-none">🏆</span>
              <div>
                <p className="font-display font-extrabold text-amber-800 dark:text-amber-300">Course champion</p>
                <p className="text-sm text-amber-700/80 dark:text-amber-400/80">{lessonsDone}/{totalLessons} lessons mastered</p>
              </div>
            </div>
          )}
          <button
            onClick={onReplay}
            className="flex items-center justify-center border-2 border-gray-200 dark:border-slate-700 rounded-2xl px-6 py-3 font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
          >
            Replay lesson
          </button>
          <div className="flex gap-4 justify-center pt-1">
            <Link href={`/courses/${courseId}`} className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              All lessons
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Path overview */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8">
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">
          Your path · {lessonsDone}/{totalLessons} mastered
        </p>

        <div className="flex flex-col gap-10 max-w-2xl">
          {course.chapters.map(chapter => (
            <div key={chapter.id}>
              <div className="inline-flex px-4 py-1.5 mb-4 bg-slate-800 dark:bg-slate-700 text-white rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                {chapter.title}
              </div>

              <div className="flex flex-col gap-3">
                {getChapterLessons(chapter).map(l => {
                  const isDone = completedLessonIds.includes(l.id)
                  const isCurrent = l.id === lesson.id
                  const isNext = nextLesson?.id === l.id
                  const unlocked = isLessonUnlocked(course, l.id, completedLessonIds)
                  const lessonIcon = getLessonIcon(l.id)

                  return (
                    <div
                      key={l.id}
                      className={clsx(
                        "flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-colors",
                        isCurrent && isDone && "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20",
                        isNext && "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20",
                        !isCurrent && !isNext && isDone && "border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-slate-800/50",
                        !isDone && unlocked && "border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800/30",
                        !unlocked && "border-gray-100 dark:border-slate-800 opacity-60"
                      )}
                    >
                      <div
                        className={clsx(
                          "relative w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl leading-none shadow-sm",
                          isDone && isCurrent && "bg-gradient-to-br from-indigo-500 to-violet-600 ring-[3px] ring-emerald-400/70 text-white",
                          isDone && !isCurrent && "bg-gradient-to-br from-indigo-500 to-violet-600 ring-[2px] ring-amber-300/60 text-white",
                          isNext && !isDone && "bg-white dark:bg-slate-800 border-[3px] border-amber-400 text-amber-600 dark:text-amber-400",
                          !isDone && !isNext && unlocked && "bg-white dark:bg-slate-800 border-2 border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-500",
                          !unlocked && "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 border border-gray-200 dark:border-slate-700"
                        )}
                      >
                        {!unlocked ? "🔒" : lessonIcon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={clsx(
                              "font-display text-base font-extrabold truncate",
                              isDone ? "text-gray-900 dark:text-slate-100" : unlocked ? "text-gray-800 dark:text-slate-200" : "text-gray-400"
                            )}
                          >
                            {l.title}
                          </span>
                          {isCurrent && isDone && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">
                              Just mastered
                            </span>
                          )}
                          {isNext && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex-shrink-0">
                              Up next
                            </span>
                          )}
                          {isDone && !isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 flex-shrink-0">
                              Mastered
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                          {l.estimatedMinutes} min · {l.steps.length} steps
                        </p>
                      </div>

                      {unlocked && (
                        <Link
                          href={`/lessons/${l.id}`}
                          className={clsx(
                            "flex-shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-xl transition hover:scale-[1.02]",
                            isNext && "bg-amber-500 text-white hover:bg-amber-400 shadow-sm shadow-amber-500/25",
                            isCurrent && isDone && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200",
                            isDone && !isCurrent && !isNext && "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
                            !isDone && !isNext && "bg-indigo-600 text-white hover:bg-indigo-500"
                          )}
                        >
                          {isNext ? "Start →" : isDone ? "Review" : "Start"}
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
  )
}
