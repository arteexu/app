"use client"
// components/play/GameScaffold.tsx
// Shared two-pane layout for a live Play game: the board (with a player/clock bar
// above and below it) on the left, and a side panel (status, move list, controls)
// on the right. Mirrors the Free Analysis layout so Play feels native to the app.

interface Props {
  topPlayer: React.ReactNode
  bottomPlayer: React.ReactNode
  board: React.ReactNode
  panel: React.ReactNode
}

export function GameScaffold({ topPlayer, bottomPlayer, board, panel }: Props) {
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden h-full min-w-0">
      {/* Board side */}
      <div className="flex-[0_0_auto] lg:flex-[1_1_0] min-h-0 min-w-0 w-full flex flex-col items-center justify-center gap-2 p-2 sm:p-3 lg:p-6 bg-slate-900 overflow-hidden max-h-[min(70vh,calc(100vw-1rem))] lg:max-h-none">
        <div className="w-full max-w-[min(100%,calc(100vh-9rem))] flex flex-col gap-2 min-h-0">
          {topPlayer}
          <div className="w-full aspect-square max-h-full">{board}</div>
          {bottomPlayer}
        </div>
      </div>

      {/* Side panel */}
      <div className="relative flex-1 min-h-0 min-w-0 w-full lg:w-[380px] xl:w-[420px] lg:flex-none flex flex-col overflow-hidden bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 p-4 sm:p-5">
          {panel}
        </div>
      </div>
    </div>
  )
}
