"use client"
// components/lesson/BoardSquareOverlay.tsx
// Reusable overlay that sits on top of a react-chessboard and reveals move
// explanations ON the board. Each annotation places a subtle marker on its
// square; hovering, focusing, or clicking the marker reveals a small popover
// with the explanation tied to that square — keeping the learner's attention on
// the center of the screen instead of a side panel.
//
// Accessibility:
//   • Marker is a real <button> (keyboard + touch friendly).
//   • Hover AND focus reveal the popover (hover alone fails on mobile/keyboard).
//   • Click toggles a "pinned" popover that survives pointer-out.
//   • Esc closes the pinned popover and restores focus to the marker.
//   • Outside-click closes the pinned popover.
//   • Popover is wired via aria-controls / role="dialog" / aria-describedby.

import { useEffect, useId, useRef, useState } from "react"
import { clsx } from "clsx"
import { MarkdownText } from "@/components/ui/MarkdownText"
import { getKeyConcept } from "@/lib/key-concepts"
import { getTacticalPattern } from "@/lib/tactical-patterns"
import { BOARD_SQUARE_PCT, squareCenterPercent, type BoardOrientation } from "@/lib/board-explanations/geometry"
import type { ResolvedAnnotation } from "@/lib/board-explanations/derive"
import {
  annotationVisualHintsToProps,
  type AnnotationVisualHints,
} from "@/lib/board-explanations/visual-hints"
import type { BoardAnnotationKind } from "@/lib/types"

interface Props {
  annotations: ResolvedAnnotation[]
  orientation?: BoardOrientation
  /** Hidden from the layout (e.g. while a move is being played) without unmounting. */
  hidden?: boolean
  /** Called when hover/focus/pinned marker changes; passes authored arrows/highlights only. */
  onActiveVisualsChange?: (visuals: AnnotationVisualHints | null) => void
}

interface KindStyle {
  icon: string
  ring: string       // ring/border color classes
  dot: string        // corner badge background
  chip: string       // popover kind chip
  label: string      // popover kind label
}

const KIND_STYLES: Record<BoardAnnotationKind, KindStyle> = {
  good: {
    icon: "✓",
    ring: "border-emerald-400/90 text-emerald-500 dark:border-emerald-400/80",
    dot: "bg-emerald-500 text-white",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    label: "Strong move",
  },
  bad: {
    icon: "✗",
    ring: "border-red-400/90 text-red-500 dark:border-red-400/80",
    dot: "bg-red-500 text-white",
    chip: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    label: "Mistake",
  },
  concept: {
    icon: "💡",
    ring: "border-amber-400/90 text-amber-500 dark:border-amber-400/80",
    dot: "bg-amber-500 text-white",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    label: "Key concept",
  },
  pattern: {
    icon: "🎯",
    ring: "border-rose-400/90 text-rose-500 dark:border-rose-400/80",
    dot: "bg-rose-500 text-white",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
    label: "Tactical pattern",
  },
  info: {
    icon: "•",
    ring: "border-indigo-400/90 text-indigo-500 dark:border-indigo-400/80",
    dot: "bg-indigo-500 text-white",
    chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
    label: "Note",
  },
}

export function BoardSquareOverlay({
  annotations,
  orientation = "white",
  hidden,
  onActiveVisualsChange,
}: Props) {
  const baseId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  const activeId = pinnedId ?? hoverId

  // Push authored board visuals to the parent while a marker is active.
  useEffect(() => {
    if (!onActiveVisualsChange) return
    if (hidden || !activeId) {
      onActiveVisualsChange(null)
      return
    }
    const active = annotations.find((a) => a.id === activeId)
    onActiveVisualsChange(active ? annotationVisualHintsToProps(active) : null)
    return () => onActiveVisualsChange(null)
  }, [activeId, annotations, hidden, onActiveVisualsChange])

  // Reset open state whenever the annotation set changes (new step/move).
  // Done during render (React's "adjust state on prop change" pattern) rather
  // than in an effect, to avoid a cascading-render lint/perf hit.
  const annotationKey = annotations.map((a) => a.id).join("|")
  const [prevKey, setPrevKey] = useState(annotationKey)
  if (prevKey !== annotationKey) {
    setPrevKey(annotationKey)
    setHoverId(null)
    setPinnedId(null)
  }

  // Esc closes the pinned popover; outside-click does too.
  useEffect(() => {
    if (!pinnedId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation()
        const toFocus = rootRef.current?.querySelector<HTMLElement>(`[data-marker-id="${pinnedId}"]`)
        setPinnedId(null)
        setHoverId(null)
        toFocus?.focus()
      }
    }
    function onPointer(e: PointerEvent) {
      if (!(e.target instanceof Node)) return
      if (rootRef.current?.contains(e.target)) return
      setPinnedId(null)
      setHoverId(null)
    }
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", onPointer, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("pointerdown", onPointer, true)
    }
  }, [pinnedId])

  if (annotations.length === 0) return null

  return (
    <div
      ref={rootRef}
      className={clsx(
        "absolute inset-0 z-20 transition-opacity duration-200 motion-reduce:transition-none",
        hidden ? "opacity-0 pointer-events-none" : "opacity-100",
      )}
      // The layer itself never blocks the board; only markers/popovers do.
      style={{ pointerEvents: "none" }}
      aria-hidden={hidden}
    >
      {annotations.map((a) => {
        const pos = squareCenterPercent(a.square, orientation)
        if (!pos) return null
        const open = activeId === a.id
        const popoverId = `${baseId}-pop-${a.id}`
        const ks = KIND_STYLES[a.kind] ?? KIND_STYLES.info
        const alignRight = pos.leftPct > 78
        const alignLeft = pos.leftPct < 22
        const below = pos.topPct < 46 // not enough room above → drop below

        return (
          <div
            key={a.id}
            className="absolute"
            style={{
              left: `${pos.leftPct}%`,
              top: `${pos.topPct}%`,
              width: `${BOARD_SQUARE_PCT}%`,
              height: `${BOARD_SQUARE_PCT}%`,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            {/* Marker — covers the square so hover/tap anywhere on it works. */}
            <button
              type="button"
              data-marker-id={a.id}
              aria-label={`${ks.label}: ${a.label}. ${open ? "Hide" : "Reveal"} explanation.`}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? popoverId : undefined}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId((h) => (h === a.id ? null : h))}
              onFocus={() => setHoverId(a.id)}
              onBlur={() => setHoverId((h) => (h === a.id ? null : h))}
              onClick={() => setPinnedId((p) => (p === a.id ? null : a.id))}
              className="group absolute inset-0 cursor-pointer focus:outline-none"
              style={{ pointerEvents: "auto" }}
            >
              {/* Square ring — subtle "this square matters" indicator. */}
              <span
                className={clsx(
                  "absolute inset-[7%] rounded-[16%] border-[3px] board-marker-ring",
                  ks.ring,
                  open && "board-marker-ring-active",
                  "group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-white/80",
                )}
                aria-hidden
              />
              {/* Corner badge — kind icon, always crisp. */}
              <span
                className={clsx(
                  "absolute top-[2%] right-[2%] grid place-items-center rounded-full shadow-md",
                  "text-[clamp(8px,42%,13px)] font-extrabold leading-none board-marker-dot",
                  ks.dot,
                )}
                style={{ width: "34%", height: "34%", minWidth: 14, minHeight: 14 }}
                aria-hidden
              >
                {ks.icon}
              </span>
            </button>

            {/* Popover */}
            {open && (
              <div
                id={popoverId}
                role="dialog"
                aria-label={`${ks.label}: ${a.label}`}
                className={clsx(
                  "absolute z-30 w-[min(15rem,60vw)] rounded-xl border shadow-xl board-marker-popover",
                  "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600",
                  "px-3.5 py-3 text-left",
                )}
                style={{
                  left: alignRight ? "auto" : alignLeft ? "0%" : "50%",
                  right: alignRight ? "0%" : "auto",
                  transform: alignLeft || alignRight ? "none" : "translateX(-50%)",
                  ...(below
                    ? { top: "calc(100% + 8px)" }
                    : { bottom: "calc(100% + 8px)" }),
                  pointerEvents: "auto",
                }}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId((h) => (h === a.id ? null : h))}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={clsx("text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded", ks.chip)}>
                    {ks.label}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">{a.square}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{a.label}</p>
                {a.detail && (
                  <div className="text-[13px] text-gray-600 dark:text-slate-300 leading-relaxed mt-1">
                    <MarkdownText>{a.detail}</MarkdownText>
                  </div>
                )}
                <AnnotationLinks annotation={a} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Small concept/pattern reference chips shown inside a popover when linked. */
function AnnotationLinks({ annotation }: { annotation: ResolvedAnnotation }) {
  const concept = annotation.keyConceptId ? getKeyConcept(annotation.keyConceptId) : undefined
  const pattern = annotation.tacticalPatternId ? getTacticalPattern(annotation.tacticalPatternId) : undefined
  if (!concept && !pattern) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
      {concept && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          <span aria-hidden>{concept.icon}</span> {concept.title}
        </span>
      )}
      {pattern && (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
          <span aria-hidden>{pattern.icon}</span> {pattern.title}
        </span>
      )}
    </div>
  )
}
