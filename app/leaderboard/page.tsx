import { redirect } from "next/navigation"

// The competitive leaderboard now lives under the consolidated "Play Chess" area
// at /play/leaderboard. This redirect keeps existing /leaderboard links working.
export default function LeaderboardRedirect() {
  redirect("/play/leaderboard")
}
