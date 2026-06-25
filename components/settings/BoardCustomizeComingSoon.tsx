export function BoardCustomizeComingSoon() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm opacity-90">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
            Customize board
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            Piece sets, board themes, and coordinate styles — pick a look that feels like yours.
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
          Coming soon
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 pointer-events-none select-none" aria-hidden>
        {["Classic", "Wood", "Neon"].map(label => (
          <div
            key={label}
            className="rounded-xl border border-dashed border-gray-200 dark:border-slate-600 p-3 flex flex-col gap-2"
          >
            <div className="aspect-square rounded-lg bg-gradient-to-br from-[#f0d9b5] to-[#b58863] dark:from-[#769656]/40 dark:to-[#486030]/40 opacity-60" />
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 text-center">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
