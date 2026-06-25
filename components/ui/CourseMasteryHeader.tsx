import Link from "next/link"
import type { Course, Lesson } from "@/lib/types"
import { clsx } from "clsx"

interface Props {
  course: Course
  progress: number
  completedCount: number
  totalLessons: number
  nextLesson: Lesson | null
  totalMinutes: number
}

export function CourseMasteryHeader({
  course,
  progress,
  completedCount,
  totalLessons,
  nextLesson,
  totalMinutes,
}: Props) {
  const clamped = Math.min(100, Math.max(0, progress))
  const ringRadius = 42
  const circumference = 2 * Math.PI * ringRadius
  const dashOffset = circumference - (clamped / 100) * circumference
  const titleParts = course.title.split(": ")
  const titlePrefix = titleParts.length > 1 ? `${titleParts[0]}:` : "Course"
  const titleMain = titleParts.length > 1 ? titleParts.slice(1).join(": ") : course.title

  return (
    <header className="relative overflow-hidden border-b border-white/10">
      {/* Board atmosphere */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(90deg, #eeeed2 50%, transparent 50%),
            linear-gradient(#769656 50%, #eeeed2 50%)
          `,
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#14101f] via-[#1a1625] to-[#0f172a]" aria-hidden />
      <div className="absolute -right-16 top-8 text-[220px] leading-none text-white/[0.04] select-none pointer-events-none" aria-hidden>
        ♚
      </div>
      <div className="absolute -left-10 bottom-0 text-[140px] leading-none text-red-500/[0.06] select-none pointer-events-none" aria-hidden>
        ♕
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300/90">
              <span className="w-6 h-px bg-amber-400/60" aria-hidden />
              Path to checkmate
              <span className="w-6 h-px bg-amber-400/60" aria-hidden />
            </p>

            <h1 className="mt-4 font-display text-[2.35rem] sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[0.95] tracking-tight text-white">
              <span className="block text-white/55 text-2xl sm:text-3xl lg:text-[2rem] font-bold mb-1">
                {titlePrefix}
              </span>
              {titleMain.split(" ").length > 2 ? (
                <>
                  {titleMain.split(" ").slice(0, -1).join(" ")}{" "}
                  <span className="relative inline-block">
                    {titleMain.split(" ").slice(-1)[0]}
                    <span
                      className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-red-500 via-red-400 to-amber-400"
                      aria-hidden
                    />
                  </span>
                </>
              ) : (
                <span className="relative inline-block">
                  {titleMain}
                  <span
                    className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-red-500 via-red-400 to-amber-400"
                    aria-hidden
                  />
                </span>
              )}
            </h1>

            <p className="mt-5 text-base sm:text-lg text-white/70 leading-relaxed max-w-xl">
              {course.description}
            </p>

            {nextLesson && (
              <Link
                href={`/lessons/${nextLesson.id}`}
                className="inline-flex items-center gap-2.5 mt-7 px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl bg-white text-[#1a1625] font-display font-extrabold text-sm sm:text-base shadow-xl shadow-black/30 hover:scale-[1.02] active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1625] max-w-full text-left"
              >
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-sm shrink-0">
                  ▶
                </span>
                <span className="min-w-0 break-words">
                  {completedCount === 0 ? "Begin the ascent" : `Continue: ${nextLesson.title}`}
                </span>
              </Link>
            )}
          </div>

          {/* Progress panel */}
          <div className="flex-shrink-0 w-full lg:w-auto">
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-sm px-6 py-5 sm:px-7 sm:py-6 flex items-center gap-6 sm:gap-8">
              <div className="relative w-[104px] h-[104px] flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r={ringRadius}
                    fill="none"
                    stroke="url(#masteryRing)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="masteryRing" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-display text-2xl font-extrabold text-white">{clamped}%</span>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/45">
                  Your climb
                </p>
                <p className="font-display text-xl font-extrabold text-white mt-1">
                  {completedCount} of {totalLessons} steps
                </p>
                <p className="text-sm text-white/55 mt-1">
                  ~{totalMinutes} min total · {totalLessons} lessons
                </p>
                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-indigo-500 transition-all duration-700"
                    )}
                    style={{ width: `${clamped}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
