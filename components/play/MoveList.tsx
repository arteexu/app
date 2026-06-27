"use client"
// components/play/MoveList.tsx
// A compact two-column SAN move list for a full game. Read-only (Play is live, not
// analysis): it auto-scrolls to the latest move so the current position stays in view.

import { useEffect, useRef } from "react"
import { clsx } from "clsx"
import type { PlayedMove } from "@/lib/play/types"

export function MoveList({ moves }: { moves: PlayedMove[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [moves.length])

  // Group into full moves: [whiteMove, blackMove?].
  const rows: { no: number; white?: PlayedMove; black?: PlayedMove }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: moves[i], black: moves[i + 1] })
  }

  if (moves.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-slate-500 px-1 py-2">
        No moves yet — make the first move.
      </p>
    )
  }

  return (
    <div className="max-h-48 lg:max-h-none lg:flex-1 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.no} className={clsx(idx % 2 === 0 ? "bg-transparent" : "bg-black/[0.02] dark:bg-white/[0.02]")}>
              <td className="w-9 px-2 py-1 text-right font-mono text-xs text-gray-400 dark:text-slate-500 align-top">
                {row.no}.
              </td>
              <td className="px-2 py-1 font-semibold text-gray-800 dark:text-slate-200">
                {row.white?.san ?? ""}
              </td>
              <td className="px-2 py-1 font-semibold text-gray-800 dark:text-slate-200">
                {row.black?.san ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={endRef} />
    </div>
  )
}
