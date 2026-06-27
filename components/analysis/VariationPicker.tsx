"use client"
// components/analysis/VariationPicker.tsx
// Small popup that appears when stepping forward (→) into a position that has
// more than one continuation. Lists the available next moves (mainline first,
// then variations). Up/Down move the highlight, Enter selects, Esc dismisses;
// clicking an option also selects it. Keyboard handling lives in FreeAnalysis
// (a single window keydown handler) so this component focuses purely on display
// and accessibility (listbox/option roles + aria-activedescendant).

import { useEffect, useRef } from "react"
import { clsx } from "clsx"
import type { MoveNumbering, MoveTreeNode } from "@/lib/analysis/move-tree"
import { variationPrefix } from "@/lib/analysis/move-tree"
import { SanNotation } from "@/components/chess/SanNotation"
import { colorFromPly } from "@/lib/san-notation"

interface Props {
  options: MoveTreeNode[]
  /** Ply of the continuation being chosen (0-indexed from the root position). */
  ply: number
  numbering: MoveNumbering
  activeIndex: number
  onHover: (index: number) => void
  onSelect: (index: number) => void
  onClose: () => void
}

export function VariationPicker({
  options,
  ply,
  numbering,
  activeIndex,
  onHover,
  onSelect,
  onClose,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null)

  // Focus the listbox when it opens so screen readers announce it and the
  // visible highlight has a clear owner. Keys are handled globally in
  // FreeAnalysis, so we don't attach our own keydown here (avoids double-steps).
  useEffect(() => {
    listRef.current?.focus()
  }, [])

  if (options.length === 0) return null

  return (
    <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Choose continuation
        </span>
        <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">
          ↑ ↓ · Enter · Esc
        </span>
      </div>
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={-1}
        aria-label="Available continuations"
        aria-activedescendant={`variation-option-${activeIndex}`}
        className="flex flex-col gap-0.5 outline-none"
      >
        {options.map((node, i) => {
          const active = i === activeIndex
          return (
            <li
              key={`${i}-${node.san}`}
              id={`variation-option-${i}`}
              role="option"
              aria-selected={active}
              onMouseEnter={() => onHover(i)}
              onClick={() => onSelect(i)}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition",
                active
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50",
              )}
            >
              <span
                className={clsx(
                  "font-mono text-[11px]",
                  active ? "text-indigo-100" : "text-gray-400 dark:text-slate-500",
                )}
              >
                {variationPrefix(ply, numbering)}
              </span>
              <SanNotation
                san={node.san}
                color={active ? "white" : colorFromPly(ply, numbering.startWhite)}
                size="inherit"
              />
              {i === 0 ? (
                <span
                  className={clsx(
                    "ml-auto text-[10px] font-bold uppercase tracking-wide",
                    active ? "text-indigo-100/90" : "text-gray-400 dark:text-slate-500",
                  )}
                >
                  Main
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="mt-1.5 w-full rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition"
      >
        Cancel (Esc)
      </button>
    </div>
  )
}
