import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AppPageShell } from "@/components/ui/AppPageShell"
import { QuestNav } from "@/components/ui/QuestNav"
import { SettingsSidebar } from "./SettingsSidebar"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single()

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  const email = user.email ?? ""
  const avatarInitial = name[0]?.toUpperCase() ?? "?"

  return (
    <AppPageShell
      nav={
        <QuestNav active="profile" avatarInitial={avatarInitial} back={{ href: "/dashboard", label: "Dashboard" }} />
      }
    >
      {/* Page title */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
        <h1 className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100">Profile</h1>
      </div>

      {/* Sidebar + content */}
      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 pb-12 flex flex-col md:flex-row gap-6 items-start">
        <SettingsSidebar name={name} email={email} avatarInitial={avatarInitial} />
        <main className="flex-1 min-w-0 w-full">{children}</main>
      </div>
    </AppPageShell>
  )
}
