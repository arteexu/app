"use client"
// components/lesson/SolveReward.tsx
// The celebratory takeover shown when a graded step is solved. Render it as a
// child of the LessonLayout right-panel (which is `relative`) — it overlays the
// panel with a gradient, confetti, stars, an XP count-up, and bonus chips.
import { Confetti, Stars, useCountUp } from "./RewardFx"

interface Props {
  run?: boolean
  xp?: number
  stars?: number          // 1–3
  title?: string
  subtitle?: string
  firstTry?: boolean
  speedBonus?: boolean
  comboLabel?: string     // e.g. "4× combo" — omit to hide
  isLastStep?: boolean
  onContinue: () => void
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/[0.18] border border-white/30 rounded-full px-3.5 py-1.5 text-[13px] font-bold">
      {icon} {label}
    </span>
  )
}

export function SolveReward({
  run = true, xp = 60, stars = 3, title = "Checkmate!", subtitle,
  firstTry = true, speedBonus = false, comboLabel, isLastStep, onContinue,
}: Props) {
  const xpShown = useCountUp(xp, run, 950)
  return (
    <div
      className="absolute inset-0 flex flex-col p-7 overflow-hidden text-white"
      style={{ background: "linear-gradient(160deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)", animation: run ? "rise .45s ease both" : "none" }}
    >
      <Confetti run={run} count={90} originY={0.16} />
      <span className="pointer-events-none select-none absolute -right-6 -bottom-8 text-[200px] leading-none opacity-10">♛</span>

      <div className="relative flex flex-col items-center gap-3.5">
        <Stars rating={stars} run={run} size={40} gold="#fde047" />
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold tracking-tight">{title}</div>
          {subtitle && <div className="text-[14.5px] text-white/85 mt-0.5">{subtitle}</div>}
        </div>
        <div className="text-center mt-1">
          <div className="font-display text-5xl font-extrabold leading-none" style={{ textShadow: "0 4px 20px rgba(0,0,0,.25)" }}>
            +{xpShown}<span className="text-2xl ml-1">XP</span>
          </div>
        </div>
        <div className="flex gap-2.5 flex-wrap justify-center mt-1">
          {speedBonus && <Chip icon="⚡" label="×2 Speed bonus" />}
          {firstTry && <Chip icon="🎯" label="First try" />}
          {comboLabel && <Chip icon="🔥" label={comboLabel} />}
        </div>
      </div>

      <button
        onClick={onContinue}
        className="mt-auto bg-white text-indigo-700 font-display font-extrabold text-[17px] py-3.5 rounded-2xl cursor-pointer shadow-[0_12px_28px_-10px_rgba(0,0,0,0.4)] hover:scale-[1.02] active:scale-95 transition-transform"
      >
        {isLastStep ? "Finish lesson →" : "Continue →"}
      </button>
    </div>
  )
}
