"use client"

import Link from "next/link"
import { Fragment, useId } from "react"
import type { Course } from "@/lib/types"
import { getChapterLessons } from "@/lib/courses"
import { getCourseLessons } from "@/lib/courses"
import { isLessonUnlocked } from "@/lib/progress"
import { getLessonIcon } from "@/lib/lesson-icons"
import { clsx } from "clsx"

const SPINE_LEFT = 80
const SPINE_RIGHT = 320
const SPINE_CENTER = 200

type SpineAlign = "left" | "right" | "center"

function spineX(align: SpineAlign): number {
  return align === "left" ? SPINE_LEFT : align === "right" ? SPINE_RIGHT : SPINE_CENTER
}

function alignForStep(step: number): "left" | "right" {
  return step % 2 === 1 ? "left" : "right"
}

function buildConnectorPath(from: SpineAlign, to: SpineAlign, height: number): string {
  const x1 = spineX(from)
  const x2 = spineX(to)
  if (x1 === x2) return `M ${x1} 0 L ${x2} ${height}`
  const qx = (x1 + x2) / 2
  const qy = height / 2
  return `M ${x1} 0 Q ${qx} ${qy} ${x2} ${height}`
}

function SpineConnector({
  from,
  to,
  variant = "step",
}: {
  from: SpineAlign
  to: SpineAlign
  variant?: "step" | "first-lesson" | "chapter"
}) {
  const gradientId = useId()
  const height =
    variant === "chapter" ? 140 : variant === "first-lesson" ? 112 : 48
  const overlapClass =
    variant === "chapter" ? "-my-6" : variant === "first-lesson" ? "-my-3" : "-my-4"
  const d = buildConnectorPath(from, to, height)

  return (
    <div
      className={clsx(
        "hidden lg:block relative w-full pointer-events-none z-0 overflow-visible",
        "h-0",
        overlapClass
      )}
      aria-hidden
    >
      <svg
        className="absolute left-1/2 -translate-x-1/2 w-[480px] max-w-[70%]"
        style={{ top: -height / 2, height }}
        viewBox={`0 0 400 ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(129 140 248 / 0.3)" />
            <stop offset="55%" stopColor="rgb(129 140 248 / 0.28)" />
            <stop offset="100%" stopColor="rgb(251 191 36 / 0.35)" />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          strokeDasharray="8 10"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

interface Props {
  course: Course
  completedLessonIds: string[]
  inProgressMap: Map<string, string[]>
  activeLessonId?: string
}

function checkerTread(className?: string) {
  return (
    <div
      className={clsx("rounded-lg opacity-90", className)}
      style={{
        backgroundImage: `
          linear-gradient(90deg, #eeeed2 50%, transparent 50%),
          linear-gradient(#769656 50%, #eeeed2 50%)
        `,
        backgroundSize: "14px 14px",
      }}
      aria-hidden
    />
  )
}

interface LessonNodeProps {
  lesson: Course["chapters"][0]["lessons"][0]
  stepNumber: number
  isCompleted: boolean
  isInProgress: boolean
  isActive: boolean
  unlocked: boolean
  stepsDone: number
  totalSteps: number
  align: "left" | "right"
}

function LessonNode({
  lesson,
  stepNumber,
  isCompleted,
  isInProgress,
  isActive,
  unlocked,
  stepsDone,
  totalSteps,
  align,
}: LessonNodeProps) {
  const icon = getLessonIcon(lesson.id)
  const stepPct = totalSteps > 0 ? Math.round((stepsDone / totalSteps) * 100) : 0

  return (
    <div
      className={clsx(
        "relative group max-w-[420px] w-full",
        align === "left" ? "mr-auto" : "ml-auto"
      )}
      style={{ ["--step" as string]: stepNumber }}
    >
      {/* Stair tread — desktop */}
      <div
        className={clsx(
          "hidden lg:block absolute -bottom-3 h-5 w-[108%] rounded-md shadow-lg",
          align === "left" ? "-left-2" : "-right-2",
          isCompleted ? "bg-[#5a7a42]" : isInProgress ? "bg-[#8b6914]" : "bg-[#5a7a42]/80"
        )}
        style={{ transform: align === "left" ? "skewX(-6deg) rotate(-1deg)" : "skewX(6deg) rotate(1deg)" }}
        aria-hidden
      >
        {checkerTread("absolute inset-0 rounded-md mix-blend-overlay")}
      </div>
      <div
        className={clsx(
          "hidden lg:block absolute -bottom-7 h-4 w-[104%] rounded-b-md opacity-70 bg-[#3d5230]",
          align === "left" ? "-left-1" : "-right-1"
        )}
        style={{ transform: align === "left" ? "skewX(-6deg)" : "skewX(6deg)" }}
        aria-hidden
      />

      <div
        className={clsx(
          "relative rounded-2xl border-2 p-4 sm:p-5 transition-all duration-300",
          "bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm mastery-stair-step",
          isCompleted
            ? "border-indigo-200 dark:border-indigo-800 shadow-lg shadow-indigo-500/10"
            : isInProgress
              ? "border-amber-300 dark:border-amber-700 shadow-lg shadow-amber-500/15 ring-2 ring-amber-200/50 dark:ring-amber-800/40"
              : unlocked
                ? "border-gray-200 dark:border-slate-700 shadow-md hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 hover:-translate-y-0.5"
                : "border-gray-100 dark:border-slate-800 opacity-60"
        )}
        style={{ animationDelay: `${stepNumber * 55}ms` }}
      >
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <span
              className={clsx(
                "text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full",
                isCompleted
                  ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  : isInProgress
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
              )}
            >
              Step {stepNumber}
            </span>

            <Link
              href={unlocked ? `/lessons/${lesson.id}` : "#"}
              className={clsx(
                "relative flex items-center justify-center w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-[1.35rem] font-bold transition-all duration-300",
                !unlocked && "pointer-events-none",
                isActive && !isCompleted && "ring-4 ring-indigo-300 dark:ring-indigo-600 ring-offset-2",
                isCompleted
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-[3px] ring-amber-300/60 shadow-lg shadow-indigo-500/30"
                  : isInProgress
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/30"
                    : unlocked
                      ? "bg-white dark:bg-slate-800 border-[3px] border-indigo-300 dark:border-indigo-600 text-indigo-600 group-hover:scale-[1.04]"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-300 border border-gray-200 dark:border-slate-700"
              )}
            >
              {isInProgress && (
                <span className="absolute inset-1.5 rounded-[1rem] bg-amber-400/30 animate-ping motion-reduce:animate-none" />
              )}
              <span className="z-10 text-[2rem] sm:text-[2.25rem] leading-none">
                {!unlocked ? "🔒" : icon}
              </span>
            </Link>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <Link href={unlocked ? `/lessons/${lesson.id}` : "#"} className={clsx("block", !unlocked && "pointer-events-none")}>
              <h3
                className={clsx(
                  "font-display text-lg sm:text-xl font-extrabold leading-snug",
                  unlocked ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-600"
                )}
              >
                {lesson.title}
              </h3>
              <p className={clsx("text-sm mt-1", unlocked ? "text-gray-500 dark:text-slate-400" : "text-gray-300")}>
                {lesson.estimatedMinutes} min · {totalSteps} steps
              </p>
            </Link>

            {isCompleted && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-2 uppercase tracking-wide">
                Mastered
              </p>
            )}

            {isInProgress && (
              <div className="mt-3 w-full bg-amber-100 dark:bg-amber-950/40 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all"
                  style={{ width: `${stepPct}%` }}
                />
              </div>
            )}

            {unlocked && (
              <Link
                href={`/lessons/${lesson.id}`}
                className={clsx(
                  "inline-flex mt-3 px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wide transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  isCompleted && "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
                  isInProgress && "bg-amber-500 text-white hover:bg-amber-400",
                  !isCompleted && !isInProgress && "bg-indigo-600 text-white hover:bg-indigo-500"
                )}
              >
                {isCompleted ? "Review" : isInProgress ? `Continue · ${stepsDone}/${totalSteps}` : "Start step"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChapterLanding({
  title,
  description,
  index,
  variant = "mid",
}: {
  title: string
  description: string
  index: number
  variant?: "base" | "mid"
}) {
  return (
    <div
      className={clsx(
        "relative z-[1] w-full max-w-3xl mx-auto mb-16 lg:mb-20 mastery-stair-landing",
        variant === "base" ? "mt-8 lg:mt-10" : "mt-14 lg:mt-20"
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="hidden lg:block absolute inset-x-6 -bottom-2 h-3 rounded-md bg-[#3d5230] opacity-80" aria-hidden />
      <div
        className="relative rounded-2xl border border-[#769656]/40 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1625 0%, #243018 55%, #1a1625 100%)" }}
      >
        {checkerTread("absolute inset-0 opacity-[0.08]")}
        <div className="relative px-6 py-5 sm:px-8 sm:py-6 text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-300/80">
            {variant === "base" ? "Base camp" : `Landing · Chapter ${index + 1}`}
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-1.5">{title}</h2>
          <p className="text-sm text-white/60 mt-2 max-w-lg mx-auto leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}

function SectionLanding({ title }: { title: string }) {
  return (
    <div className="relative z-[1] w-full max-w-2xl mx-auto mb-10 lg:mb-14 text-center mastery-stair-landing">
      <h3 className="font-display text-lg sm:text-xl font-extrabold text-gray-800 dark:text-slate-200">
        {title}
      </h3>
    </div>
  )
}

export function MasteryStaircase({ course, completedLessonIds, inProgressMap, activeLessonId }: Props) {
  const flatLessons = getCourseLessons(course)
  const totalLessons = flatLessons.length
  const allComplete = totalLessons > 0 && completedLessonIds.length >= totalLessons
  let globalStep = 0

  return (
    <div className="relative max-w-5xl mx-auto min-w-0 overflow-x-hidden">
      <div className="relative flex flex-col">
        {course.chapters.map((chapter, chapterIdx) => (
          <div key={chapter.id} className="flex flex-col">
            {chapterIdx > 0 && (
              <SpineConnector
                from={alignForStep(globalStep)}
                to="center"
                variant="chapter"
              />
            )}

            <ChapterLanding
              title={chapter.title}
              description={chapter.description}
              index={chapterIdx}
              variant={chapterIdx === 0 ? "base" : "mid"}
            />

            {getChapterLessons(chapter).map((lesson, lessonIdx) => {
              const sectionTitle = chapter.sections?.find((s) => s.lessons[0]?.id === lesson.id)?.title
              globalStep++
              const stepNumber = globalStep
              const align = alignForStep(stepNumber)
              const fromAlign: SpineAlign = lessonIdx === 0 ? "center" : alignForStep(stepNumber - 1)

              return (
                <Fragment key={lesson.id}>
                  {sectionTitle && (
                    <SectionLanding title={sectionTitle} />
                  )}
                  <SpineConnector
                    from={fromAlign}
                    to={align}
                    variant={lessonIdx === 0 ? "first-lesson" : "step"}
                  />
                  <div
                    className={clsx(
                      "relative z-[1] w-full px-2 sm:px-6 mb-8 lg:mb-12 lg:[transform:translateY(calc(var(--step)*-3px))]",
                      lessonIdx === 0 && !sectionTitle && "mt-6 lg:mt-10",
                      lessonIdx === 0 && sectionTitle && "mt-2 lg:mt-4",
                      align === "left" ? "lg:pr-[18%]" : "lg:pl-[18%]"
                    )}
                    style={{ ["--step" as string]: stepNumber }}
                  >
                    <LessonNode
                      lesson={lesson}
                      stepNumber={stepNumber}
                      isCompleted={completedLessonIds.includes(lesson.id)}
                      isInProgress={inProgressMap.has(lesson.id)}
                      isActive={lesson.id === activeLessonId}
                      unlocked={isLessonUnlocked(course, lesson.id, completedLessonIds)}
                      stepsDone={inProgressMap.get(lesson.id)?.length ?? 0}
                      totalSteps={lesson.steps.length}
                      align={align}
                    />
                  </div>
                </Fragment>
              )
            })}
          </div>
        ))}

        {totalLessons > 0 && (
          <SpineConnector from={alignForStep(globalStep)} to="center" variant="chapter" />
        )}

        {/* Summit */}
        <div
          className={clsx(
            "relative z-[1] flex flex-col items-center mt-6 mb-8 lg:mt-8 lg:mb-12 mastery-stair-summit",
            allComplete ? "opacity-100" : "opacity-75"
          )}
        >
          <div className="hidden lg:block w-16 h-10 mb-2 rounded-full bg-gradient-to-b from-indigo-400/40 to-amber-400/50" aria-hidden />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-600/80 dark:text-amber-400/80 mb-3">
            The summit
          </p>
          <div
            className={clsx(
              "w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] rounded-[1.75rem] flex items-center justify-center text-5xl transition-all",
              allComplete
                ? "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-xl shadow-amber-400/40 ring-[3px] ring-amber-200/80"
                : "bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600"
            )}
          >
            🏆
          </div>
          <p
            className={clsx(
              "font-display text-lg font-extrabold mt-3",
              allComplete ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-slate-400"
            )}
          >
            {allComplete ? "Course mastered" : "Mastery awaits"}
          </p>
          {!allComplete && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 text-center max-w-xs">
              Complete every step to claim the crown
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
