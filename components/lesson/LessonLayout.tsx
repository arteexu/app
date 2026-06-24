"use client"

interface Props {
  board?: React.ReactNode
  children: React.ReactNode
}

export function LessonLayout({ board, children }: Props) {
  if (!board) {
    return (
      <div className="flex-1 flex items-start justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
      {/* Left: Board — fills available space, capped so it stays square */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8 bg-slate-900">
        <div
          className="w-full aspect-square"
          style={{ maxWidth: "min(100%, calc(100vh - 160px))" }}
        >
          {board}
        </div>
      </div>

      {/* Right: Dialogue panel */}
      <div className="w-full lg:w-[400px] xl:w-[440px] flex flex-col gap-5 p-6 overflow-y-auto bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700 shrink-0">
        {children}
      </div>
    </div>
  )
}
