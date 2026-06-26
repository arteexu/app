import { LessonSoundPreferencesCard } from "@/components/settings/LessonSoundPreferencesCard"

export default function SoundsSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">Sounds</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Customize celebration and transition sounds for lessons and puzzles.
        </p>
      </div>

      <LessonSoundPreferencesCard />
    </div>
  )
}
