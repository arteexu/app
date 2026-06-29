import { createClient } from "@/lib/supabase/server"
import { calculateStreak, todayString } from "@/lib/progress"

type StreakRow = {
  current_streak: number | null
  longest_streak: number | null
  last_activity_date: string | null
}

/**
 * Marks the user as active *today* and returns the up-to-date streak.
 *
 * Previously the streak was only written as a side effect of completing a
 * lesson, so any day the user was present on the site but hadn't finished a
 * lesson never counted. That made the displayed streak lag one day behind —
 * e.g. reading "3" after 4 consecutive active days. Recording the visit here
 * makes *today* count as soon as the user loads the dashboard / stats.
 *
 * Day boundaries use a calendar-day comparison inside `calculateStreak` (the
 * same function lesson completion uses), so a streak only ever resets on a real
 * 2+ day gap — a timezone/clock difference between this server path and the
 * browser-side lesson writer can no longer falsely reset it. As an extra guard,
 * a visit only ever holds or increases the streak; it can never lower a streak
 * that is still consecutive (the only allowed decrease is a genuine reset).
 * Writing is guarded so a day is only recorded once, keeping it idempotent.
 */
export async function recordVisit(
  userId: string,
  existing?: StreakRow | null,
): Promise<{ currentStreak: number; longestStreak: number }> {
  const supabase = await createClient()

  let row = existing ?? null
  if (!row) {
    const { data } = await supabase
      .from("user_streaks")
      .select("current_streak, longest_streak, last_activity_date")
      .eq("user_id", userId)
      .single()
    row = data ?? null
  }

  const today = todayString()
  const prevStreak = row?.current_streak ?? 0
  const prevLongest = row?.longest_streak ?? 0

  // Already counted today — nothing to write.
  if (row?.last_activity_date === today) {
    return { currentStreak: prevStreak, longestStreak: prevLongest }
  }

  const computed = calculateStreak(row?.last_activity_date ?? null, prevStreak)
  // Safety net: a visit must only continue (or hold) a streak. The single
  // legitimate decrease is a real missed-day reset, which calculateStreak signals
  // by returning exactly 1; in every other case we never write below prevStreak.
  const isGenuineReset = computed === 1
  const currentStreak = isGenuineReset ? computed : Math.max(computed, prevStreak)
  const longestStreak = Math.max(currentStreak, prevLongest)

  await supabase.from("user_streaks").upsert(
    {
      user_id: userId,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
    },
    { onConflict: "user_id" },
  )

  return { currentStreak, longestStreak }
}
