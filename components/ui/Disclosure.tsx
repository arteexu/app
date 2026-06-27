"use client"
// components/ui/Disclosure.tsx
// Minimal accessible reveal-on-demand wrapper: a labelled toggle button that
// shows/hides its content. Used to declutter the lesson side panel — concepts,
// patterns, and move explanations are revealed only when the learner asks.

import { useId, useState } from "react"
import { clsx } from "clsx"

interface Props {
  /** Button label when collapsed. */
  label: React.ReactNode
  /** Button label when expanded (defaults to `label`). */
  openLabel?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  buttonClassName?: string
  /** Called the first time the content is revealed (e.g. to fire confetti). */
  onFirstOpen?: () => void
}

export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
  className,
  buttonClassName,
  onFirstOpen,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [hasOpened, setHasOpened] = useState(defaultOpen)
  const id = useId()

  function toggle() {
    setOpen((o) => {
      const next = !o
      if (next && !hasOpened) {
        setHasOpened(true)
        onFirstOpen?.()
      }
      return next
    })
  }

  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={id}
        className={clsx(
          "self-start inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-2.5 py-1.5",
          "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/60",
          "focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors motion-reduce:transition-none",
          buttonClassName,
        )}
      >
        <span
          aria-hidden
          className={clsx("transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
        >
          ▸
        </span>
        {open ? openLabel ?? label : label}
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  )
}
