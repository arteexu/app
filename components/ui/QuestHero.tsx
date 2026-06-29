// components/ui/QuestHero.tsx — the gradient welcome card with level + XP + CTA
import Link from "next/link"
import type { LevelInfo } from "@/lib/gamification"
import { XpBar } from "./XpBar"
import { XpProgressButton } from "./XpProgressButton"

interface Props {
  name: string
  xp: number
  info: LevelInfo
  ctaHref: string | null
  ctaLabel: string
  courseComplete?: boolean
}

export function QuestHero({ name, xp, info, ctaHref, ctaLabel, courseComplete }: Props) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 md:p-8 text-white shadow-xl shadow-indigo-600/25
                    bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500
                    bitcoin:from-[#EA580C] bitcoin:via-[#F7931A] bitcoin:to-[#FFD600] bitcoin:border bitcoin:border-white/10 bitcoin:shadow-[0_0_50px_-10px_rgba(247,147,26,0.4)]">
      {/* decorative oversized glyph */}
      <span className="pointer-events-none select-none absolute -right-6 -top-8 text-[180px] leading-none opacity-10">♛</span>

      <p className="text-sm font-bold uppercase tracking-widest text-white/80 bitcoin:font-mono bitcoin:font-medium">
        Level {info.level} · {info.title}
      </p>
      <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mt-1.5 bitcoin:font-bold">
        Welcome back, {name}!
      </h1>
      <p className="text-white/90 text-base md:text-lg font-medium mt-1">
        {courseComplete
          ? "You've conquered the course — keep your skills sharp."
          : info.isMax
            ? "You've reached the top rank. Keep the streak alive!"
            : <>You&apos;re <b>{info.xpToNext} XP</b> from {info.nextTitle}. Keep the streak alive.</>}
      </p>

      <div className="mt-5 max-w-md">
        <XpBar info={info} tone="light" />
      </div>

      <div className="mt-3 flex flex-col items-start gap-3 sm:gap-4">
        <XpProgressButton xp={xp} level={info} variant="light" />

        {ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-display font-extrabold text-sm sm:text-base md:text-lg
                       px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl shadow-lg shadow-black/20 hover:scale-[1.03] active:scale-95 transition-transform max-w-full text-left break-words
                       bitcoin:bg-[#030304] bitcoin:text-white bitcoin:rounded-full bitcoin:border bitcoin:border-white/10 bitcoin:font-bold"
          >
            <span className="shrink-0" aria-hidden>▶</span>
            <span>{ctaLabel}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
