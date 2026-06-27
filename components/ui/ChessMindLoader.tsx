// components/ui/ChessMindLoader.tsx — branded loading animation
// Reuses the ChessMind brand mark (the knight glyph in an indigo→violet tile,
// matching QuestNav) so loading states feel on-brand rather than generic.
import { clsx } from "clsx"

type LoaderSize = "sm" | "md" | "lg"

interface Props {
  /** sm: inline (buttons/rows), md: panel/section, lg: full-page hero */
  size?: LoaderSize
  /** Cover the viewport and center the loader (route/page-level loading). */
  fullScreen?: boolean
  /** Visible caption under the mark. Also used as the accessible label. */
  label?: string
  /** Hide the visible caption but keep it for screen readers. Default false. */
  hideLabel?: boolean
  className?: string
}

const SIZES: Record<
  LoaderSize,
  { tile: string; glyph: string; radius: string; pip: string; gap: string; label: string }
> = {
  sm: { tile: "w-8 h-8", glyph: "text-lg", radius: "rounded-lg", pip: "w-1 h-1", gap: "gap-1.5", label: "text-xs" },
  md: { tile: "w-14 h-14", glyph: "text-3xl", radius: "rounded-2xl", pip: "w-1.5 h-1.5", gap: "gap-2.5", label: "text-sm" },
  lg: { tile: "w-20 h-20", glyph: "text-5xl", radius: "rounded-3xl", pip: "w-2 h-2", gap: "gap-3", label: "text-base" },
}

export function ChessMindLoader({
  size = "md",
  fullScreen = false,
  label = "Loading…",
  hideLabel = false,
  className,
}: Props) {
  const s = SIZES[size]

  const loader = (
    <div
      role="status"
      aria-label={label}
      className={clsx("flex flex-col items-center", s.gap, className)}
    >
      {/* Brand mark — the ChessMind knight in its gradient tile */}
      <span
        aria-hidden
        className={clsx(
          "chessmind-tile grid place-items-center text-white select-none",
          "bg-gradient-to-br from-indigo-500 to-violet-600",
          s.tile,
          s.radius,
          s.glyph,
        )}
      >
        ♞
      </span>

      {/* Loading pips in brand colors, rippling in sequence */}
      <span aria-hidden className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={clsx("chessmind-pip rounded-full bg-indigo-400 dark:bg-indigo-300", s.pip)}
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>

      {label &&
        (hideLabel ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span
            className={clsx(
              "font-display font-bold text-gray-500 dark:text-slate-400",
              s.label,
            )}
          >
            {label}
          </span>
        ))}
    </div>
  )

  if (fullScreen) {
    return <div className="min-h-screen w-full grid place-items-center px-4">{loader}</div>
  }

  return loader
}
