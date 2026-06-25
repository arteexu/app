"use client"
import Link from "next/link"
import type { Course } from "@/lib/types"
import { isLessonUnlocked } from "@/lib/progress"
import { getLessonIcon } from "@/lib/lesson-icons"
import { clsx } from "clsx"

interface Props {
  course: Course
  completedLessonIds: string[]
  inProgressMap: Map<string, string[]>
  activeLessonId?: string
  compact?: boolean
}

export function LessonTree({ course, completedLessonIds, inProgressMap, activeLessonId, compact = false }: Props) {
  const flatLessons = course.chapters.flatMap(ch => ch.lessons)
  const totalLessons = flatLessons.length
  const allComplete = totalLessons > 0 && completedLessonIds.length >= totalLessons

  const nodeSize = compact ? "w-16 h-16 rounded-2xl" : "w-[104px] h-[104px] rounded-[1.75rem]"
  const iconSize = compact ? "text-2xl" : "text-[2.5rem]"
  const connectorH = compact ? "h-8" : "h-10"

  return (
    <div className="flex flex-col items-center">
      {course.chapters.map((chapter, chapterIdx) => {
        const chapterStartIdx = flatLessons.findIndex(l => l.id === chapter.lessons[0]?.id)

        return (
          <div key={chapter.id} className="flex flex-col items-center w-full">
            {chapterIdx > 0 && (
              <div
                className={clsx(
                  connectorH, "w-1.5 transition-colors duration-500 rounded-full",
                  completedLessonIds.includes(flatLessons[chapterStartIdx - 1]?.id)
                    ? "bg-indigo-400" : "bg-gray-200 dark:bg-slate-700"
                )}
              />
            )}

            <div className="flex flex-col items-center my-4">
              <div className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-md">
                {chapter.title}
              </div>
              {!compact && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 text-center max-w-[240px]">
                  {chapter.description}
                </p>
              )}
            </div>

            {chapter.lessons.map((lesson, lessonIdx) => {
              const globalIdx = chapterStartIdx + lessonIdx
              const prevLesson = globalIdx > 0 ? flatLessons[globalIdx - 1] : null

              const isCompleted  = completedLessonIds.includes(lesson.id)
              const isInProgress = inProgressMap.has(lesson.id)
              const isActive     = lesson.id === activeLessonId
              const unlocked     = isLessonUnlocked(course, lesson.id, completedLessonIds)
              const stepsDone    = inProgressMap.get(lesson.id)?.length ?? 0
              const totalSteps   = lesson.steps.length
              const stepPct      = totalSteps > 0 ? Math.round((stepsDone / totalSteps) * 100) : 0
              const connectorFilled = prevLesson ? completedLessonIds.includes(prevLesson.id) : false
              const icon = getLessonIcon(lesson.id)

              return (
                <div key={lesson.id} className="flex flex-col items-center w-full">
                  <div
                    className={clsx(
                      connectorH, "w-1.5 transition-colors duration-500 rounded-full",
                      connectorFilled ? "bg-indigo-400" : "bg-gray-200 dark:bg-slate-700"
                    )}
                  />

                  <div className="flex flex-col items-center gap-3">
                    <Link
                      href={unlocked ? `/lessons/${lesson.id}` : "#"}
                      className={clsx("flex flex-col items-center gap-3 group", !unlocked && "pointer-events-none")}
                    >
                      <div
                        className={clsx(
                          "relative flex items-center justify-center font-bold transition-all duration-300 shadow-lg select-none",
                          nodeSize,
                          isActive && !isCompleted && "ring-4 ring-indigo-300 dark:ring-indigo-600 ring-offset-2",
                          isCompleted
                            ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-[3px] ring-amber-300/60"
                            : isInProgress
                              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                              : unlocked
                                ? "bg-white dark:bg-slate-800 border-[3px] border-indigo-300 dark:border-indigo-600 text-indigo-600 group-hover:scale-[1.04] group-hover:border-indigo-500"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-300 shadow-none border border-gray-200 dark:border-slate-700"
                        )}
                      >
                        {isInProgress && (
                          <span className="absolute inset-1 rounded-[1.25rem] bg-amber-400/30 animate-ping motion-reduce:animate-none" />
                        )}

                        <span className={clsx(iconSize, "z-10 leading-none")}>
                          {!unlocked ? "🔒" : icon}
                        </span>
                      </div>

                      {!compact && (
                        <div className="text-center max-w-[220px]">
                          <p className={clsx(
                            "font-display text-lg font-extrabold leading-snug",
                            unlocked ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-600"
                          )}>
                            {lesson.title}
                          </p>
                          <p className={clsx("text-sm mt-1", unlocked ? "text-gray-500 dark:text-slate-400" : "text-gray-300")}>
                            {lesson.estimatedMinutes} min · {totalSteps} steps
                          </p>
                          {isCompleted && (
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 uppercase tracking-wide">
                              Mastered
                            </p>
                          )}
                          {isInProgress && (
                            <div className="mt-2.5 w-full bg-amber-100 dark:bg-amber-950/40 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all"
                                style={{ width: `${stepPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Link>

                    {unlocked && !compact && (
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className={clsx(
                          "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm hover:scale-[1.03]",
                          isCompleted && "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
                          isInProgress && "bg-amber-500 text-white hover:bg-amber-400",
                          !isCompleted && !isInProgress && "bg-indigo-600 text-white hover:bg-indigo-500"
                        )}
                      >
                        {isCompleted ? "Review lesson" : isInProgress ? `Continue · ${stepsDone}/${totalSteps}` : "Start lesson"}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {allComplete && (
        <div className="flex flex-col items-center mt-0 gap-2">
          <div className="w-1.5 h-10 bg-indigo-400 rounded-full" />
          <div className={clsx(
            "rounded-[1.5rem] bg-gradient-to-br from-amber-300 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-200/50",
            compact ? "w-14 h-14 text-2xl" : "w-20 h-20 text-4xl"
          )}>
            🏆
          </div>
          {!compact && (
            <p className="font-display text-base font-extrabold text-amber-600 dark:text-amber-400 mt-1">Course complete</p>
          )}
        </div>
      )}
    </div>
  )
}
