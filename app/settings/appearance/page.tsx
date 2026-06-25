"use client"
import { useTheme } from "@/components/ThemeProvider"

export default function AppearancePage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">Theme</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">Choose your preferred color theme.</p>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4">
          {/* Light */}
          <ThemeCard
            id="light"
            label="Light"
            description="Warm yellow gradient"
            active={theme === "light"}
            onClick={() => setTheme("light")}
            preview={
              <div className="w-full h-full rounded-lg overflow-hidden border border-gray-200"
                style={{ background: "linear-gradient(150deg, #fffdf4 0%, #fffbeb 50%, #fef3c7 100%)" }}>
                <div className="h-5 bg-white/80 border-b border-gray-100 flex items-center px-2 gap-1.5">
                  <div className="w-10 h-1.5 bg-indigo-500 rounded-full" />
                  <div className="ml-auto flex gap-1">
                    <div className="w-5 h-1.5 bg-gray-200 rounded-full" />
                    <div className="w-5 h-1.5 bg-gray-200 rounded-full" />
                  </div>
                </div>
                <div className="p-2 flex flex-col gap-1.5">
                  <div className="h-10 bg-white rounded-lg border border-gray-100 p-1.5 flex flex-col gap-1">
                    <div className="h-1.5 bg-gray-200 rounded w-2/3" />
                    <div className="h-1.5 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-6 bg-indigo-500 rounded-md w-1/3" />
                </div>
              </div>
            }
          />

          {/* Dark */}
          <ThemeCard
            id="dark"
            label="Dark"
            description="Easy on the eyes"
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            preview={
              <div className="w-full h-full rounded-lg overflow-hidden border border-slate-600 bg-slate-900">
                <div className="h-5 bg-slate-800 border-b border-slate-700 flex items-center px-2 gap-1.5">
                  <div className="w-10 h-1.5 bg-indigo-400 rounded-full" />
                  <div className="ml-auto flex gap-1">
                    <div className="w-5 h-1.5 bg-slate-600 rounded-full" />
                    <div className="w-5 h-1.5 bg-slate-600 rounded-full" />
                  </div>
                </div>
                <div className="p-2 flex flex-col gap-1.5">
                  <div className="h-10 bg-slate-800 rounded-lg border border-slate-700 p-1.5 flex flex-col gap-1">
                    <div className="h-1.5 bg-slate-600 rounded w-2/3" />
                    <div className="h-1.5 bg-slate-700 rounded w-1/2" />
                  </div>
                  <div className="h-6 bg-indigo-500 rounded-md w-1/3" />
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}

function ThemeCard({
  label, description, active, onClick, preview,
}: {
  id: string
  label: string
  description: string
  active: boolean
  onClick: () => void
  preview: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-all ${
        active
          ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900"
          : "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500"
      }`}
    >
      <div className="w-full aspect-video">{preview}</div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{description}</p>
        </div>
        {active && (
          <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            ✓
          </div>
        )}
      </div>
    </button>
  )
}
