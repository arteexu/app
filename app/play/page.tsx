import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { PlayRatingCard } from "@/components/play/PlayRatingCard"
import { PLAY_BASELINE_ELO, type PlayRating } from "@/lib/play/types"
import { resolveProfileIcon } from "@/lib/profile-icons"

export const metadata = {
  title: "Play Chess — vs Bot or Live | ChessMind",
}

export default async function PlayHubPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const [{ data: profile }, { data: ratingRow }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_icon").eq("id", user.id).single(),
    supabase
      .from("play_ratings")
      .select("elo, peak_elo, games_played, wins, losses, draws")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const initialRating: PlayRating = {
    elo: ratingRow?.elo ?? PLAY_BASELINE_ELO,
    peakElo: ratingRow?.peak_elo ?? PLAY_BASELINE_ELO,
    gamesPlayed: ratingRow?.games_played ?? 0,
    wins: ratingRow?.wins ?? 0,
    losses: ratingRow?.losses ?? 0,
    draws: ratingRow?.draws ?? 0,
  }

  return (
    <AppPageShell nav={<QuestNav active="play" avatarInitial={name[0]?.toUpperCase() ?? "?"} avatarIcon={resolveProfileIcon(profile?.avatar_icon)} />}>
      <main className="flex-1 w-full max-w-4xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            Play Chess
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Full games with a clock — against the engine or a live opponent. Earns a separate Play
            rating.
          </p>
        </div>

        <PlayRatingCard initial={initialRating} />

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/play/bot"
            className="group relative overflow-hidden rounded-3xl border border-indigo-200/60 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-indigo-950/40 dark:to-sky-950/30 p-6 flex flex-col gap-3 hover:shadow-lg hover:shadow-indigo-500/10 transition-shadow"
          >
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white grid place-items-center text-3xl shadow-md shadow-indigo-500/30">
              🤖
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                Play vs Bot
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
                Choose your color, the engine&apos;s strength (≈800–2200), and a time control.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 font-display font-extrabold text-indigo-600 dark:text-indigo-400">
              Set up game →
            </span>
          </Link>

          <Link
            href="/play/live"
            className="group relative overflow-hidden rounded-3xl border border-rose-200/60 dark:border-rose-800/60 bg-gradient-to-br from-rose-50 to-fuchsia-50 dark:from-rose-950/40 dark:to-fuchsia-950/30 p-6 flex flex-col gap-3 hover:shadow-lg hover:shadow-rose-500/10 transition-shadow"
          >
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white grid place-items-center text-3xl shadow-md shadow-rose-500/30">
              ⚔️
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold text-gray-900 dark:text-slate-100">
                Play vs Human
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
                Get matched with a live opponent. Real-time board, synced clocks, head-to-head Elo.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 font-display font-extrabold text-rose-600 dark:text-rose-400">
              Find opponent →
            </span>
          </Link>
        </div>
      </main>
    </AppPageShell>
  )
}
