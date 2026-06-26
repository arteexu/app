import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { XpBar } from "@/components/ui/XpBar"
import { XpProgressButton } from "@/components/ui/XpProgressButton"
import { WeeklyBarChart } from "@/components/ui/WeeklyBarChart"
import { TrophyStrip } from "@/components/ui/TrophyStrip"
import { SiteActivitySummary } from "@/components/statistics/SiteActivitySummary"
import { SolitaireStatsPanel } from "@/components/statistics/SolitaireStatsPanel"
import { CheckmateBadgesPanel } from "@/components/checkmate-badges/CheckmateBadgesPanel"
import { fetchUserStats, WEEKLY_GOAL_HRS } from "@/lib/user-stats"

export default async function StatisticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const stats = await fetchUserStats(user.id)
  const earnedTrophies = stats.trophies.filter(t => t.earned).length

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">Statistics</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 max-w-xl">
          Streaks, goals, trophies, and practice time — everything you&apos;ve built so far.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-indigo-600/20 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500">
        <span className="pointer-events-none select-none absolute -right-4 -top-6 text-[130px] leading-none opacity-10">
          ♛
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-white/80">Rank</p>
        <p className="font-display text-3xl font-extrabold mt-1">
          Level {stats.level.level} · {stats.level.title}
        </p>
        <p className="text-white/85 text-sm font-medium mt-0.5">{stats.xp.toLocaleString()} XP earned</p>
        <div className="mt-4 max-w-md">
          <XpBar info={stats.level} tone="light" />
        </div>
        <XpProgressButton xp={stats.xp} level={stats.level} variant="light" className="mt-3" />
      </div>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard emoji="🔥" value={stats.currentStreak} label="Day streak" />
        <MetricCard emoji="🏆" value={stats.longestStreak} label="Best streak" />
        <MetricCard
          emoji="📚"
          value={`${stats.lessonsCompleted}/${stats.totalLessons}`}
          label="Lessons done"
        />
        <MetricCard
          emoji="🎯"
          value={stats.masteryRate !== null ? `${stats.masteryRate}%` : "—"}
          label="First-attempt"
        />
      </div>

      <WeeklyBarChart days={stats.days} totalHours={stats.totalHours} goal={WEEKLY_GOAL_HRS} />

      <section aria-labelledby="course-progress-heading" className="flex flex-col gap-3">
        <h3
          id="course-progress-heading"
          className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Course progress
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {stats.courseProgress.map(c => (
            <div
              key={c.courseId}
              className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{c.title}</p>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                  {c.progress}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-[width] duration-700 motion-reduce:transition-none"
                  style={{ width: `${c.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="site-time-heading" className="flex flex-col gap-3">
        <h3
          id="site-time-heading"
          className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide"
        >
          Time on site
        </h3>
        <SiteActivitySummary />
      </section>

      <section
        aria-labelledby="trophies-heading"
        className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3
            id="trophies-heading"
            className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100"
          >
            Trophies
          </h3>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {earnedTrophies}/{stats.trophies.length} earned
          </span>
        </div>
        <TrophyStrip trophies={stats.trophies} />
      </section>

      <section aria-labelledby="checkmate-badges-heading" className="flex flex-col gap-3">
        <h3
          id="checkmate-badges-heading"
          className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100"
        >
          Checkmate badges
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 -mt-1">
          Earned by checkmating in the King + Queen and King + Rook vs lone King endgame drills. Quickest tracks fewest moves to mate.
        </p>
        <CheckmateBadgesPanel />
      </section>

      <section aria-labelledby="solitaire-heading" className="flex flex-col gap-3">
        <h3
          id="solitaire-heading"
          className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100"
        >
          Solitaire bests
        </h3>
        <SolitaireStatsPanel />
      </section>
    </div>
  )
}

function MetricCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 flex flex-col items-center gap-1 text-center">
      <span className="text-2xl">{emoji}</span>
      <span className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 tabular-nums">
        {value}
      </span>
      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{label}</span>
    </div>
  )
}
