"use client"
// components/play/PlayGameReviewClient.tsx
// Client wrapper — loads saved game from localStorage by id.

import { useEffect, useState } from "react"
import Link from "next/link"
import { getSavedPlayGame, type SavedPlayGame } from "@/lib/play/saved-play-games"
import { PlayGameReview } from "./PlayGameReview"

export function PlayGameReviewClient({ id }: { id: string }) {
  const [game, setGame] = useState<SavedPlayGame | null | undefined>(undefined)

  useEffect(() => {
    setGame(getSavedPlayGame(id))
  }, [id])

  if (game === undefined) {
    return (
      <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
    )
  }

  if (game === null) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 dark:border-slate-700 p-10 text-center">
        <p className="font-display font-extrabold text-gray-900 dark:text-slate-100">
          Game not found
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          It may have been deleted or saved on another device.
        </p>
        <Link
          href="/play/saved"
          className="inline-block mt-4 font-display font-bold text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Back to saved games
        </Link>
      </div>
    )
  }

  return <PlayGameReview game={game} />
}
