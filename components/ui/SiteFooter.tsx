import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="flex-shrink-0 border-t border-gray-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2 text-center sm:text-left">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          <span className="font-display font-extrabold text-gray-700 dark:text-slate-300">ChessMind</span>
          <span className="mx-2 text-gray-300 dark:text-slate-600" aria-hidden>
            ·
          </span>
          <span>Learn chess by doing</span>
        </p>
        <Link
          href="/purpose"
          className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-sm"
        >
          Our Purpose
        </Link>
      </div>
    </footer>
  )
}
