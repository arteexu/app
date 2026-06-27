import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { FreeAnalysis } from "@/components/analysis/FreeAnalysis"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Free Analysis — Engine Board | ChessMind",
}

export default async function AnalysisPage() {
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
      nav={<QuestNav active="analysis" avatarInitial={name[0]?.toUpperCase() ?? "?"} avatarIcon={resolveProfileIcon(profile?.avatar_icon)} />}
      showFooter={false}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <FreeAnalysis />
      </div>
    </AppPageShell>
  )
}
