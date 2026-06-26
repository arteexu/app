#!/usr/bin/env node
// scripts/generate-engine-games.mjs
//
// One-off generator for the shared Multiplayer "engine_games" pool. Produces 20
// UNIQUE, randomly-varied engine self-play games at "medium" strength and emits:
//   1. scripts/engine-games.generated.json   (inspectable game objects)
//   2. supabase/migrations/005_engine_games_medium.sql  (idempotent seed)
//
// ── Anti-cheat / variety (why this exists) ──────────────────────────────────
// Pure Stockfish-vs-Stockfish at fixed settings is DETERMINISTIC: it plays the
// same game every time, and that game might be a known master game a user could
// look up. To make 20 DIFFERENT, NON-FAMOUS games we introduce variety:
//
//   • Each game starts from a DIFFERENT sound book opening (20 distinct lines
//     drawn from lib/solitaire/openings.ts + common main lines). The book moves
//     are played verbatim (sound, precise theory), then the engine takes over.
//   • For a few plies right after the book, we let the engine pick RANDOMLY
//     among its top-N MultiPV candidates that are within a small eval margin of
//     best (default 40cp) — so even transposing openings diverge into unique
//     middlegames. This never picks an outright bad move.
//   • Games are de-duped by full SAN move list; a collision is regenerated.
//
// ── Precision of the SOLVE side + decisive results (both colors) ─────────────
// Two requirements collide: (a) the solve side's moves must be PRECISE
// (best/near-best) so the puzzle has a real answer, and (b) the 20 games must
// vary which side is the "solve" side (multiplayer needs both colors). But
// EQUAL-strength precise self-play DRAWS essentially every game, and a drawn
// game has no winner — so its solve side always defaults to White. (An earlier
// symmetric depth-18 run produced 20/20 draws.)
//
// Resolution: each game has an INTENDED solve side (we alternate W/B across the
// 20). That side searches to a strong fixed depth (SOLVE_DEPTH=18, capped at
// MOVETIME_CAP_MS≈3s) → its moves are precise best/near-best. The OPPONENT plays
// a weaker bounded search (OPP_DEPTH=6) so the game reaches a decisive, natural
// finish that the precise side wins. In Solitaire the learner only ever GUESSES
// the solve (winning) side's moves; the opponent's moves are auto-played, so the
// puzzle the user solves is precise. We require the realized winner to equal the
// intended solve side (else regenerate); the stored `result` therefore encodes
// the solve color (playableSide() → winner), giving the pool both colors.
//
// ── EVERY game is DECISIVE (zero draws) ─────────────────────────────────────
// Equal-strength precise self-play draws, and even a moderately weak opponent
// sometimes holds a draw / the conversion stalls before mate. To guarantee a
// real winner in all 20 games we combine three levers:
//   1. The opponent is weakened HARD: it plays its Stockfish "Skill Level"
//      (OPP_SKILL, default 0 = weakest) best move at a low depth cap (OPP_DEPTH),
//      so the precise solve side builds a winning advantage. We use the engine's
//      actual (skill-limited) `bestmove` for the opponent — NOT the objective
//      top PV — so Skill Level genuinely weakens it.
//   2. We let games play out to a NATURAL finish (preferred: real checkmate).
//   3. RESIGN ADJUDICATION fallback: we track the solve side's eval each time it
//      is to move; if it stays overwhelmingly winning (≥ ADJUDICATE_CP = +6.00,
//      or a forced mate) for ADJUDICATE_PLIES consecutive solve-side moves, we
//      award the win to the solve side. This converts "winning but not yet mated
//      / accidental stalemate / repetition / 120-ply cap" into a decisive result
//      without a literal mate. A long, clearly-won game also early-stops once the
//      streak reaches EARLY_ADJUDICATE_PLIES (bounds wall-clock).
// If a game still isn't decisive for the intended solve side (e.g. the weak
// opponent somehow held or the solve side never reached +6), it is RE-ROLLED
// with a fresh random divergence until decisive (up to DECISIVE_TRIES).
//
// "Medium" per the app convention is ~3s/move (SPEED_PRESETS.medium) → stored
// difficulty 3. The single-threaded lite WASM reaches depth 18 well under 3s on
// most positions, so the solve side is near-best and generation is reasonable.
//
// Run from app/:  node scripts/generate-engine-games.mjs
// Env overrides: GEN_GAMES, GEN_SOLVE_DEPTH, GEN_OPP_DEPTH, GEN_OPP_SKILL,
//                GEN_MOVETIME_CAP_MS, GEN_PLY_CAP, GEN_RANDOM_PLIES, GEN_MARGIN_CP,
//                GEN_MULTIPV, GEN_DECISIVE_TRIES, GEN_ADJUDICATE_CP,
//                GEN_ADJUDICATE_PLIES, GEN_EARLY_ADJUDICATE_PLIES, GEN_SEED.

import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { Chess } from "chess.js"

const require = createRequire(import.meta.url)
const initEngine = require("stockfish")

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_DIR = resolve(__dirname, "..")

// ── Config ──────────────────────────────────────────────────────────────────
const NUM_GAMES = Number(process.env.GEN_GAMES ?? 20)
const SOLVE_DEPTH = Number(process.env.GEN_SOLVE_DEPTH ?? 18) // precise (solve side)
const OPP_DEPTH = Number(process.env.GEN_OPP_DEPTH ?? 4) // weaker (opponent → decisive)
const OPP_SKILL = Number(process.env.GEN_OPP_SKILL ?? 0) // Stockfish Skill Level 0-20 (0 = weakest)
const MOVETIME_CAP_MS = Number(process.env.GEN_MOVETIME_CAP_MS ?? 3000)
const PLY_CAP = Number(process.env.GEN_PLY_CAP ?? 120) // safety cap for STORED games
const RANDOM_PLIES = Number(process.env.GEN_RANDOM_PLIES ?? 4) // diverging window after book
const MARGIN_CP = Number(process.env.GEN_MARGIN_CP ?? 40) // "near-best" tolerance
const MULTIPV = Number(process.env.GEN_MULTIPV ?? 3)
const DECISIVE_TRIES = Number(process.env.GEN_DECISIVE_TRIES ?? 25) // re-rolls to get a decisive win
const ADJUDICATE_CP = Number(process.env.GEN_ADJUDICATE_CP ?? 600) // |eval| ≥ this = "clearly winning"
const ADJUDICATE_PLIES = Number(process.env.GEN_ADJUDICATE_PLIES ?? 6) // sustained solve-side plies to adjudicate
const EARLY_ADJUDICATE_PLIES = Number(process.env.GEN_EARLY_ADJUDICATE_PLIES ?? 16) // early-stop a clearly-won long game
const FLAVOR = process.env.COMMENTARY_SERVER_ENGINE || "lite-single"

// Tiny seeded PRNG (mulberry32) so a fixed GEN_SEED reproduces the same draws.
function makeRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(Number(process.env.GEN_SEED ?? 1337))

// ── 20 distinct, sound book openings (SAN from the standard start) ───────────
// Names/ECO are accurate to the seeded line, so opening labels are reliable
// without needing the TS detector. These cover e4/d4/c4/Nf3 families broadly.
const OPENINGS = [
  { name: "Ruy Lopez", eco: "C60", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { name: "Italian Game", eco: "C50", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { name: "Sicilian Defense", eco: "B20", moves: ["e4", "c5"] },
  { name: "French Defense", eco: "C00", moves: ["e4", "e6"] },
  { name: "Caro-Kann Defense", eco: "B10", moves: ["e4", "c6"] },
  { name: "Queen's Gambit", eco: "D06", moves: ["d4", "d5", "c4"] },
  { name: "King's Indian Defense", eco: "E60", moves: ["d4", "Nf6", "c4", "g6"] },
  { name: "English Opening", eco: "A10", moves: ["c4"] },
  { name: "Scandinavian Defense", eco: "B01", moves: ["e4", "d5"] },
  { name: "London System", eco: "D02", moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
  {
    name: "Sicilian Defense, Najdorf Variation",
    eco: "B90",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  },
  { name: "Nimzo-Indian Defense", eco: "E20", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { name: "Queen's Gambit Declined", eco: "D30", moves: ["d4", "d5", "c4", "e6"] },
  { name: "Slav Defense", eco: "D10", moves: ["d4", "d5", "c4", "c6"] },
  { name: "Grünfeld Defense", eco: "D80", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { name: "Pirc Defense", eco: "B07", moves: ["e4", "d6", "d4", "Nf6", "Nc3"] },
  { name: "Catalan Opening", eco: "E00", moves: ["d4", "Nf6", "c4", "e6", "g3"] },
  { name: "Réti Opening", eco: "A05", moves: ["Nf3", "Nf6", "g3"] },
  { name: "Vienna Game", eco: "C25", moves: ["e4", "e5", "Nc3"] },
  { name: "Petrov (Russian) Defense", eco: "C42", moves: ["e4", "e5", "Nf3", "Nf6"] },
]

// ── Engine plumbing (mirrors lib/commentary/engine-node.ts) ──────────────────
let enginePromise = null
function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const engine = await initEngine(FLAVOR)
      await handshake(engine)
      return engine
    })()
  }
  return enginePromise
}

function handshake(engine) {
  return new Promise((resolve) => {
    let stage = 0
    const done = () => {
      engine.listener = undefined
      resolve()
    }
    engine.listener = (line) => {
      const t = String(line).trim()
      if (stage === 0 && t === "uciok") {
        stage = 1
        engine.sendCommand("isready")
      } else if (stage === 1 && t === "readyok") {
        stage = 2
        done()
      }
    }
    engine.sendCommand("uci")
    setTimeout(() => { if (stage < 2) done() }, 5000)
  })
}

function parseInfo(text) {
  if (!text.startsWith("info ")) return null
  if (!text.includes(" pv ") || !text.includes(" score ")) return null
  const tok = text.split(/\s+/)
  let depth = 0, scoreCp = null, scoreMate = null, multipv = 1, pv = []
  for (let i = 0; i < tok.length; i++) {
    const k = tok[i]
    if (k === "depth") depth = Number(tok[i + 1]) || 0
    else if (k === "multipv") multipv = Number(tok[i + 1]) || 1
    else if (k === "score") {
      const kind = tok[i + 1]
      const val = Number(tok[i + 2])
      if (kind === "cp") scoreCp = val
      else if (kind === "mate") scoreMate = val
    } else if (k === "pv") {
      pv = tok.slice(i + 1)
      break
    }
  }
  if (scoreCp === null && scoreMate === null) return null
  if (pv.length === 0) return null
  return { depth, scoreCp, scoreMate, multipv, pv }
}

// Analyze a position. Returns { lines, bestMove } where `lines` are the deepest
// EngineLine per MultiPV index (best-first) and `bestMove` is the engine's actual
// UCI `bestmove` (which RESPECTS the Skill Level set for this call — used to
// weaken the opponent). depth-bounded but movetime-capped.
async function analyze(fen, { multiPv = 1, depth = SOLVE_DEPTH, skill = 20, movetimeCap = MOVETIME_CAP_MS } = {}) {
  const engine = await getEngine()
  return new Promise((resolve) => {
    const byIdx = new Map()
    let bestMove = null
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      engine.listener = undefined
      resolve({
        lines: [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l),
        bestMove,
      })
    }
    const timer = setTimeout(() => {
      engine.sendCommand("stop")
      setTimeout(finish, 400)
    }, movetimeCap + 2000)
    engine.listener = (line) => {
      if (typeof line !== "string") return
      const info = parseInfo(line)
      if (info) {
        byIdx.set(info.multipv, info)
        return
      }
      if (line.startsWith("bestmove")) {
        const m = line.split(/\s+/)[1]
        bestMove = m && m !== "(none)" ? m : null
        finish()
      }
    }
    engine.sendCommand("stop")
    // Skill Level genuinely weakens the engine's chosen `bestmove`. Full (20) for
    // the precise solve side; low for the opponent.
    engine.sendCommand(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(skill)))}`)
    engine.sendCommand(`setoption name MultiPV value ${multiPv}`)
    engine.sendCommand(`position fen ${fen}`)
    // Bound by BOTH a strong depth and the medium movetime budget.
    engine.sendCommand(`go depth ${depth} movetime ${movetimeCap}`)
  })
}

function lineValue(l) {
  if (l.scoreMate !== null) return l.scoreMate > 0 ? 100000 - l.scoreMate : -100000 - l.scoreMate
  return l.scoreCp ?? 0
}

function deriveResult(chess) {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" : "1-0"
  return "1/2-1/2"
}

// ── Self-play one game from a book opening ───────────────────────────────────
// `solveSide` ("white"|"black") is the side whose moves are PRECISE (depth
// SOLVE_DEPTH, full skill); the OPPONENT plays its skill-limited (OPP_SKILL) best
// move at a low depth (OPP_DEPTH), so the precise side wins. During the opening
// random window BOTH sides use the MultiPV near-best draw for variety.
//
// Decisiveness: we track the solve side's eval (from its POV, each time it is to
// move). A trailing streak of solve-side plies with eval ≥ ADJUDICATE_CP (or a
// forced mate) drives RESIGN ADJUDICATION — either an early stop on a long, won
// game (streak ≥ EARLY_ADJUDICATE_PLIES) or, at any game end (natural draw /
// stalemate / repetition / ply cap), awarding the win if the streak is long
// enough. Real checkmates are kept as-is.
async function playGame(opening, label, solveSide) {
  const chess = new Chess()
  const moves = []
  // 1) Play the book opening verbatim (sound, precise theory).
  for (const san of opening.moves) {
    const mv = chess.move(san)
    if (!mv) throw new Error(`Bad book move ${san} in ${opening.name}`)
    moves.push(mv.san)
  }
  const bookLen = moves.length

  const solveWin = solveSide === "white" ? "1-0" : "0-1"
  let winStreak = 0 // consecutive solve-side plies with eval ≥ ADJUDICATE_CP
  let adjudicatedEarly = false

  // 2) Continue until natural end / safety cap / early adjudication.
  while (!chess.isGameOver() && moves.length < PLY_CAP) {
    const fen = chess.fen()
    const sideToMove = chess.turn() === "w" ? "white" : "black"
    const isSolve = sideToMove === solveSide
    const inRandomWindow = moves.length < bookLen + RANDOM_PLIES
    const depth = isSolve ? SOLVE_DEPTH : OPP_DEPTH
    const skill = isSolve ? 20 : OPP_SKILL
    const useMultiPv = inRandomWindow ? MULTIPV : 1
    const { lines, bestMove } = await analyze(fen, { multiPv: useMultiPv, depth, skill })
    if (!lines.length || !lines[0].pv.length) break

    // Track how winning the solve side is (from its POV) when it is to move.
    if (isSolve) {
      const evalCp = lineValue(lines[0]) // ≥0 means solve side is better
      winStreak = evalCp >= ADJUDICATE_CP ? winStreak + 1 : 0
      // Early-stop a clearly-won, drawn-out game to bound wall-clock.
      if (winStreak >= EARLY_ADJUDICATE_PLIES) {
        adjudicatedEarly = true
        break
      }
    }

    // Move selection: random near-best in the opening window (variety); else the
    // solve side takes the objective best line, the opponent takes its actual
    // skill-limited bestmove (genuinely weaker).
    let uci
    if (inRandomWindow && lines.length > 1) {
      const best = lineValue(lines[0])
      const near = lines.filter((l) => l.pv.length && best - lineValue(l) <= MARGIN_CP)
      uci = near[Math.floor(rng() * near.length)].pv[0]
    } else if (isSolve) {
      uci = lines[0].pv[0]
    } else {
      uci = bestMove ?? lines[0].pv[0]
    }

    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    let mv
    try {
      mv = chess.move({ from, to, promotion })
    } catch {
      break
    }
    if (!mv) break
    moves.push(mv.san)
    if (moves.length % 20 === 0) {
      process.stderr.write(`  [${label}] ${opening.name}: ${moves.length} plies…\n`)
    }
  }

  // 3) Decide the result. Prefer a natural checkmate; otherwise adjudicate the
  // win to the solve side when it has been clearly winning long enough.
  const natural = deriveResult(chess)
  let result = natural
  let adjudicated = false
  if (natural === "1-0" || natural === "0-1") {
    result = natural // real checkmate
  } else if (adjudicatedEarly || winStreak >= ADJUDICATE_PLIES) {
    result = solveWin // resign-adjudicated decisive win for the precise side
    adjudicated = true
  } // else: leaves a draw → caller re-rolls

  return {
    moves,
    result,
    adjudicated,
    winStreak,
    ended: chess.isGameOver() || adjudicated,
    finalFen: chess.fen(),
    bookLen,
  }
}

// ── SQL helpers ──────────────────────────────────────────────────────────────
function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}
function sqlJson(arr) {
  return `${sqlStr(JSON.stringify(arr))}::jsonb`
}

function rowSql(g) {
  const cols = "id, title, opening, eco, white, black, event, year, result, difficulty, start_fen, max_start_move, moves, is_generated, source"
  const vals = [
    sqlStr(g.id),
    sqlStr(g.title),
    sqlStr(g.opening),
    sqlStr(g.eco),
    sqlStr(g.white),
    sqlStr(g.black),
    sqlStr(g.event),
    g.year,
    sqlStr(g.result),
    g.difficulty,
    g.start_fen === null ? "null" : sqlStr(g.start_fen),
    g.max_start_move === null ? "null" : g.max_start_move,
    sqlJson(g.moves),
    g.is_generated ? "true" : "false",
    sqlStr(g.source),
  ].join(", ")
  return (
    `insert into engine_games (${cols})\n` +
    `values (${vals})\n` +
    `on conflict (id) do update set title=excluded.title, opening=excluded.opening, eco=excluded.eco, ` +
    `white=excluded.white, black=excluded.black, event=excluded.event, year=excluded.year, ` +
    `result=excluded.result, difficulty=excluded.difficulty, start_fen=excluded.start_fen, ` +
    `max_start_move=excluded.max_start_move, moves=excluded.moves, is_generated=excluded.is_generated, ` +
    `source=excluded.source;`
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  process.stderr.write(
    `Generating ${NUM_GAMES} DECISIVE games · solve depth ${SOLVE_DEPTH} (cap ${MOVETIME_CAP_MS}ms) ` +
      `vs opp depth ${OPP_DEPTH} skill ${OPP_SKILL} · adjudicate |eval|≥${(ADJUDICATE_CP / 100).toFixed(1)} ` +
      `for ${ADJUDICATE_PLIES} plies (early ${EARLY_ADJUDICATE_PLIES}) · ply cap ${PLY_CAP} · ` +
      `random window ${RANDOM_PLIES} (≤${MARGIN_CP}cp, MultiPV ${MULTIPV}) · up to ${DECISIVE_TRIES} re-rolls\n`,
  )
  await getEngine()

  const games = []
  const seen = new Set()
  const YEAR = new Date().getFullYear()

  let attempts = 0
  for (let i = 0; i < NUM_GAMES; i++) {
    const opening = OPENINGS[i % OPENINGS.length]
    const n = i + 1
    const id = `eng-med-${String(n).padStart(3, "0")}`
    // Alternate the intended solve side so the pool has both colors.
    const solveSide = i % 2 === 0 ? "white" : "black"
    const wantResult = solveSide === "white" ? "1-0" : "0-1"

    let res
    let tries = 0
    do {
      attempts++
      tries++
      const t0 = Date.now()
      res = await playGame(opening, `${n}/${NUM_GAMES}`, solveSide)
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      const key = res.moves.join(" ")
      const dup = seen.has(key)
      const decisive = res.result === wantResult
      if (dup || !decisive) {
        process.stderr.write(
          `  [${n}] retry ${tries}: ${dup ? "duplicate line" : `got ${res.result}, want ${wantResult} (${solveSide} solve)`}\n`,
        )
        if (tries < DECISIVE_TRIES) continue
        // Out of retries: keep the last game even if not the intended result.
      }
      if (!dup) seen.add(key)
      const how = res.adjudicated ? "adjudicated" : "mate"
      process.stderr.write(
        `✓ [${n}/${NUM_GAMES}] ${opening.name} [${solveSide} solve]: ${res.moves.length} plies, ${res.result} (${how})` +
          `${res.result === wantResult ? "" : " <<NOT DECISIVE"} in ${secs}s\n`,
      )
      break
    } while (tries < DECISIVE_TRIES)

    const winner = res.result === "1-0" ? "white" : res.result === "0-1" ? "black" : "draw"
    games.push({
      id,
      title: `Engine Game ${n}`,
      opening: opening.name,
      eco: opening.eco,
      white: "Engine",
      black: "Engine",
      event: "Engine Self-Play (medium)",
      year: YEAR,
      result: res.result,
      // App convention: "medium" strength → difficulty 3 (integer column).
      difficulty: 3,
      // Full game from the standard start, so start_fen is null and the SAN list
      // includes the book opening — matches the curated rows + opening detector.
      start_fen: null,
      max_start_move: null,
      moves: res.moves,
      is_generated: true,
      source: "generated",
      _meta: {
        solveSide,
        winner,
        adjudicated: res.adjudicated,
        ended: res.ended,
        bookLen: res.bookLen,
        finalFen: res.finalFen,
      },
    })
  }

  // Write inspectable JSON.
  const jsonPath = resolve(APP_DIR, "scripts/engine-games.generated.json")
  writeFileSync(jsonPath, JSON.stringify(games, null, 2) + "\n", "utf8")

  // Write the idempotent seed migration.
  const header =
    `-- ─── 20 DECISIVE engine self-play games (medium) for the Multiplayer pool ──\n` +
    `-- AUTO-GENERATED by scripts/generate-engine-games.mjs. Do not hand-edit.\n` +
    `-- Randomly-varied, NON-famous Stockfish self-play games (unique move lists),\n` +
    `-- each from a different sound book opening. The SOLVE side plays precise\n` +
    `-- best moves (depth ${SOLVE_DEPTH}, ~3s); the OPPONENT is weakened (depth ${OPP_DEPTH}, skill ${OPP_SKILL})\n` +
    `-- so every game is DECISIVE (real checkmate, or resign-adjudicated when the\n` +
    `-- solve side is ≥+${(ADJUDICATE_CP / 100).toFixed(1)} for ${ADJUDICATE_PLIES}+ plies). No draws.\n` +
    `-- "medium" strength → difficulty 3; stored as source='generated', is_generated=true\n` +
    `-- so they appear in the shared Multiplayer pool (lib/multiplayer/engine-games.ts).\n` +
    `-- Idempotent: re-running refreshes rows via on conflict (id) do update.\n\n`
  const body = games.map(rowSql).join("\n\n") + "\n"
  const sqlPath = resolve(APP_DIR, "supabase/migrations/005_engine_games_medium.sql")
  mkdirSync(dirname(sqlPath), { recursive: true })
  writeFileSync(sqlPath, header + body, "utf8")

  const dist = games.reduce(
    (m, g) => ((m[g._meta.winner] = (m[g._meta.winner] || 0) + 1), m),
    {},
  )
  const solveDist = games.reduce(
    (m, g) => ((m[g._meta.solveSide] = (m[g._meta.solveSide] || 0) + 1), m),
    {},
  )
  const adjudicated = games.filter((g) => g._meta.adjudicated).length
  process.stderr.write(
    `\nDone. ${games.length} unique games (${attempts} engine runs).\n` +
      `Result split: ${JSON.stringify(dist)} · solve-side split: ${JSON.stringify(solveDist)}\n` +
      `Finishes: ${games.length - adjudicated} real mates, ${adjudicated} adjudicated · draws: ${dist.draw || 0}\n` +
      `JSON  → ${jsonPath}\n` +
      `SQL   → ${sqlPath}\n`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
