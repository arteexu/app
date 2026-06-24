"use client"
// components/lesson/RewardFx.tsx
// Presentational reward primitives shared by the solving UI: a confetti burst,
// an animated star rating, and an XP count-up hook. No app dependencies.
import { useState, useEffect } from "react"

const CONFETTI_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#22c55e", "#ec4899", "#38bdf8"]

interface ConfettiProps { run: boolean; count?: number; originY?: number }

export function Confetti({ run, count = 80, originY = 0.18 }: ConfettiProps) {
  const [parts, setParts] = useState<any[]>([])
  useEffect(() => {
    if (!run) { setParts([]); return }
    const p = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: 50 + (Math.random() * 2 - 1) * 46,
      dx: (Math.random() * 2 - 1) * 220,
      dy: -120 - Math.random() * 200,
      rot: Math.random() * 720 - 360,
      delay: Math.random() * 0.12,
      dur: 1.0 + Math.random() * 0.9,
      size: 7 + Math.random() * 7,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: Math.random() > 0.5,
    }))
    setParts(p)
    const t = setTimeout(() => setParts([]), 2300)
    return () => clearTimeout(t)
  }, [run, count])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-40">
      {parts.map((p) => (
        <span key={p.id} style={{
          position: "absolute", left: `${p.left}%`, top: `${originY * 100}%`,
          width: p.size, height: p.size * (p.round ? 1 : 1.6),
          background: p.color, borderRadius: p.round ? "50%" : 2,
          animation: `confFall ${p.dur}s cubic-bezier(.2,.6,.4,1) ${p.delay}s both`,
          // @ts-ignore — CSS custom props
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`,
        }} />
      ))}
    </div>
  )
}

interface StarsProps { rating?: number; size?: number; run?: boolean; gold?: string }

export function Stars({ rating = 3, size = 38, run = true, gold = "#f59e0b" }: StarsProps) {
  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2].map((i) => {
        const on = i < rating
        return (
          <span key={i} style={{
            fontSize: size, lineHeight: 1, color: on ? gold : "#cbd5e1",
            filter: on ? "drop-shadow(0 4px 8px rgba(245,158,11,.45))" : "none",
            animation: run ? `starPop .5s cubic-bezier(.2,1.4,.4,1) ${0.15 + i * 0.13}s both` : "none",
            display: "inline-block",
          }}>★</span>
        )
      })}
    </div>
  )
}

export function useCountUp(target: number, run: boolean, ms = 900) {
  const [v, setV] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run) { setV(target); return }
    let raf = 0, start = 0
    const tick = (t: number) => {
      if (!start) start = t
      const p = Math.min((t - start) / ms, 1)
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}
