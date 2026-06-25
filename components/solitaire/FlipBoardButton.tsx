"use client"
// components/solitaire/FlipBoardButton.tsx
// Small, accessible control to flip the board orientation. Shared by the setup
// preview and the play screen.
import { clsx } from "clsx"

export function FlipBoardButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Flip board orientation"
      title="Flip board"
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition",
        "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300",
        "hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400",
        "focus:outline-none focus:ring-2 focus:ring-indigo-400",
        className
      )}
    >
      <span aria-hidden="true">⇅</span> Flip board
    </button>
  )
}
