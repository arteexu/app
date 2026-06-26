// components/ui/QuestPath.tsx — winding adventure-map of the course
import Link from "next/link"
import type { Course } from "@/lib/types"
import { getChapterLessons, getCourseLessons } from "@/lib/courses"
import { isLessonUnlocked } from "@/lib/progress"
import { getLessonIcon } from "@/lib/lesson-icons"
import { clsx } from "clsx"

interface Props {
  course: Course
  completedLessonIds: string[]
  inProgressMap: Map<string, string[]>
  activeLessonId?: string
}

export function QuestPath({ course, completedLessonIds, inProgressMap, activeLessonId }: Props) {
  const flat = getCourseLessons(course)
  const allComplete = flat.length > 0 && completedLessonIds.length >= flat.length
  let lessonIdx = -1

  return (
    <div className="flex flex-col items-center py-2">
      <h2 className="font-display text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-1">
        Course path
      </h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 text-center max-w-xs">
        Each piece marks a lesson you can master
      </p>

      {course.chapters.map((chapter) => (
        <div key={chapter.id} className="flex flex-col items-center w-full">
          {/* Chapter banner */}
          <div className="my-6 px-6 py-2.5 bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-700 dark:to-slate-600 text-white rounded-full text-xs font-extrabold uppercase tracking-widest shadow-md shadow-slate-900/20">
            {chapter.title}
          </div>

          {getChapterLessons(chapter).map((lesson) => {
            lessonIdx++
            const prev = flat[lessonIdx - 1]
            const isCompleted  = completedLessonIds.includes(lesson.id)
            const isInProgress = inProgressMap.has(lesson.id)
            const unlocked     = isLessonUnlocked(course, lesson.id, completedLessonIds)
            const isActive     = lesson.id === activeLessonId
            const stepsDone    = inProgressMap.get(lesson.id)?.length ?? 0
            const totalSteps   = lesson.steps.length
            const connectorOn  = prev ? completedLessonIds.includes(prev.id) : false
            const offset       = lessonIdx % 2 === 0 ? "-128px" : "128px"
            const icon         = getLessonIcon(lesson.id)

            return (
              <div key={lesson.id} className="flex flex-col items-center w-full">
                {/* connector */}
                <div
                  className={clsx(
                    "w-1.5 h-10 rounded-full transition-colors duration-500",
                    connectorOn
                      ? "bg-gradient-to-b from-indigo-400 to-violet-500 shadow-sm shadow-indigo-400/30"
                      : "bg-gray-200 dark:bg-slate-700"
                  )}
                />

                <div
                  className="flex flex-col items-center gap-3"
                  style={{ transform: `translateX(${offset})` }}
                >
                  <Link
                    href={unlocked ? `/lessons/${lesson.id}` : "#"}
                    className={clsx(
                      "flex flex-col items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-2xl",
                      !unlocked && "pointer-events-none"
                    )}
                  >
                    {/* node pedestal */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={clsx(
                          "absolute -bottom-1 w-[72%] h-3 rounded-[100%] blur-[2px] transition-opacity",
                          isCompleted
                            ? "bg-indigo-500/35"
                            : isInProgress
                              ? "bg-amber-500/35"
                              : unlocked
                                ? "bg-indigo-300/25 group-hover:bg-indigo-400/35"
                                : "bg-gray-300/20 dark:bg-slate-600/20"
                        )}
                        aria-hidden
                      />

                      <div
                        className={clsx(
                          "relative w-[112px] h-[112px] rounded-[2rem] flex items-center justify-center select-none transition-all duration-300",
                          isActive && !isCompleted && "ring-4 ring-indigo-300 dark:ring-indigo-600 ring-offset-[3px] dark:ring-offset-slate-900 scale-[1.02]",
                          isCompleted
                            ? "bg-gradient-to-br from-indigo-500 via-violet-600 to-indigo-700 text-white shadow-xl shadow-indigo-500/45 ring-[3px] ring-amber-300/70 dark:ring-amber-400/50"
                            : isInProgress
                              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl shadow-orange-500/40 ring-[3px] ring-white/30"
                              : unlocked
                                ? "bg-white dark:bg-slate-800 border-[3px] border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 shadow-md group-hover:scale-[1.04] group-hover:border-indigo-500 group-hover:shadow-lg group-hover:shadow-indigo-500/15"
                                : "bg-gray-100 dark:bg-slate-800/80 text-gray-300 dark:text-slate-600 border border-gray-200 dark:border-slate-700"
                        )}
                      >
                        {isInProgress && (
                          <span className="absolute inset-2 rounded-[1.4rem] bg-amber-300/40 animate-ping motion-reduce:animate-none" />
                        )}

                        {isCompleted && (
                          <span
                            className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,transparent_55%)]"
                            aria-hidden
                          />
                        )}

                        <span className="z-10 text-[2.75rem] leading-none drop-shadow-sm">
                          {!unlocked ? "🔒" : icon}
                        </span>
                      </div>
                    </div>

                    {/* title + meta */}
                    <div className="text-center max-w-[220px]">
                      <p
                        className={clsx(
                          "font-display text-lg font-extrabold leading-snug",
                          unlocked ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-600"
                        )}
                      >
                        {lesson.title}
                      </p>
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-1">
                        {lesson.estimatedMinutes} min · {totalSteps} steps
                      </p>
                      {isCompleted && (
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 uppercase tracking-wide">
                          Mastered
                        </p>
                      )}
                      {isInProgress && !isCompleted && (
                        <div className="mt-2.5 w-full bg-amber-100 dark:bg-amber-950/40 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${totalSteps > 0 ? (stepsDone / totalSteps) * 100 : 0}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>

                  {unlocked && (
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className={clsx(
                        "px-6 py-2 rounded-full text-xs font-extrabold uppercase tracking-wide shadow-sm transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        isInProgress
                          ? "bg-orange-500 text-white shadow-orange-500/25 hover:bg-orange-400"
                          : isCompleted
                            ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                            : "bg-indigo-600 text-white shadow-indigo-500/25 hover:bg-indigo-500"
                      )}
                    >
                      {isInProgress ? `Continue · ${stepsDone}/${totalSteps}` : isCompleted ? "Review lesson" : "Start lesson"}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* finish trophy */}
      <div
        className={clsx(
          "w-1.5 h-10 rounded-full mt-0 transition-colors",
          allComplete ? "bg-gradient-to-b from-indigo-400 to-amber-400" : "bg-gray-200 dark:bg-slate-700"
        )}
      />
      <div
        className={clsx(
          "w-[96px] h-[96px] rounded-[1.75rem] flex items-center justify-center text-5xl mt-3 transition-all",
          allComplete
            ? "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-xl shadow-amber-400/40 ring-[3px] ring-amber-200/80"
            : "bg-gray-100 dark:bg-slate-800 grayscale opacity-50 border border-gray-200 dark:border-slate-700"
        )}
      >
        🏆
      </div>
      <p
        className={clsx(
          "font-display text-base font-extrabold mt-3",
          allComplete ? "text-amber-600 dark:text-amber-400" : "text-gray-300 dark:text-slate-600"
        )}
      >
        Course champion
      </p>
    </div>
  )
}
