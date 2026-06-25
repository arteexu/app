import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { SolitaireApp } from "@/components/solitaire/SolitaireApp"

export const metadata = {
  title: "Solitaire Chess — Follow a Grandmaster's Game | ChessMind",
}

export default async function SolitairePage() {
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
    <AppPageShell nav={<QuestNav active="solitaire" avatarInitial={name[0]?.toUpperCase() ?? "?"} />}>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <SolitaireApp />
      </div>
    </AppPageShell>
  )
}
