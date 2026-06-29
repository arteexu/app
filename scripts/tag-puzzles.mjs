// tag-puzzles.mjs
// ---------------------------------------------------------------------------
// Tag every PuzzleStep across the curated course JSON files with the Key
// Concepts (`kc-*`) and Tactical Patterns (`tp-*`) it TRAINS, writing the
// additive `keyConcepts` / `tacticalPatterns` fields on each puzzle step.
//
// These tag fields are intentionally DISTINCT from the existing
// `keyConceptId(s)` / `tacticalPatternId(s)` "unlock" fields (which gamify
// lesson progression). They power the post-game "Recommended puzzles"
// reverse-index in lib/insights/puzzle-recommendations.ts.
//
// HOW TAGS ARE DERIVED (highest-confidence signals only):
//   1. Lichess motif → taxonomy. The Tactics Trainer groups 140 Lichess
//      puzzles into lessons by motif (l-tactics-<theme>). That grouping *is*
//      the Lichess `themes` signal preserved by curate-lichess-puzzles.mjs, so
//      we map each theme to its taxonomy id(s).
//   2. Author tags. Hand-authored courses already carry accurate
//      keyConceptId(s)/tacticalPatternId(s)/tacticalPatternUnlocks describing
//      what the puzzle trains — we fold those in verbatim.
//   3. chess.js confirmation. Every solution is re-validated for legality.
//      Mate-themed puzzles must actually end in checkmate before any mate tag
//      is kept, and a back-rank-mate detector cross-tags tp-back-rank-mate only
//      when the final position genuinely is one.
//
// Every resulting id is validated against the live taxonomy (parsed from
// lib/key-concepts.ts and lib/tactical-patterns.ts) — no dangling ids are
// ever written.
//
// USAGE
//   cd app && node scripts/tag-puzzles.mjs            # tag in place
//   cd app && node scripts/tag-puzzles.mjs --check    # verify only (CI-safe)
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Chess } from "chess.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, "..")
const COURSES_DIR = path.join(APP_DIR, "content", "courses")

const CHECK_ONLY = process.argv.includes("--check")

// ── Parse the source-of-truth taxonomies from the TS tuples ─────────────────
// We read the `as const` id tuples directly so this script can never drift
// from the live taxonomy (no hardcoded duplicate list to forget to update).
async function parseIdTuple(file, constName) {
  const src = await readFile(path.join(APP_DIR, "lib", file), "utf8")
  const re = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const`)
  const m = src.match(re)
  if (!m) throw new Error(`Could not find ${constName} in lib/${file}`)
  return new Set([...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
}

const KEY_CONCEPT_IDS = await parseIdTuple("key-concepts.ts", "KEY_CONCEPT_IDS")
const TACTICAL_PATTERN_IDS = await parseIdTuple("tactical-patterns.ts", "TACTICAL_PATTERN_IDS")

// ── Tactics Trainer theme (lesson id l-tactics-<theme>) → taxonomy tags ──────
const THEME_TAGS = {
  fork: { tacticalPatterns: ["tp-fork"] },
  pin: { tacticalPatterns: ["tp-pin"] },
  skewer: { tacticalPatterns: ["tp-skewer"] },
  "discovered-attack": { tacticalPatterns: ["tp-discovered-attack"] },
  "hanging-piece": { tacticalPatterns: ["tp-hanging-piece"] },
  deflection: { tacticalPatterns: ["tp-deflection"] },
  sacrifice: { tacticalPatterns: ["tp-sacrifice"] },
  "mate-in-1": { keyConcepts: ["kc-checkmate"], _mate: true },
  "mate-in-2": { keyConcepts: ["kc-checkmate"], _mate: true },
  "back-rank-mate": {
    tacticalPatterns: ["tp-back-rank-mate"],
    keyConcepts: ["kc-back-rank-mate", "kc-checkmate"],
    _mate: true,
  },
}

// ── chess.js helpers ────────────────────────────────────────────────────────

function replaySolution(step) {
  const game = new Chess(step.fen)
  let last = null
  for (const san of step.solution?.moves ?? []) {
    let res
    // Sanitize check/mate glyphs (incl. the non-standard "+#") the same way the
    // app's PuzzleStep does — chess.js recomputes them and rejects "Rxb1+#".
    const clean = san.replace(/[+#]/g, "")
    try {
      res = game.move(clean)
    } catch {
      return { ok: false, game: null, lastMove: null }
    }
    if (!res) return { ok: false, game: null, lastMove: null }
    last = res
  }
  return { ok: true, game, lastMove: last }
}

// True when `game` (already in checkmate) is a back-rank mate: the mated king
// sits on its own back rank and the mating rook/queen delivered check along it.
function isBackRankMate(game, lastMove) {
  if (!game.isCheckmate() || !lastMove) return false
  if (lastMove.piece !== "r" && lastMove.piece !== "q") return false
  const matedColor = game.turn() // side to move is the side that is mated
  const backRank = matedColor === "w" ? "1" : "8"
  // Locate the mated king.
  let kingSquare = null
  for (const row of game.board()) {
    for (const sq of row) {
      if (sq && sq.type === "k" && sq.color === matedColor) kingSquare = sq.square
    }
  }
  if (!kingSquare || kingSquare[1] !== backRank) return false
  // The mating piece must operate on the back rank (landed on it).
  return lastMove.to[1] === backRank
}

// ── Tag derivation for one puzzle step ──────────────────────────────────────

function deriveTags(step, lessonId, report) {
  const kc = new Set()
  const tp = new Set()

  // (1) Tactics Trainer motif grouping.
  const themeMatch = /^l-tactics-(.+)$/.exec(lessonId ?? "")
  const theme = themeMatch ? THEME_TAGS[themeMatch[1]] : null

  // (3) chess.js confirmation (legality always; mate when relevant).
  const { ok, game, lastMove } = replaySolution(step)
  if (!ok) {
    report.illegal.push(step.id)
    return null
  }
  const isMate = !!game.isCheckmate()

  if (theme) {
    if (theme._mate && !isMate) {
      // A mate-themed puzzle whose line does not end in mate — refuse to tag it
      // as a checkmate trainer rather than risk a wrong tag.
      report.mateMismatch.push(step.id)
    } else {
      for (const id of theme.tacticalPatterns ?? []) tp.add(id)
      for (const id of theme.keyConcepts ?? []) kc.add(id)
    }
  }

  // Cross-tag a genuine back-rank mate even from the generic mate lessons.
  if (isMate && isBackRankMate(game, lastMove)) tp.add("tp-back-rank-mate")

  // (2) Fold in the author's own unlock tags (accurate "what it trains").
  const authorKc = [step.keyConceptId, ...(step.keyConceptIds ?? [])]
  const authorTp = [
    step.tacticalPatternId,
    ...(step.tacticalPatternIds ?? []),
    ...Object.values(step.tacticalPatternUnlocks ?? {}),
  ]
  for (const id of authorKc) if (id) kc.add(id)
  for (const id of authorTp) if (id) tp.add(id)

  // Validate every id against the live taxonomy (drop + report danglers).
  const cleanKc = [...kc].filter((id) => {
    if (KEY_CONCEPT_IDS.has(id)) return true
    report.dangling.push(`${step.id}: kc ${id}`)
    return false
  })
  const cleanTp = [...tp].filter((id) => {
    if (TACTICAL_PATTERN_IDS.has(id)) return true
    report.dangling.push(`${step.id}: tp ${id}`)
    return false
  })

  // Deterministic order: follow the canonical taxonomy tuple order.
  const kcOrder = [...KEY_CONCEPT_IDS]
  const tpOrder = [...TACTICAL_PATTERN_IDS]
  cleanKc.sort((a, b) => kcOrder.indexOf(a) - kcOrder.indexOf(b))
  cleanTp.sort((a, b) => tpOrder.indexOf(a) - tpOrder.indexOf(b))

  return { keyConcepts: cleanKc, tacticalPatterns: cleanTp }
}

// ── Walk the course tree, tagging every puzzle step in place ────────────────

function lessonsOf(chapter) {
  const sectionLessons = (chapter.sections ?? []).flatMap((s) => s.lessons ?? [])
  return [...sectionLessons, ...(chapter.lessons ?? [])]
}

function tagCourse(course, report) {
  for (const chapter of course.chapters ?? []) {
    for (const lesson of lessonsOf(chapter)) {
      for (const step of lesson.steps ?? []) {
        if (step.type !== "puzzle") continue
        report.totalPuzzles++
        const tags = deriveTags(step, lesson.id, report)
        if (!tags) continue
        // Strip any prior tag fields first (idempotent re-runs).
        delete step.keyConcepts
        delete step.tacticalPatterns
        if (tags.keyConcepts.length) step.keyConcepts = tags.keyConcepts
        if (tags.tacticalPatterns.length) step.tacticalPatterns = tags.tacticalPatterns
        if (tags.keyConcepts.length || tags.tacticalPatterns.length) {
          report.taggedPuzzles++
          for (const id of tags.keyConcepts) report.dist.set(id, (report.dist.get(id) ?? 0) + 1)
          for (const id of tags.tacticalPatterns) report.dist.set(id, (report.dist.get(id) ?? 0) + 1)
        } else {
          report.untagged.push(step.id)
        }
      }
    }
  }
}

async function main() {
  const files = (await readdir(COURSES_DIR)).filter((f) => f.endsWith(".json"))
  const report = {
    totalPuzzles: 0,
    taggedPuzzles: 0,
    untagged: [],
    illegal: [],
    mateMismatch: [],
    dangling: [],
    dist: new Map(),
  }

  let changed = false
  for (const file of files) {
    const full = path.join(COURSES_DIR, file)
    const before = await readFile(full, "utf8")
    const course = JSON.parse(before)
    tagCourse(course, report)
    const after = JSON.stringify(course, null, 2) + "\n"
    if (after !== before) {
      changed = true
      if (!CHECK_ONLY) {
        await writeFile(full, after, "utf8")
        console.error(`updated ${file}`)
      } else {
        console.error(`would update ${file}`)
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.error(`\nPuzzles: ${report.taggedPuzzles}/${report.totalPuzzles} tagged`)
  if (report.untagged.length)
    console.error(`Untagged (${report.untagged.length}): ${report.untagged.join(", ")}`)
  if (report.illegal.length)
    console.error(`ILLEGAL solutions (${report.illegal.length}): ${report.illegal.join(", ")}`)
  if (report.mateMismatch.length)
    console.error(`Mate theme but no mate (${report.mateMismatch.length}): ${report.mateMismatch.join(", ")}`)
  if (report.dangling.length) {
    console.error(`DANGLING ids (${report.dangling.length}):\n  ${report.dangling.join("\n  ")}`)
  }
  console.error("\nTag distribution:")
  for (const [id, n] of [...report.dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${id.padEnd(26)} ${n}`)
  }

  const hardFail = report.illegal.length > 0 || report.dangling.length > 0
  if (hardFail) {
    console.error("\nFAILED: illegal solutions or dangling ids present.")
    process.exit(1)
  }
  if (CHECK_ONLY && changed) {
    console.error("\nCHECK FAILED: tags are stale — run without --check to regenerate.")
    process.exit(1)
  }
  console.error("\nOK")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
