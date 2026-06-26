"use client"

import { useEffect, useState } from "react"
import { clsx } from "clsx"
import {
  getLessonSoundPreference,
  getNextStepPreset,
  getPuzzleSolvedPreset,
  NEXT_STEP_PRESETS,
  PUZZLE_SOLVED_PRESETS,
  setNextStepPreset,
  setPuzzleSolvedPreset,
  type NextStepPresetId,
  type PuzzleSolvedPresetId,
  type SoundPresetOption,
} from "@/lib/lesson-sound-preferences"
import {
  previewLessonSound,
  setLessonSoundEnabled,
  unlockLessonSounds,
} from "@/lib/ui-sounds"

export function LessonSoundPreferencesCard() {
  const [enabled, setEnabled] = useState(true)
  const [puzzlePreset, setPuzzlePreset] = useState<PuzzleSolvedPresetId>("triumph")
  const [nextPreset, setNextPreset] = useState<NextStepPresetId>("slide")

  useEffect(() => {
    setEnabled(getLessonSoundPreference())
    setPuzzlePreset(getPuzzleSolvedPreset())
    setNextPreset(getNextStepPreset())
  }, [])

  function handleToggleEnabled() {
    const next = !enabled
    setEnabled(next)
    setLessonSoundEnabled(next)
  }

  function handlePuzzlePreset(id: PuzzleSolvedPresetId) {
    setPuzzlePreset(id)
    setPuzzleSolvedPreset(id)
  }

  function handleNextPreset(id: NextStepPresetId) {
    setNextPreset(id)
    setNextStepPreset(id)
  }

  function handlePreview(category: "puzzleSolved" | "nextStep", presetId: string) {
    unlockLessonSounds()
    previewLessonSound(category, presetId)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Lesson sounds</h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Celebration and transition sounds during lessons and puzzles.
      </p>

      <div className="flex flex-col gap-6">
        <PreferenceToggle
          label="Enable sounds"
          description="Puzzle solved fanfares and sounds when advancing to the next step."
          checked={enabled}
          onChange={handleToggleEnabled}
          ariaLabel="Enable sounds"
        />

        <PresetSection
          title="Puzzle solved"
          description="Plays when you solve a puzzle or graded step."
          category="puzzleSolved"
          presets={PUZZLE_SOLVED_PRESETS}
          selected={puzzlePreset}
          onSelect={handlePuzzlePreset}
          onPreview={handlePreview}
        />

        <PresetSection
          title="Next step"
          description="Plays when you continue to the next puzzle or step."
          category="nextStep"
          presets={NEXT_STEP_PRESETS}
          selected={nextPreset}
          onSelect={handleNextPreset}
          onPreview={handlePreview}
        />
      </div>
    </div>
  )
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  ariaLabel,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  ariaLabel: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={onChange}
        className={clsx(
          "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
          checked ? "bg-indigo-600" : "bg-gray-200 dark:bg-slate-600",
        )}
      >
        <span
          className={clsx(
            "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  )
}

function PresetSection<T extends string>({
  title,
  description,
  category,
  presets,
  selected,
  onSelect,
  onPreview,
}: {
  title: string
  description: string
  category: "puzzleSolved" | "nextStep"
  presets: SoundPresetOption<T>[]
  selected: T
  onSelect: (id: T) => void
  onPreview: (category: "puzzleSolved" | "nextStep", presetId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {presets.map((preset) => (
          <PresetCard
            key={preset.id}
            label={preset.label}
            description={preset.description}
            active={selected === preset.id}
            onSelect={() => onSelect(preset.id)}
            onPreview={() => onPreview(category, preset.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PresetCard({
  label,
  description,
  active,
  onSelect,
  onPreview,
}: {
  label: string
  description: string
  active: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border-2 p-3 transition-all",
        active
          ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20"
          : "border-gray-200 dark:border-slate-600",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
          {active && (
            <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              ✓
            </div>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
      >
        Preview
      </button>
    </div>
  )
}
