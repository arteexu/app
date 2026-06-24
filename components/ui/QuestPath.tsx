// components/ui/QuestPath.tsx — winding adventure-map of the course
// Server component. Alternating lesson nodes, chapter banners, locked/done/in-progress states.
import Link from "next/link"
import type { Course } from "@/lib/types"
import { isLessonUnlocked } from "@/lib/progress"
import { clsx } from "clsx"

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
  activeLessonId?: string
}

export function QuestPath({ course, completedLessonIds, inProgressMap, activeLessonId }: Props) {
  const flat = course.chapters.flatMap(ch => ch.lessons)
  const allComplete = flat.length > 0 && completedLessonIds.length >= flat.length
  let lessonIdx = -1

  return (
    <div className="flex flex-col items-center">
      <h2 className="font-display text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-2">Your Quest</h2>

      {course.chapters.map((chapter, ci) => (
        <div key={chapter.id} className="flex flex-col items-center w-full">
          {/* Chapter banner */}
          <div className="my-5 px-5 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-full text-xs font-extrabold uppercase tracking-widest shadow-md">
            {chapter.title}
          </div>

          {chapter.lessons.map((lesson) => {
            lessonIdx++
            const prev = flat[lessonIdx - 1]
            const isCompleted  = completedLessonIds.includes(lesson.id)
            const isInProgress = inProgressMap.has(lesson.id)
            const unlocked     = isLessonUnlocked(course, lesson.id, completedLessonIds)
            const isActive     = lesson.id === activeLessonId
            const stepsDone    = inProgressMap.get(lesson.id)?.length ?? 0
            const totalSteps   = lesson.steps.length
            const connectorOn  = prev ? completedLessonIds.includes(prev.id) : false
            const offset       = lessonIdx % 2 === 0 ? "-110px" : "110px"
            const icon         = LESSON_ICON[lesson.id] ?? "♟"

            return (
              <div key={lesson.id} className="flex flex-col items-center w-full">
                {/* connector above */}
                <div className={clsx("w-1 h-7 rounded-full", connectorOn ? "bg-indigo-400" : "bg-gray-200 dark:bg-slate-700")} />

                <div className="flex flex-col items-center gap-2.5" style={{ transform: `translateX(${offset})` }}>
                  <Link
                    href={unlocked ? `/lessons/${lesson.id}` : "#"}
                    className={clsx("flex flex-col items-center gap-2 group", !unlocked && "pointer-events-none")}
                  >
                    {/* node */}
                    <div className={clsx(
                      "relative w-[88px] h-[88px] rounded-full flex items-center justify-center text-4xl font-bold select-none transition-all duration-300",
                      isActive && !isCompleted && "ring-4 ring-indigo-300 dark:ring-indigo-700 ring-offset-2 dark:ring-offset-slate-900",
                      isCompleted
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40"
                        : isInProgress
                          ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/40"
                          : unlocked
                            ? "bg-white dark:bg-slate-800 border-[3px] border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-500 group-hover:scale-105 group-hover:border-indigo-500"
                            : "bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600"
                    )}>
                      {isInProgress && (
                        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-30 animate-ping" />
                      )}
                      <span className="z-10 leading-none">
                        {isCompleted ? "✓" : !unlocked ? "🔒" : icon}
                      </span>
                    </div>

                    {/* title + meta */}
                    <div className="text-center max-w-[190px]">
                      <p className={clsx("text-base font-bold leading-tight", unlocked ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-600")}>
                        {lesson.title}
                      </p>
                      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 mt-0.5">
                        {lesson.estimatedMinutes} min · {totalSteps} steps
                      </p>
                    </div>
                  </Link>

                  {/* action pill */}
                  {unlocked && (
                    <Link
                      href={`/lessons/${lesson.id}`}
                      className={clsx(
                        "px-5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide shadow-sm transition-all hover:scale-105",
                        isInProgress ? "bg-orange-500 text-white"
                          : isCompleted ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                          : "bg-indigo-600 text-white"
                      )}
                    >
                      {isInProgress ? `Continue · ${stepsDone}/${totalSteps}` : isCompleted ? "Review" : "Start"}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* finish trophy */}
      <div className={clsx("w-1 h-7 rounded-full mt-0", allComplete ? "bg-indigo-400" : "bg-gray-200 dark:bg-slate-700")} />
      <div className={clsx(
        "w-[76px] h-[76px] rounded-full flex items-center justify-center text-4xl shadow-lg mt-2",
        allComplete ? "bg-gradient-to-br from-amber-300 to-yellow-500 shadow-yellow-400/40" : "bg-gray-100 dark:bg-slate-800 grayscale opacity-60"
      )}>
        🏆
      </div>
      <p className={clsx("text-sm font-extrabold mt-2", allComplete ? "text-amber-500" : "text-gray-300 dark:text-slate-600")}>
        Course Champion
      </p>
    </div>
  )
}
