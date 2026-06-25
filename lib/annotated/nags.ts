// lib/annotated/nags.ts
// UI styling for move-quality glyphs. The JSON already stores human glyphs
// (the ingest script maps NAG codes like "$1" → "!"); here we only decide how
// each glyph looks and reads. Unknown glyphs fall back to a neutral chip.

export interface NagStyle {
  label: string
  /** Tailwind classes for the inline glyph badge. */
  className: string
}

const NAG_STYLES: Record<string, NagStyle> = {
  "!": { label: "Good move", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  "!!": { label: "Brilliant move", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  "?": { label: "Mistake", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  "??": { label: "Blunder", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  "!?": { label: "Interesting move", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  "?!": { label: "Dubious move", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
}

const NEUTRAL: NagStyle = {
  label: "Annotation",
  className: "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300",
}

export function nagStyle(glyph: string): NagStyle {
  return NAG_STYLES[glyph] ?? NEUTRAL
}

/** The primary glyph to show next to a SAN (the first move-quality glyph). */
export function primaryGlyph(nags?: string[]): string | undefined {
  if (!nags?.length) return undefined
  return nags.find((g) => g in NAG_STYLES) ?? nags[0]
}
