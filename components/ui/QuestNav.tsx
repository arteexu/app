// components/ui/QuestNav.tsx — shared top navigation bar (Quest styling)
import Link from "next/link"
import { clsx } from "clsx"

interface Props {
  active?:
    | "dashboard"
    | "courses"
    | "learn"
    | "solitaire"
    | "play"
    | "analysis"
    | "profile"
    | "key-concepts"
    | "tactical-patterns"
    | "leaderboard"
  avatarInitial?: string
  /** Chosen chess-themed avatar glyph; falls back to the initial when absent. */
  avatarIcon?: string | null
  /** optional left "back" link, e.g. on settings pages */
  back?: { href: string; label: string }
}

export function QuestNav({ active, avatarInitial = "?", avatarIcon, back }: Props) {
  // "Learn" groups Key Concepts + Tactical Patterns, so highlight it on those views too.
  const learnActive = active === "learn" || active === "key-concepts" || active === "tactical-patterns"
  // "Play Chess" now encompasses the leaderboard/multiplayer views, so highlight it there too.
  const playActive = active === "play" || active === "leaderboard"
  return (
    <nav className="flex-shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-gray-100 dark:border-slate-800 min-w-0 overflow-x-hidden bitcoin:bg-black/40 bitcoin:backdrop-blur-lg bitcoin:border-white/10">
      {back && (
        <Link
          href={back.href}
          aria-label={`Back to ${back.label}`}
          className="shrink-0 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition bitcoin:font-mono bitcoin:text-[#94A3B8] bitcoin:hover:text-white"
        >
          <span className="hidden sm:inline">← {back.label}</span>
          <span className="sm:hidden" aria-hidden>←</span>
        </Link>
      )}

      <Link href="/dashboard" className="flex items-center gap-2 group shrink-0 min-w-0">
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center text-lg sm:text-xl shadow-md shadow-indigo-500/30 bitcoin:from-[#EA580C] bitcoin:to-[#F7931A] bitcoin:shadow-[0_0_20px_-5px_rgba(247,147,26,0.6)]">♞</span>
        <span className="font-display text-lg sm:text-xl font-extrabold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 transition hidden min-[400px]:inline truncate bitcoin:text-white bitcoin:group-hover:text-[#F7931A]">
          ChessMind
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLink href="/dashboard" label="Home" longLabel="Dashboard" active={active === "dashboard"} />
        <NavLink href="/courses" label="Courses" active={active === "courses"} />
        <NavLink href="/learn" label="Learn" active={learnActive} />
        <NavLink href="/solitaire" label="Solitaire" longLabel="Solitaire Chess" active={active === "solitaire"} />
        <NavLink href="/play" label="Play" longLabel="Play Chess" active={playActive} />
        <NavLink href="/analysis" label="Analysis" longLabel="Free Analysis" active={active === "analysis"} />
        <NavLink
          href="/settings/profile"
          label="Profile"
          active={active === "profile"}
          className="hidden md:inline-flex"
        />
        <Link
          href="/settings/profile"
          aria-label="Open your profile"
          className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white grid place-items-center font-bold text-xs sm:text-sm select-none ml-0.5 transition hover:ring-2 hover:ring-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 bitcoin:bg-[#0F1115] bitcoin:border bitcoin:border-white/10 bitcoin:hover:ring-0 bitcoin:hover:border-[#F7931A]/50 bitcoin:hover:shadow-[0_0_20px_-5px_rgba(247,147,26,0.6)] bitcoin:focus-visible:ring-[#F7931A] bitcoin:focus-visible:ring-offset-[#030304]"
        >
          <span aria-hidden className={avatarIcon ? "text-base sm:text-lg leading-none" : undefined}>
            {avatarIcon ?? avatarInitial}
          </span>
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
        "text-xs sm:text-sm font-bold px-2 sm:px-3 py-1.5 rounded-full transition whitespace-nowrap shrink-0 bitcoin:font-mono bitcoin:tracking-wide",
        active
          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 bitcoin:text-[#F7931A] bitcoin:bg-[#F7931A]/10"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 bitcoin:text-[#94A3B8] bitcoin:hover:text-white bitcoin:hover:bg-white/5",
        className,
      )}
    >
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{longLabel ?? label}</span>
    </Link>
  )
}
