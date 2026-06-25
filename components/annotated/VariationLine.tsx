"use client"
// components/annotated/VariationLine.tsx
// A collapsible "sideline" note: the annotator's alternative to the move just
// played. Text-only (MVP) — moves are numbered from the branch point and any
// per-move comments render inline. Uses native <details> for keyboard a11y.

import { clsx } from "clsx"
import type { Variation } from "@/lib/annotated/types"
import { nagStyle } from "@/lib/annotated/nags"
import { MarkdownText } from "@/components/ui/MarkdownText"

interface Props {
  variation: Variation
  /** The main-line move this sideline replaces, e.g. "26.e5" (for the summary). */
  insteadOf?: string
}

interface RenderedMove {
  prefix: string
  san: string
  glyph?: string
  comment?: string
}

function renderMoves(variation: Variation): RenderedMove[] {
  const out: RenderedMove[] = []
  let ply = variation.startsAfterPly + 1
  variation.moves.forEach((m, i) => {
    const moveNumber = Math.floor((ply - 1) / 2) + 1
    const isWhite = ply % 2 === 1
    const prefix = isWhite ? `${moveNumber}.` : i === 0 ? `${moveNumber}...` : ""
    out.push({ prefix, san: m.san, glyph: m.nags?.[0], comment: m.comment })
    ply++
  })
  return out
}

export function VariationLine({ variation, insteadOf }: Props) {
  const moves = renderMoves(variation)
  const firstSan = moves[0] ? `${moves[0].prefix}${moves[0].san}` : "sideline"

  return (
    <details className="group rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/50 open:bg-white dark:open:bg-slate-800">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <span className="text-indigo-500 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden>
          ▶
        </span>
        <span className="text-gray-400 dark:text-slate-500 font-normal">
          {insteadOf ? `Instead of ${insteadOf}:` : "Sideline:"}
        </span>
        <span className="font-mono text-indigo-700 dark:text-indigo-300">{firstSan}</span>
        <span className="ml-auto text-[11px] font-normal text-gray-400 dark:text-slate-500 group-open:hidden">
          show line
        </span>
      </summary>

      <div className="px-3.5 pb-3 pt-1 text-sm leading-relaxed text-gray-700 dark:text-slate-300">
        {variation.comment && (
          <p className="italic text-gray-500 dark:text-slate-400 mb-1.5">
            <MarkdownText>{variation.comment}</MarkdownText>
          </p>
        )}
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          {moves.map((m, i) => (
            <span key={i} className="inline-flex items-baseline gap-1">
              <span className="font-mono text-gray-800 dark:text-slate-200">
                {m.prefix}
                {m.san}
                {m.glyph && (
                  <span className={clsx("ml-0.5 px-1 rounded text-[11px] font-bold align-baseline", nagStyle(m.glyph).className)}>
                    {m.glyph}
                  </span>
                )}
              </span>
              {m.comment && (
                <span className="italic text-gray-500 dark:text-slate-400">
                  <MarkdownText>{m.comment}</MarkdownText>
                </span>
              )}
            </span>
          ))}
        </p>
      </div>
    </details>
  )
}
