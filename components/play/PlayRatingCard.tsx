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
    <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30 p-6 flex items-center justify-between gap-4 bitcoin:border-white/10 bitcoin:bg-none bitcoin:bg-[#0F1115] bitcoin:shadow-[0_0_50px_-10px_rgba(247,147,26,0.1)]">
      <div aria-hidden className="hidden bitcoin:block pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#F7931A] opacity-10 blur-[80px]" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bitcoin:font-mono bitcoin:font-medium bitcoin:text-[#F7931A]">
          Your Play rating
        </p>
        <p className="font-display text-4xl font-extrabold tabular-nums text-gray-900 dark:text-slate-100 text-gradient-bitcoin">
          {rating.elo}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 bitcoin:text-[#94A3B8]">
          Peak {rating.peakElo} · separate from your Solitaire rank
        </p>
      </div>
      <div className="relative text-right shrink-0">
        <p className="text-sm font-bold text-gray-700 dark:text-slate-300 tabular-nums bitcoin:font-mono bitcoin:font-medium bitcoin:text-white">
          {rating.gamesPlayed} games
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 tabular-nums mt-0.5 bitcoin:font-mono bitcoin:text-[#94A3B8]">
          <span className="text-emerald-600 dark:text-emerald-400 bitcoin:text-[#FFD600]">{rating.wins}W</span>{" "}
          <span className="text-gray-400 dark:text-slate-500 bitcoin:text-[#94A3B8]">{rating.draws}D</span>{" "}
          <span className="text-rose-600 dark:text-rose-400 bitcoin:text-[#EA580C]">{rating.losses}L</span>
        </p>
      </div>
    </div>
  )
}
