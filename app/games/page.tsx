import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAllAnnotatedGames } from "@/lib/annotated/games"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { resolveProfileIcon } from "@/lib/profile-icons"

const RESULT_LABEL: Record<string, string> = {
  "1-0": "White won",
  "0-1": "Black won",
  "1/2-1/2": "Draw",
  "*": "Unfinished",
}

export default async function GamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_icon")
    .eq("id", user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const games = getAllAnnotatedGames()

  return (
    <AppPageShell
      nav={
        <QuestNav
          back={{ href: "/dashboard", label: "Dashboard" }}
          avatarInitial={name[0]?.toUpperCase() ?? "?"}
          avatarIcon={resolveProfileIcon(profile?.avatar_icon)}
        />
      }
    >
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-10 lg:py-14">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-gray-900 dark:text-slate-100">
              Annotated Master Games
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-2">
              Step through world-class games one move at a time, with a grandmaster&apos;s
              notes and concept checks at the critical moments.
            </p>
          </div>
          <Link
            href="/review"
            className="shrink-0 inline-flex items-center gap-2 font-display font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
          >
            ⬆ Review your own game
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((game) => {
            const checks = game.conceptChecks?.length ?? 0
            const moves = Math.ceil(game.plies.length / 2)
            return (
              <Link
                key={game.id}
                href={`/games/${game.id}`}
                className="group rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-tight">
                      {game.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-3">
                      {game.description}
                    </p>
                  </div>
                  <span className="text-2xl flex-shrink-0">♟</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
                  <span>{moves} moves</span>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {RESULT_LABEL[game.headers.result] ?? game.headers.result}
                  </span>
                  {checks > 0 && (
                    <>
                      <span>·</span>
                      <span>{checks} concept {checks === 1 ? "check" : "checks"}</span>
                    </>
                  )}
                  {game.headers.eco && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{game.headers.eco}</span>
                    </>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </AppPageShell>
  )
}
