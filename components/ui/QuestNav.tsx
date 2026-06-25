// components/ui/QuestNav.tsx — shared top navigation bar (Quest styling)
import Link from "next/link"
import { clsx } from "clsx"

interface Props {
  active?: "dashboard" | "solitaire" | "profile"
  avatarInitial?: string
  /** optional left "back" link, e.g. on settings pages */
  back?: { href: string; label: string }
}

export function QuestNav({ active, avatarInitial = "?", back }: Props) {
  return (
    <nav className="flex-shrink-0 flex items-center gap-4 px-6 py-3.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-gray-100 dark:border-slate-800">
      {back && (
        <Link href={back.href} className="text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">
          ← {back.label}
        </Link>
      )}

      <Link href="/dashboard" className="flex items-center gap-2.5 group">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-xl shadow-md shadow-indigo-500/30">♞</span>
        <span className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 transition">ChessMind</span>
      </Link>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-4">
        <NavLink href="/dashboard" label="Quest" active={active === "dashboard"} />
        <NavLink href="/solitaire" label="Solitaire Chess" active={active === "solitaire"} />
        <NavLink href="/settings/profile" label="Profile" active={active === "profile"} />
        <Link href="/settings/profile" className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white grid place-items-center font-bold text-sm select-none">
          {avatarInitial}
        </Link>
      </div>
    </nav>
  )
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "text-sm font-bold px-3 py-1.5 rounded-full transition",
        active
          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100"
      )}
    >
      {label}
    </Link>
  )
}
