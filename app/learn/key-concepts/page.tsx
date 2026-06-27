import { redirect } from "next/navigation"

// Key Concepts live at /key-concepts; /learn/key-concepts is the canonical
// "under Learn" path and redirects there so existing links never 404.
export default function LearnKeyConceptsPage() {
  redirect("/key-concepts")
}
