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
        <div className="flex flex-wrap items-start justify-between gap-3">
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
          <Link
            href="/review"
            className="shrink-0 inline-flex items-center gap-2 font-display font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            ⬆ Review a PGN
          </Link>
        </div>

        <PlaySavedGamesList />
      </main>
    </AppPageShell>
  )
}
