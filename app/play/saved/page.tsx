import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { PlaySavedGamesList } from "@/components/play/PlaySavedGamesList"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Saved Play Games | ChessMind",
}

export default async function PlaySavedPage() {
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
          active="play"
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <main className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-6">
        <div>
          <Link
            href="/play"
            className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Play hub
          </Link>
          <h1 className="font-display text-3xl font-extrabold text-gray-900 dark:text-slate-100 mt-2">
            Saved games
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Replay completed games and generate coach insights — stored on this device.
          </p>
        </div>

        <PlaySavedGamesList />
      </main>
    </AppPageShell>
  )
}
