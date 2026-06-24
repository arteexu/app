"use client"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"

export default function SignIn() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState(
    searchParams.get("error") === "auth_failed"
      ? "Google sign-in failed. Please try again."
      : ""
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">ChessMind</h1>
          <p className="text-gray-500 mt-2">Learn chess by doing.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 flex flex-col gap-4 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Sign in</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Google OAuth */}
          <GoogleSignInButton label="Sign in with Google" />

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700" />
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">or</span>
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-500 dark:text-slate-400">
            No account?{" "}
            <Link href="/signup" className="text-indigo-600 hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
