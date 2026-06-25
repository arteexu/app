import { BoardPreferencesCard } from "@/components/settings/BoardPreferencesCard"
import { BoardCustomizeComingSoon } from "@/components/settings/BoardCustomizeComingSoon"

export default function BoardSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-extrabold text-gray-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Board behavior and appearance during lessons and puzzles.
        </p>
      </div>

      <BoardPreferencesCard />
      <BoardCustomizeComingSoon />
    </div>
  )
}
