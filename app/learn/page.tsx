import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Learn — Key Concepts & Tactical Patterns | ChessMind",
  description:
    "Your learning library — review the strategic Key Concepts and micro-level Tactical Patterns you unlock as you solve lesson puzzles.",
}

const SECTIONS = [
  {
    href: "/learn/key-concepts",
    icon: "💡",
    eyebrow: "Strategic ideas",
    title: "Key Concepts",
    body: "Reusable attacking principles — initiative, fast development, and bringing every piece into the attack.",
    accent:
      "border-indigo-200/70 dark:border-indigo-800/60 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-indigo-500/10",
    iconWrap: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400",
    arrow: "text-indigo-500 dark:text-indigo-400",
  },
  {
    href: "/learn/tactical-patterns",
    icon: "⚡",
    eyebrow: "Micro-level motifs",
    title: "Tactical Patterns",
    body: "Concrete shapes — forks, pins, clearance, and back-rank mates — that show up in combinations.",
    accent:
      "border-amber-200/70 dark:border-amber-800/60 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-amber-500/10",
    iconWrap: "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400",
    arrow: "text-amber-500 dark:text-amber-400",
  },
] as const

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
          active="learn"
          back={{ href: "/dashboard", label: "Dashboard" }}
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <header className="mb-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
            Your learning library
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-2">
            Learn
          </h1>
          <p className="text-base text-gray-600 dark:text-slate-400 mt-3 max-w-2xl leading-relaxed">
            Everything you unlock as you solve lesson puzzles lives here. Review the big strategic
            ideas and the concrete tactical shapes that win games.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group rounded-2xl border-2 bg-white dark:bg-slate-800 p-6 flex flex-col gap-4 hover:shadow-md transition-all ${s.accent}`}
            >
              <span
                className={`shrink-0 w-12 h-12 rounded-xl grid place-items-center text-2xl ${s.iconWrap}`}
                aria-hidden
              >
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  {s.eyebrow}
                </p>
                <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100 mt-1">
                  {s.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {s.body}
                </p>
              </div>
              <span
                className={`mt-auto text-sm font-bold inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity ${s.arrow}`}
              >
                Open
                <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </AppPageShell>
  )
}
