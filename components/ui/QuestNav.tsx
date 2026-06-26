// components/ui/QuestNav.tsx — shared top navigation bar (Quest styling)
import Link from "next/link"
import { clsx } from "clsx"

interface Props {
  active?:
    | "dashboard"
    | "solitaire"
    | "analysis"
    | "profile"
    | "key-concepts"
    | "tactical-patterns"
    | "leaderboard"
  avatarInitial?: string
  /** optional left "back" link, e.g. on settings pages */
  back?: { href: string; label: string }
}

export function QuestNav({ active, avatarInitial = "?", back }: Props) {
  return (
    <nav className="flex-shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-gray-100 dark:border-slate-800 min-w-0 overflow-x-hidden">
      {back && (
        <Link
          href={back.href}
          aria-label={`Back to ${back.label}`}
          className="shrink-0 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition"
        >
          <span className="hidden sm:inline">← {back.label}</span>
          <span className="sm:hidden" aria-hidden>←</span>
        </Link>
      )}

      <Link href="/dashboard" className="flex items-center gap-2 group shrink-0 min-w-0">
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-lg sm:text-xl shadow-md shadow-indigo-500/30">♞</span>
        <span className="font-display text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 transition hidden min-[400px]:inline truncate">
          ChessMind
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLink href="/dashboard" label="Courses" active={active === "dashboard"} />
        <NavLink href="/solitaire" label="Solitaire" longLabel="Solitaire Chess" active={active === "solitaire"} />
        <NavLink href="/leaderboard" label="Ranks" longLabel="Leaderboard" active={active === "leaderboard"} />
        <NavLink href="/analysis" label="Analysis" longLabel="Free Analysis" active={active === "analysis"} />
        <NavLink href="/key-concepts" label="Concepts" longLabel="Key Concepts" active={active === "key-concepts"} />
        <NavLink href="/tactical-patterns" label="Patterns" longLabel="Tactical Patterns" active={active === "tactical-patterns"} />
        <NavLink
          href="/settings/profile"
          label="Profile"
          active={active === "profile"}
          className="hidden md:inline-flex"
        />
        <Link
          href="/settings/profile"
          className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white grid place-items-center font-bold text-xs sm:text-sm select-none ml-0.5"
        >
          {avatarInitial}
        </Link>
      </div>
    </nav>
  )
}

function NavLink({
  href,
  label,
  longLabel,
  active,
  className,
}: {
  href: string
  label: string
  longLabel?: string
  active: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-full transition whitespace-nowrap shrink-0",
        active
          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100",
        className,
      )}
    >
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{longLabel ?? label}</span>
    </Link>
  )
}
