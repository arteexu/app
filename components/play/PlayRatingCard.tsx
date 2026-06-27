"use client"
// components/play/PlayRatingCard.tsx
// Shows the user's SEPARATE Play rating on the /play hub. On mount it first
// applies any pending rating deltas from previously-finished live games (the
// deferred "self-service" pattern), then reads the fresh rating to display.

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { readPlayRating } from "@/lib/play/ratings"
import { applyPendingPlayRatings } from "@/lib/play/live"
import type { PlayRating } from "@/lib/play/types"

export function PlayRatingCard({ initial }: { initial: PlayRating }) {
  const [rating, setRating] = useState<PlayRating>(initial)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await applyPendingPlayRatings()
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const fresh = await readPlayRating(supabase, user.id)
      if (!cancelled && !fresh.missing) {
        setRating({
          elo: fresh.elo,
          peakElo: fresh.peakElo,
          gamesPlayed: fresh.gamesPlayed,
          wins: fresh.wins,
          losses: fresh.losses,
          draws: fresh.draws,
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-3xl border border-indigo-200/70 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 p-6 flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Your Play rating
        </p>
        <p className="font-display text-4xl font-extrabold tabular-nums text-gray-900 dark:text-slate-100">
          {rating.elo}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Peak {rating.peakElo} · separate from your Solitaire rank
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-700 dark:text-slate-300 tabular-nums">
          {rating.gamesPlayed} games
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 tabular-nums mt-0.5">
          <span className="text-emerald-600 dark:text-emerald-400">{rating.wins}W</span>{" "}
          <span className="text-gray-400 dark:text-slate-500">{rating.draws}D</span>{" "}
          <span className="text-rose-600 dark:text-rose-400">{rating.losses}L</span>
        </p>
      </div>
    </div>
  )
}
