import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView"

export const metadata = {
  title: "Leaderboard — Competitive Solitaire | ChessMind",
}

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"

  return (
    <AppPageShell nav={<QuestNav active="leaderboard" avatarInitial={name[0]?.toUpperCase() ?? "?"} />}>
      <main className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-6">
        <LeaderboardView />
      </main>
    </AppPageShell>
  )
}
