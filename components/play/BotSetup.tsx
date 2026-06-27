"use client"
// components/play/BotSetup.tsx
// Pre-game setup for Play vs Bot: choose your color, the Stockfish strength, and
// a time control. Calls onStart with the chosen options.

import { useState } from "react"
import { clsx } from "clsx"
import { BOT_LEVELS, DEFAULT_BOT_LEVEL } from "@/lib/play/bot-levels"
import { TIME_CONTROLS, DEFAULT_TIME_CONTROL } from "@/lib/play/time-controls"
import type { ColorChoice } from "@/lib/play/types"

export interface BotGameOptions {
  color: ColorChoice
  levelId: string
  timeControlId: string
}

const COLOR_OPTIONS: { id: ColorChoice; label: string; glyph: string }[] = [
  { id: "white", label: "White", glyph: "♔" },
  { id: "random", label: "Random", glyph: "⁇" },
  { id: "black", label: "Black", glyph: "♚" },
]

export function BotSetup({ onStart }: { onStart: (opts: BotGameOptions) => void }) {
  const [color, setColor] = useState<ColorChoice>("white")
  const [levelId, setLevelId] = useState(DEFAULT_BOT_LEVEL.id)
  const [timeControlId, setTimeControlId] = useState(DEFAULT_TIME_CONTROL.id)

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Play vs Bot
        </p>
        <h1 className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">
          Set up your game
        </h1>
      </div>

      {/* Color */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Your color</legend>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              className={clsx(
                "flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-display font-bold transition",
                color === c.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {c.glyph}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Strength */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Bot strength</legend>
        <div className="flex flex-col gap-2">
          {BOT_LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setLevelId(lvl.id)}
              className={clsx(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 text-left transition",
                levelId === lvl.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700",
              )}
            >
              <span>
                <span className="font-display font-extrabold text-gray-900 dark:text-slate-100">
                  {lvl.label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">{lvl.blurb}</span>
              </span>
              <span className="shrink-0 text-xs font-mono font-bold text-gray-400 dark:text-slate-500 tabular-nums">
                {lvl.nominalElo}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Time control */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">Time control</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.id}
              type="button"
              onClick={() => setTimeControlId(tc.id)}
              className={clsx(
                "flex flex-col items-center py-2.5 rounded-xl border-2 transition",
                timeControlId === tc.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700",
              )}
            >
              <span className="font-display font-extrabold tabular-nums">{tc.id}</span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">{tc.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <button
        onClick={() => onStart({ color, levelId, timeControlId })}
        className="w-full font-display text-lg font-extrabold py-3.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/30 transition"
      >
        ▶ Start game
      </button>
    </div>
  )
}
