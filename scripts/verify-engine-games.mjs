#!/usr/bin/env node
// scripts/verify-engine-games.mjs
// Reads the eng-med-* rows back from Supabase (public anon key — engine_games is
// world-readable) and checks each stored game against the locally-generated,
// already-validated scripts/engine-games.generated.json:
//   • moves array stored == local (catches any insert transcription error)
//   • every stored move replays legally from the start with chess.js
//   • result is DECISIVE (1-0 or 0-1 — NO draws)
//   • if the final position is a real checkmate, the mated side matches the
//     stored result; non-mate finishes are allowed (resign-adjudicated wins)
//   • difficulty/source/is_generated match
// Prints a per-game OK/FAIL line and a final summary; exits non-zero on any FAIL.

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { Chess } from "chess.js"

const require = createRequire(import.meta.url)
const { createClient } = require("@supabase/supabase-js")

const __dirname = dirname(fileURLToPath(import.meta.url))
const local = JSON.parse(
  readFileSync(resolve(__dirname, "engine-games.generated.json"), "utf8"),
)

// Read env from .env.local (anon key only; engine_games is publicly readable).
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "../.env.local"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function legal(moves, startFen) {
  const c = new Chess(startFen || undefined)
  for (const m of moves) {
    try {
      if (!c.move(m)) return { ok: false, fen: c.fen() }
    } catch {
      return { ok: false, fen: c.fen() }
    }
  }
  // Report the terminal state so we can sanity-check decisive results.
  return {
    ok: true,
    fen: c.fen(),
    checkmate: c.isCheckmate(),
    // chess.js: side to move is the one that is mated → the OTHER side won.
    mateWinner: c.isCheckmate() ? (c.turn() === "w" ? "0-1" : "1-0") : null,
    gameOver: c.isGameOver(),
  }
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { i, a: a[i], b: b[i] }
  return true
}

const ids = local.map((g) => g.id)
const { data, error } = await supabase
  .from("engine_games")
  .select("id, title, opening, eco, result, difficulty, start_fen, moves, is_generated, source")
  .in("id", ids)

if (error) {
  console.error("Supabase read error:", error.message)
  process.exit(2)
}
const byId = new Map(data.map((r) => [r.id, r]))

let fails = 0
for (const g of local) {
  const row = byId.get(g.id)
  const problems = []
  if (!row) {
    problems.push("MISSING in DB")
  } else {
    const eq = arraysEqual(row.moves, g.moves)
    if (eq !== true) {
      problems.push(
        typeof eq === "object"
          ? `moves differ @${eq.i}: db="${eq.a}" local="${eq.b}"`
          : `moves differ (len db=${row.moves?.length} local=${g.moves.length})`,
      )
    }
    const lg = legal(row.moves || [], row.start_fen)
    if (!lg.ok) problems.push(`ILLEGAL move list (stops at ${lg.fen})`)
    if (row.result !== g.result) problems.push(`result db=${row.result} local=${g.result}`)
    // Decisive requirement: no draws.
    if (row.result !== "1-0" && row.result !== "0-1") problems.push(`NOT DECISIVE (result=${row.result})`)
    // If it's a real checkmate, the result must match the mated side.
    if (lg.ok && lg.checkmate && lg.mateWinner !== row.result) {
      problems.push(`checkmate winner ${lg.mateWinner} != result ${row.result}`)
    }
    // A decisive result on a still-playable position = resign-adjudicated (fine).
    if (row.difficulty !== g.difficulty) problems.push(`difficulty db=${row.difficulty}`)
    if (row.source !== "generated") problems.push(`source db=${row.source}`)
    if (row.is_generated !== true) problems.push(`is_generated db=${row.is_generated}`)
  }
  if (problems.length) {
    fails++
    console.log(`✗ ${g.id} ${g.opening}: ${problems.join("; ")}`)
  } else {
    const lg = legal(row.moves, row.start_fen)
    const how = lg.checkmate ? "mate" : "adjudicated"
    console.log(`✓ ${g.id} ${g.opening} (${row.moves.length} plies, ${row.result}, ${how})`)
  }
}

const present = [...byId.values()]
const decisive = present.filter((r) => r.result === "1-0" || r.result === "0-1").length
const draws = present.filter((r) => r.result === "1/2-1/2").length
const whiteWins = present.filter((r) => r.result === "1-0").length
const blackWins = present.filter((r) => r.result === "0-1").length
const distinct = new Set(present.map((r) => JSON.stringify(r.moves))).size
const withOpening = present.filter((r) => r.opening && r.opening !== "Unknown").length

console.log(
  `\n${local.length - fails}/${local.length} OK · ${byId.size}/${local.length} present in DB\n` +
    `decisive: ${decisive}/${present.length} · draws: ${draws} · ` +
    `white wins: ${whiteWins} · black wins: ${blackWins} · ` +
    `distinct move lists: ${distinct} · openings populated: ${withOpening}`,
)
process.exit(fails ? 1 : 0)
