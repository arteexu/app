import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { TacticalPatternsBrowser } from "@/components/tactical-patterns/TacticalPatternsBrowser"

export const metadata = {
  title: "Tactical Patterns — Micro-level Motifs | ChessMind",
  description:
    "Unlock micro-level tactical motifs — forks, pins, mates, and combinations — as you solve lesson puzzles.",
}

export default async function TacticalPatternsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"

  return (
    <AppPageShell
      nav={
        <QuestNav
          back={{ href: "/dashboard", label: "Courses" }}
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          active="tactical-patterns"
        />
      }
    >
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <header className="mb-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-rose-600 dark:text-rose-400">
            Micro-level motifs
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-2">
            Tactical Patterns
          </h1>
          <MarkdownText
            className="text-base text-gray-600 dark:text-slate-400 mt-3 max-w-2xl leading-relaxed"
            strongClassName="font-semibold text-rose-800 dark:text-rose-300"
          >
            {`Tactical Patterns are **micro-level motifs** — concrete shapes like forks, pins, and back-rank mates that show up in combinations. You need tactics to play chess: without the ability to calculate and land decisive blows, positional plans and the bigger picture stay out of reach. These motifs are the **glue** that ties small details into how the whole game fits together.

Unlock each pattern as you solve lesson puzzles — the shapes strong players spot in an instant, separate from the broader attacking principles in Key Concepts.`}
          </MarkdownText>
        </header>

        <TacticalPatternsBrowser />
      </main>
    </AppPageShell>
  )
}
