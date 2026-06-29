"use client"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton"
import { ChessMindLoader } from "@/components/ui/ChessMindLoader"

function SignInForm() {
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

  const inputCls =
    "border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-base text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none " +
    "bitcoin:bg-black/50 bitcoin:rounded-lg bitcoin:border-transparent bitcoin:border-b-2 bitcoin:border-b-white/20 bitcoin:text-white bitcoin:placeholder:text-white/30 bitcoin:focus:border-b-[#F7931A] bitcoin:focus:shadow-[0_10px_20px_-10px_rgba(247,147,26,0.3)] bitcoin:transition-all"

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient energy fields + blockchain grid (Bitcoin DeFi theme only) */}
      <div aria-hidden className="hidden bitcoin:block pointer-events-none absolute inset-0 bg-grid-pattern opacity-60" />
      <div aria-hidden className="hidden bitcoin:block pointer-events-none absolute -top-40 -right-24 h-[420px] w-[420px] rounded-full bg-[#F7931A] opacity-10 blur-[120px]" />
      <div aria-hidden className="hidden bitcoin:block pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-[#EA580C] opacity-10 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <span aria-hidden className="hidden bitcoin:inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EA580C] to-[#F7931A] text-white text-3xl mb-4 shadow-[0_0_30px_-5px_rgba(247,147,26,0.6)]">
            ♞
          </span>
          <h1 className="text-3xl font-bold text-indigo-600 bitcoin:font-display bitcoin:text-4xl bitcoin:tracking-tight bitcoin:text-white">
            Chess<span className="text-gradient-bitcoin">Mind</span>
          </h1>
          <p className="text-gray-500 mt-2 bitcoin:text-[#94A3B8]">Learn chess by doing.</p>
        </div>

        <div className="glass bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 flex flex-col gap-4 shadow-sm bitcoin:shadow-[0_0_50px_-10px_rgba(247,147,26,0.1)]">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 bitcoin:font-display bitcoin:text-white">Sign in</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 bitcoin:text-[#F7931A] bitcoin:bg-[#F7931A]/10 bitcoin:border bitcoin:border-[#F7931A]/30">{error}</p>
          )}

          <GoogleSignInButton label="Sign in with Google" />

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700 bitcoin:border-white/10" />
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium bitcoin:font-mono bitcoin:uppercase bitcoin:tracking-widest bitcoin:text-[#94A3B8]">or</span>
            <div className="flex-1 border-t border-gray-200 dark:border-slate-700 bitcoin:border-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-slate-300 bitcoin:font-mono bitcoin:text-xs bitcoin:uppercase bitcoin:tracking-wider bitcoin:text-[#94A3B8]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputCls}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-slate-300 bitcoin:font-mono bitcoin:text-xs bitcoin:uppercase bitcoin:tracking-wider bitcoin:text-[#94A3B8]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-500 dark:text-slate-400 bitcoin:text-[#94A3B8]">
            No account?{" "}
            <Link href="/signup" className="text-indigo-600 hover:underline font-medium bitcoin:text-[#F7931A] bitcoin:hover:text-[#FFD600]">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={<ChessMindLoader fullScreen size="lg" />}>
      <SignInForm />
    </Suspense>
  )
}
