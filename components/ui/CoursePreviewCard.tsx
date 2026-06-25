// components/ui/CoursePreviewCard.tsx — a single course overview card for the
// dashboard. A custom chess emblem (painted in the course accent) leads a short
// preview; the whole card links into the course, where the full chapters /
// quest / staircase live.
import Link from "next/link"
import { clsx } from "clsx"
import { CourseIcon } from "./course-icons"
import type { CoursePreview } from "@/lib/course-previews"

interface Props {
  preview: CoursePreview
  chapterCount: number
  lessonCount: number
  totalMinutes: number
  progress: number
  completedCount: number
}

export function CoursePreviewCard({
  preview,
  chapterCount,
  lessonCount,
  totalMinutes,
  progress,
  completedCount,
}: Props) {
  const started = completedCount > 0
  const complete = progress >= 100
  const ctaLabel = complete ? "Review course" : started ? "Continue course" : "Start course"
  const { accent } = preview

  return (
    <Link
      href={`/courses/${preview.id}`}
      className={clsx(
        "group relative flex flex-col p-5 sm:p-6 pl-6 sm:pl-7",
        "rounded-3xl border border-gray-200 dark:border-slate-700",
        "bg-white dark:bg-slate-800/70 shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
      )}
    >
      {/* Accent spine — encodes which course this is */}
      <span
        aria-hidden
        className="absolute left-0 top-6 bottom-6 w-1 rounded-full"
        style={{ backgroundColor: accent }}
      />

      {/* Header — emblem leads the eyebrow + title */}
      <div className="flex items-center gap-4">
        {/* Emblem (the signature) — the course's identity in its accent color */}
        <span
          aria-hidden
          className="shrink-0 grid place-items-center rounded-2xl w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 26%, transparent)`,
          }}
        >
          <CourseIcon
            name={preview.icon}
            className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
            style={{ color: accent }}
          />
        </span>

        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-[2px]" style={{ backgroundColor: accent }} />
            {preview.eyebrow}
          </span>

          <h3 className="font-display text-2xl lg:text-[1.75rem] font-extrabold text-gray-900 dark:text-slate-100 leading-tight mt-1">
            {preview.displayLabel}
          </h3>
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <p className="text-sm sm:text-[15px] text-gray-600 dark:text-slate-300 leading-relaxed mt-3.5 max-w-prose">
          {preview.tagline}
        </p>

        {/* Topic teasers — what the course holds, without the full lesson list */}
        <ul className="flex flex-wrap gap-1.5 mt-3.5" aria-label="Topics covered">
          {preview.topics.map((t) => (
            <li
              key={t}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-slate-300"
            >
              {t}
            </li>
          ))}
        </ul>

        {/* Metadata — chess-scoresheet mono */}
        <p className="font-mono text-[11px] text-gray-500 dark:text-slate-400 mt-4 tabular-nums">
          {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"} · {lessonCount}{" "}
          {lessonCount === 1 ? "lesson" : "lessons"} · ~{totalMinutes} min
        </p>

        {/* Progress (only if started) */}
        {started ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span style={{ color: accent }}>{progress}% complete</span>
              <span className="text-gray-400 dark:text-slate-500 font-mono">
                {completedCount}/{lessonCount}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-2.5 text-[11px] font-semibold text-gray-400 dark:text-slate-500">
            Not started yet
          </p>
        )}

        {/* CTA — the whole card is the link; this is the affordance */}
        <span className="mt-auto pt-4 inline-flex items-center gap-1.5 font-display font-extrabold text-sm" style={{ color: accent }}>
          {ctaLabel}
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  )
}
