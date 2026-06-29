import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getAnnotatedGame } from "@/lib/annotated/games"
import { AnnotatedGamePlayer } from "@/components/annotated/AnnotatedGamePlayer"

export default async function AnnotatedGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const game = getAnnotatedGame(id)
  if (!game) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-slate-900 flex flex-col">
      <nav className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-3 sm:px-6 h-[48px] sm:h-[52px] flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0 overflow-hidden">
        <Link
          href="/games"
          className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition flex-shrink-0 truncate"
        >
          ← Annotated games
        </Link>
        <span className="text-gray-300 dark:text-slate-600 shrink-0">/</span>
        <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 truncate min-w-0 flex-1">
          {game.title}
        </span>
        <div className="ml-auto hidden sm:flex items-center gap-4 flex-shrink-0">
          <Link href="/dashboard" className="font-display text-xl font-extrabold text-indigo-600 hover:text-indigo-500 transition">ChessMind</Link>
          <Link href="/dashboard" className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition">Dashboard</Link>
        </div>
        <Link
          href="/dashboard"
          className="sm:hidden ml-auto shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 grid place-items-center text-sm font-bold"
          aria-label="Back to dashboard"
        >
          ♞
        </Link>
      </nav>

      <AnnotatedGamePlayer game={game} />
    </div>
  )
}
