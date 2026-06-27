import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { PlayGameReviewClient } from "@/components/play/PlayGameReviewClient"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Review Saved Game | ChessMind",
}

export default async function PlaySavedReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  if (!id) notFound()

  return (
    <AppPageShell
      nav={
        <QuestNav
          active="play"
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <main className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-7">
        <PlayGameReviewClient id={id} />
      </main>
    </AppPageShell>
  )
}
