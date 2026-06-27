import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { PlayVsBot } from "@/components/play/PlayVsBot"
import { PLAY_BASELINE_ELO } from "@/lib/play/types"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Play vs Bot | ChessMind",
}

export default async function PlayBotPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: ratingRow }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_icon").eq("id", user.id).single(),
    supabase.from("play_ratings").select("elo").eq("user_id", user.id).maybeSingle(),
  ])

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "You"
  const rating = ratingRow?.elo ?? PLAY_BASELINE_ELO

  return (
    <AppPageShell
      nav={
        <QuestNav active="play" avatarInitial={name[0]?.toUpperCase() ?? "?"} avatarIcon={resolveProfileIcon(profile?.avatar_icon)} back={{ href: "/play", label: "Play" }} />
      }
      showFooter={false}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <PlayVsBot playerName={name} playerRating={rating} />
      </div>
    </AppPageShell>
  )
}
