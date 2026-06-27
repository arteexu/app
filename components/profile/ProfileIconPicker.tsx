"use client"
// components/profile/ProfileIconPicker.tsx
// Lets a user choose a chess-themed avatar glyph. The choice is persisted to
// profiles.avatar_icon (RLS lets users update only their own row) and the page
// is refreshed so the nav avatar reflects the new icon immediately.
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { clsx } from "clsx"
import { createClient } from "@/lib/supabase/client"
import { PROFILE_ICONS, resolveProfileIcon } from "@/lib/profile-icons"

interface Props {
  userId: string
  initialIcon: string | null
  /** Initial used as the fallback avatar when no icon is chosen. */
  fallbackInitial: string
}

export function ProfileIconPicker({ userId, initialIcon, fallbackInitial }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(resolveProfileIcon(initialIcon))
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedTick, setSavedTick] = useState(false)

  async function persist(next: string | null) {
    const prev = selected
    setSelected(next)
    setSaving(true)
    setError(null)
    setSavedTick(false)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_icon: next })
      .eq("id", userId)

    setSaving(false)

    if (updateError) {
      setSelected(prev)
      setError("Couldn't save your icon. Please try again.")
      return
    }

    setSavedTick(true)
    // Refresh server components (the nav avatar) to reflect the new icon.
    startTransition(() => router.refresh())
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Profile icon</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Pick a chess-themed avatar. It shows in the top-right of the navigation bar.
          </p>
        </div>
        <div
          aria-hidden
          className="shrink-0 w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-700 text-white grid place-items-center font-bold select-none"
        >
          <span className={selected ? "text-2xl leading-none" : "text-base"}>
            {selected ?? fallbackInitial}
          </span>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Choose a profile icon"
        className="mt-5 grid grid-cols-6 min-[420px]:grid-cols-8 sm:grid-cols-9 gap-2"
      >
        {PROFILE_ICONS.map((icon) => {
          const active = selected === icon.glyph
          return (
            <button
              key={icon.glyph}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={icon.label}
              disabled={saving}
              onClick={() => persist(icon.glyph)}
              className={clsx(
                "aspect-square rounded-xl grid place-items-center text-2xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 disabled:opacity-50",
                active
                  ? "bg-indigo-50 dark:bg-indigo-900/40 ring-2 ring-indigo-500"
                  : "bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 ring-1 ring-transparent",
              )}
            >
              <span aria-hidden>{icon.glyph}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 min-h-5">
        <button
          type="button"
          onClick={() => persist(null)}
          disabled={saving || selected === null}
          className="text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:hover:text-gray-500 transition"
        >
          Use my initial instead
        </button>
        {saving && <span className="text-xs text-gray-400 dark:text-slate-500">Saving…</span>}
        {!saving && savedTick && !pending && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Saved ✓</span>
        )}
        {error && <span className="text-xs font-semibold text-red-500">{error}</span>}
      </div>
    </div>
  )
}
