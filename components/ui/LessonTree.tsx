"use client"
import Link from "next/link"
import type { Course } from "@/lib/types"
import { isLessonUnlocked } from "@/lib/progress"
import { clsx } from "clsx"

// Chess-themed icon per lesson — keys match lesson IDs in the JSON
const LESSON_ICON: Record<string, string> = {
  "l-goal-of-chess":   "♚",
  "l-back-rank-mate":  "♜",
  "l-mating-patterns": "⚔",
  "l-queen-king-mate": "♛",
  "l-rook-king-mate":  "♜",
  "l-board-vision":    "♞",
  "l-find-checkmates": "🔍",
  "l-advanced-tactics": "⚔",
  "l-scholars-mate":   "♛",
}

interface Props {
  course: Course
  completedLessonIds: string[]
  inProgressMap: Map<string, string[]>
  /** If provided, that lesson node is highlighted as "currently open" */
  activeLessonId?: string
  /** Compact mode: smaller nodes, used in sidebars/dashboards */
  compact?: boolean
}

export function LessonTree({ course, completedLessonIds, inProgressMap, activeLessonId, compact = false }: Props) {
  // Flat list for previous-lesson-completed logic
  const flatLessons = course.chapters.flatMap(ch => ch.lessons)
  const totalLessons = flatLessons.length
  const allComplete = totalLessons > 0 && completedLessonIds.length >= totalLessons

  const nodeSize = compact ? "w-14 h-14" : "w-20 h-20"
  const iconSize = compact ? "text-2xl" : "text-3xl"
  const connectorH = compact ? "h-8" : "h-12"

  return (
    <div className="flex flex-col items-center">
      {course.chapters.map((chapter, chapterIdx) => {
        // Index of this chapter's first lesson in the flat list
        const chapterStartIdx = flatLessons.findIndex(l => l.id === chapter.lessons[0]?.id)

        return (
          <div key={chapter.id} className="flex flex-col items-center w-full">

            {/* Connector from previous section into the chapter badge */}
            {chapterIdx > 0 && (
              <div className={clsx(
                connectorH, "w-0.5 transition-colors duration-500",
                completedLessonIds.includes(flatLessons[chapterStartIdx - 1]?.id)
                  ? "bg-indigo-400" : "bg-gray-200"
              )} />
            )}

            {/* Chapter badge */}
            <div className="flex flex-col items-center my-3">
              <div className="px-5 py-2 bg-slate-800 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-md">
                {chapter.title}
              </div>
              {!compact && (
                <p className="text-xs text-gray-400 mt-1.5 text-center max-w-[200px]">
                  {chapter.description}
                </p>
              )}
            </div>

            {/* Lessons */}
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

              // Connector above this lesson is filled if the lesson before it is complete
              const connectorFilled = prevLesson
                ? completedLessonIds.includes(prevLesson.id)
                : false

              const icon = LESSON_ICON[lesson.id] ?? "♟"

              return (
                <div key={lesson.id} className="flex flex-col items-center w-full">
                  {/* Vertical connector above node */}
                  <div className={clsx(
                    connectorH, "w-0.5 transition-colors duration-500",
                    connectorFilled ? "bg-indigo-400" : "bg-gray-200"
                  )} />

                  {/* Node area */}
                  <div className="flex flex-col items-center gap-2.5">
                    <Link
                      href={unlocked ? `/lessons/${lesson.id}` : "#"}
                      className={clsx("flex flex-col items-center gap-2 group", !unlocked && "pointer-events-none")}
                    >
                      {/* Circle */}
                      <div className={clsx(
                        "relative flex items-center justify-center rounded-full font-bold transition-all duration-300 shadow-lg select-none",
                        nodeSize,
                        isActive && !isCompleted
                          ? "ring-4 ring-indigo-300 ring-offset-2"
                          : "",
                        isCompleted
                          ? "bg-indigo-600 text-white"
                          : isInProgress
                          ? "bg-amber-500 text-white"
                          : unlocked
                          ? "bg-white border-4 border-indigo-400 text-indigo-600 group-hover:border-indigo-600 group-hover:scale-105"
                          : "bg-gray-100 text-gray-300 shadow-none"
                      )}>
                        {/* Pulse ring for in-progress */}
                        {isInProgress && (
                          <span className="absolute inset-0 rounded-full bg-amber-400 opacity-25 animate-ping" />
                        )}

                        <span className={clsx(iconSize, "z-10 leading-none")}>
                          {isCompleted ? "✓" : !unlocked ? "🔒" : icon}
                        </span>
                      </div>

                      {/* Title & meta */}
                      {!compact && (
                        <div className="text-center max-w-[180px]">
                          <p className={clsx(
                            "text-sm font-semibold leading-snug",
                            unlocked ? "text-gray-900" : "text-gray-400"
                          )}>
                            {lesson.title}
                          </p>
                          <p className={clsx("text-xs mt-0.5", unlocked ? "text-gray-400" : "text-gray-300")}>
                            {lesson.estimatedMinutes} min · {totalSteps} steps
                          </p>
                          {isInProgress && (
                            <div className="mt-2 w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full transition-all"
                                style={{ width: `${stepPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Link>

                    {/* Action button */}
                    {unlocked && !compact && (
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className={clsx(
                          "px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm",
                          isCompleted  && "bg-gray-100 text-gray-600 hover:bg-gray-200",
                          isInProgress && "bg-amber-500 text-white hover:bg-amber-400",
                          !isCompleted && !isInProgress && "bg-indigo-600 text-white hover:bg-indigo-500"
                        )}
                      >
                        {isCompleted ? "Review" : isInProgress ? `Continue · ${stepsDone}/${totalSteps}` : "Start"}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Trophy at the bottom when all done */}
      {allComplete && (
        <div className="flex flex-col items-center mt-0 gap-2">
          <div className="w-0.5 h-10 bg-indigo-400" />
          <div className={clsx(
            "rounded-full bg-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-200",
            compact ? "w-12 h-12 text-2xl" : "w-16 h-16 text-3xl"
          )}>
            🏆
          </div>
          {!compact && (
            <p className="text-sm font-bold text-yellow-600 mt-1">Course Complete!</p>
          )}
        </div>
      )}
    </div>
  )
}
