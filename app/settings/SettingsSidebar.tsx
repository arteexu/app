"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { clsx } from "clsx"

const NAV_ITEMS = [
  { href: "/settings/profile",     label: "Profile",     icon: "👤" },
  { href: "/settings/board",       label: "Settings",    icon: "⚙️" },
  { href: "/settings/appearance",  label: "Appearance",  icon: "🎨" },
  { href: "/settings/statistics",  label: "Statistics",  icon: "📊" },
]

interface Props {
  name: string
  email: string
  avatarInitial: string
}

export function SettingsSidebar({ name, email, avatarInitial }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/signin")
    router.refresh()
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col gap-1">

      {/* Profile summary at the top of the sidebar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col items-center gap-3 mb-2 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-300 select-none">
          {avatarInitial}
        </div>
        <div className="text-center min-w-0 w-full">
          <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{name}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{email}</p>
        </div>
      </div>

      {/* Nav items */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-2 flex flex-col gap-0.5 shadow-sm">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                  : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-100"
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        {/* Divider */}
        <div className="my-1 border-t border-gray-100 dark:border-slate-700" />

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors w-full text-left"
        >
          <span className="text-base leading-none">↩</span>
          Sign out
        </button>
      </div>
    </aside>
  )
}
