import { redirect } from "next/navigation"

// Tactical Patterns live at /tactical-patterns; /learn/tactical-patterns is the
// canonical "under Learn" path and redirects there so existing links never 404.
export default function LearnTacticalPatternsPage() {
  redirect("/tactical-patterns")
}
