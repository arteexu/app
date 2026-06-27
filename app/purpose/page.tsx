import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QuestNav } from "@/components/ui/QuestNav"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Our Purpose — ChessMind",
  description: "Why ChessMind teaches chess differently — by finding moves, calculating lines, and building attacking patterns.",
}

const SECTIONS = [
  {
    eyebrow: "The core idea",
    title: "Find the move — don't just watch it",
    body: "Most chess apps show you what happened after the fact. ChessMind puts you on the clock. You guess the grandmaster's move in Solitaire Chess, calculate through annotated master games, and pause at STOP moments where the position demands a decision. You learn by searching the board, not by passively replaying someone else's brilliance.",
  },
  {
    eyebrow: "How we teach",
    title: "Calculate lines, collect concepts, attack with purpose",
    body: "Isolated tactics don't transfer to real games. Our courses climb a structured staircase — from checkmate fundamentals to Attacking Chess — and Key Concepts unlock as you solve, so patterns like initiative, fast development, and bringing every piece into the attack stick across positions. When you pick the wrong move, we explain why it fails — the way a coach annotating over your shoulder would, not a red X and silence.",
  },
  {
    eyebrow: "The experience",
    title: "A coach at your side, not a tactics grinder",
    body: "Drag pieces on a real board with legal-move highlights, flip the view, and step into analyze mode when you need to think deeper. XP, streaks, and trophies celebrate steady practice — progress you earn for yourself, not a leaderboard designed to make you feel behind. ChessMind is built for learners who want to play sharper attacking chess, one calculated line at a time.",
  },
] as const

export default async function PurposePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_icon")
    .eq("id", user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"

  return (
    <AppPageShell
      nav={
        <QuestNav
          back={{ href: "/dashboard", label: "Dashboard" }}
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-8 py-10 lg:py-16">
        <header className="mb-12 sm:mb-16">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
            ChessMind
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-gray-900 dark:text-slate-100 mt-3 leading-tight">
            Our Purpose
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-slate-400 mt-4 leading-relaxed max-w-2xl">
            We built ChessMind because learning chess should feel like playing — with a patient coach beside you, not a wall of puzzles to grind.
          </p>
        </header>

        <div className="relative pl-6 sm:pl-8 border-l-2 border-indigo-200 dark:border-indigo-800/60 space-y-12 sm:space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.title} aria-labelledby={`purpose-${section.eyebrow.replace(/\s+/g, "-")}`}>
              <p
                id={`purpose-${section.eyebrow.replace(/\s+/g, "-")}`}
                className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400"
              >
                {section.eyebrow}
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-slate-100 mt-2 leading-snug">
                {section.title}
              </h2>
              <p className="text-base text-gray-600 dark:text-slate-400 mt-3 leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-14 sm:mt-16 pt-8 border-t border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-slate-400 flex-1">
            Ready to put it into practice?
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-display font-extrabold px-5 py-2.5 rounded-2xl shadow-md shadow-indigo-500/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            Back to Courses
          </Link>
        </div>
      </main>
    </AppPageShell>
  )
}
