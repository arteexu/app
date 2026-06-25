"use client"
// components/lesson/LessonLayout.tsx
// Unchanged from the app EXCEPT the right dialogue panel is now `relative` so the
// SolveReward overlay can cover it. Board side hosts a session flip control.

import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"
import { useLessonBoardFlipControl } from "@/hooks/useLessonBoardOrientation"

interface Props {
  board?: React.ReactNode
  children: React.ReactNode
  /** Pinned control bar — stays at the bottom while content scrolls above. */
  footer?: React.ReactNode
}

export function LessonLayout({ board, children, footer }: Props) {
  const flipControl = useLessonBoardFlipControl()

  if (!board) {
    // Board-less layout (e.g. text-only concept cards). The control button flows
    // directly beneath the text (grouped near the top), NOT pinned to the bottom —
    // a short card would otherwise leave a large empty gap below the text.
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center p-8">
        <div className={`w-full max-w-2xl${footer ? " flex flex-col gap-5" : ""}`}>
          {children}
          {footer}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden h-full">
      {/* Left: Board — flip control on the left, square board sized to remaining space */}
      <div className="flex-[1_1_0] min-h-0 min-w-0 w-full flex items-center justify-center gap-2 sm:gap-3 p-3 lg:p-6 bg-slate-900 overflow-hidden">
        {flipControl && (
          <FlipBoardButton
            onClick={flipControl.toggleFlip}
            className="flex-shrink-0 self-center"
          />
        )}
        <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
          <div
            className="w-full aspect-square max-h-full"
            style={{ maxWidth: "min(100%, calc(100vh - 160px))" }}
          >
            {board}
          </div>
        </div>
      </div>

      {/* Right: Dialogue panel (relative → hosts the SolveReward overlay) */}
      <div className="relative flex-[1_1_0] min-h-0 w-full lg:w-[400px] xl:w-[440px] lg:flex-none flex flex-col overflow-hidden bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-slate-700">
        <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 p-6${footer ? " pb-4" : ""}`}>
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 px-6 pb-6 pt-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
