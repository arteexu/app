// validate-tactics-puzzles.mjs
// Independent end-to-end validation of the curated Tactics Trainer course.
// Replays every puzzle with chess.js exactly as the app's PuzzleStep does and
// asserts: valid FEN, fully-legal solution line, orientation matches the side
// to move, the preMovePosition setup move reproduces the puzzle FEN, mate
// puzzles truly end in checkmate, and there are no duplicate step ids.
//
// Usage: cd app && node scripts/validate-tactics-puzzles.mjs

import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import { Chess } from "chess.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.resolve(__dirname, "..", "content", "courses", "tactics-trainer.json")
const course = JSON.parse(await readFile(file, "utf8"))

let puzzles = 0
let errors = 0
const ids = new Set()
const fail = (id, msg) => { errors++; console.error(`  ✗ ${id}: ${msg}`) }

for (const ch of course.chapters) {
  for (const l of ch.lessons) {
    for (const s of l.steps) {
      if (s.id) {
        if (ids.has(s.id)) fail(s.id, "duplicate step id")
        ids.add(s.id)
      }
      if (s.type !== "puzzle") continue
      puzzles++

      let g
      try { g = new Chess(s.fen) } catch { fail(s.id, "invalid FEN"); continue }

      const sideToMove = g.turn() === "w" ? "white" : "black"
      if ((s.orientation ?? "white") !== sideToMove) fail(s.id, `orientation ${s.orientation} != side to move ${sideToMove}`)

      let legal = true
      for (const m of s.solution.moves) {
        let res
        try { res = g.move(m) } catch { res = null }
        if (!res) { legal = false; break }
      }
      if (!legal) { fail(s.id, "illegal solution move"); continue }

      if (s.subType === "checkmate-in-n" && !g.isCheckmate()) fail(s.id, "solution does not end in checkmate")

      if (s.solution.moves.length % 2 === 0) fail(s.id, "solution does not end on the learner's move")

      if (s.preMovePosition) {
        try {
          const pg = new Chess(s.preMovePosition.fen)
          const mv = pg.move(s.preMovePosition.san)
          if (!mv) fail(s.id, "illegal setup move")
          else if (pg.fen() !== s.fen) fail(s.id, "setup move does not reproduce puzzle FEN")
        } catch { fail(s.id, "invalid preMovePosition FEN") }
      }
    }
  }
}

console.error(`\nValidated ${puzzles} puzzles across ${course.chapters.length} chapters — ${errors} error(s).`)
process.exit(errors === 0 ? 0 : 1)
