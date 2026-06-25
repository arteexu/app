import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QuestNav } from "@/components/ui/QuestNav"
import { KeyConceptsBrowser } from "@/components/key-concepts/KeyConceptsBrowser"

export default async function KeyConceptsPage() {
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
    <div className="min-h-screen flex flex-col">
      <QuestNav
        back={{ href: "/dashboard", label: "Quest" }}
        avatarInitial={name[0]?.toUpperCase() ?? "?"}
        active="key-concepts"
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <header className="mb-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
            Attacking principles
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-slate-100 mt-2">
            Key concepts
          </h1>
          <p className="text-base text-gray-600 dark:text-slate-400 mt-3 max-w-2xl leading-relaxed">
            Unlock ideas as you solve lesson puzzles. Each concept is a reusable attacking principle you can apply in your own games.
          </p>
        </header>

        <KeyConceptsBrowser />
      </main>
    </div>
  )
}
