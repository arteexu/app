// components/solitaire/AnnotatedGameBadge.tsx
// Marks solitaire games that include authored move-by-move commentary.

import { clsx } from "clsx"

interface Props {
  className?: string
}

export function AnnotatedGameBadge({ className }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 shrink-0 text-[10px] font-bold uppercase tracking-wide",
        "text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30",
        "border border-emerald-200/80 dark:border-emerald-700/60 px-2 py-0.5 rounded-full",
        className
      )}
      title="Includes grandmaster commentary on key moves"
    >
      <span aria-hidden className="text-[9px] leading-none opacity-80">
        ✎
      </span>
      Annotated
    </span>
  )
}
