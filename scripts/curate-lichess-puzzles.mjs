// curate-lichess-puzzles.mjs
// ---------------------------------------------------------------------------
// Source high-quality chess puzzles from the Lichess open puzzle database and
// convert them into the app's lesson/course format (content/courses/*.json).
//
// SOURCE & LICENSE
//   Lichess open puzzle database — https://database.lichess.org/#puzzles
//   The database is released into the public domain under CC0 1.0. No
//   attribution is legally required, but we credit Lichess anyway (see the
//   course description and the generated ATTRIBUTION note).
//
// WHY A SCRIPT
//   The raw DB is ~300MB compressed / millions of puzzles and must NOT be
//   committed. This script STREAMS the compressed CSV, filters to a small,
//   high-quality, well-distributed curated subset, converts every puzzle into
//   the app's PuzzleStep schema (validating legality with chess.js), and writes
//   ONLY the curated course JSON. Re-run it to regenerate the curation.
//
// USAGE
//   cd app && node scripts/curate-lichess-puzzles.mjs               # stream the official DB
//   cd app && node scripts/curate-lichess-puzzles.mjs --csv path.csv  # use a local CSV (zst or plain)
//
// The official DB columns are:
//   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
// `Moves` is space-separated UCI. The FIRST move is the opponent's setup move;
// the solution the learner must find begins at the SECOND move. We apply the
// setup move to the FEN so the puzzle starts from the position to solve.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process"
import { createReadStream, existsSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Chess } from "chess.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, "..")

const DB_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"

// ── Quality filters ────────────────────────────────────────────────────────
// "High quality" = popular, well-played, and rating-stable puzzles.
const MIN_POPULARITY = 90      // out of 100 (community up/down vote score)
const MIN_NB_PLAYS = 1500      // sufficiently battle-tested
const MAX_RATING_DEVIATION = 80 // low deviation ⇒ rating is trustworthy
const MAX_SOLUTION_PLIES = 8   // keep puzzles digestible (≤ 4 learner moves)
const HARD_LINE_CAP = 6_000_000 // safety: never scan more than the whole DB

// ── Curation plan ──────────────────────────────────────────────────────────
// Each lesson targets one theme, pulling a spread across difficulty bands so a
// learner ramps up. Bands are [minRating, maxRating, countWanted].
const BANDS = [
  ["Beginner", 800, 1300, 4],
  ["Intermediate", 1300, 1700, 4],
  ["Advanced", 1700, 2100, 3],
  ["Expert", 2100, 2600, 3],
]

// Theme → lesson metadata. `mate` themes become "checkmate-in-n" puzzles.
const THEMES = [
  { theme: "fork", id: "fork", title: "Forks", icon: "♞",
    blurb: "One piece attacks two targets at once. Find the fork that wins material.",
    verb: "win material with a fork" },
  { theme: "pin", id: "pin", title: "Pins", icon: "♝",
    blurb: "A pinned piece cannot move without exposing a more valuable one behind it. Exploit the pin.",
    verb: "exploit the pin" },
  { theme: "skewer", id: "skewer", title: "Skewers", icon: "♜",
    blurb: "Attack a valuable piece so that when it moves, you win the piece behind it.",
    verb: "win material with a skewer" },
  { theme: "discoveredAttack", id: "discovered-attack", title: "Discovered Attacks", icon: "♗",
    blurb: "Move one piece to unveil an attack from the piece behind it.",
    verb: "unleash the discovered attack" },
  { theme: "hangingPiece", id: "hanging-piece", title: "Hanging Pieces", icon: "♟",
    blurb: "Spot the undefended piece and grab it.",
    verb: "win the hanging piece" },
  { theme: "deflection", id: "deflection", title: "Deflection", icon: "♛",
    blurb: "Force a defender away from the square or piece it is guarding.",
    verb: "deflect the defender" },
  { theme: "sacrifice", id: "sacrifice", title: "Sacrifices", icon: "⚡",
    blurb: "Give up material now to win more — or to mate — by force.",
    verb: "find the winning sacrifice" },
  { theme: "mateIn1", id: "mate-in-1", title: "Mate in One", icon: "♔", mate: 1,
    blurb: "Deliver checkmate in a single move.",
    verb: "deliver checkmate" },
  { theme: "mateIn2", id: "mate-in-2", title: "Mate in Two", icon: "♚", mate: 2,
    blurb: "Force checkmate in two moves. Calculate the opponent's only reply.",
    verb: "force checkmate in two" },
  { theme: "backRankMate", id: "back-rank-mate", title: "Back-Rank Mates", icon: "♖", mate: null,
    blurb: "Trap the king on its back rank behind its own pawns.",
    verb: "deliver the back-rank mate" },
]

const PER_THEME_TARGET = BANDS.reduce((s, b) => s + b[3], 0) // 14 per theme

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { csv: null }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--csv") out.csv = args[++i]
  }
  return out
}

// Robust enough CSV split for this dataset: only OpeningTags may contain spaces
// but never commas, and FEN/Moves never contain commas. A plain split is safe.
function splitCsv(line) {
  return line.split(",")
}

function uciToParts(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  }
}

// Apply the setup move and translate the remaining UCI solution into SAN.
// Returns { fen, orientation, sanMoves, setup } or null if anything is illegal.
function convertPuzzle(fen, uciMoves) {
  if (uciMoves.length < 2) return null
  const game = new Chess(fen)

  // 1) opponent's setup move
  const setupUci = uciMoves[0]
  let setupRes
  try {
    setupRes = game.move(uciToParts(setupUci))
  } catch {
    return null
  }
  if (!setupRes) return null

  const startFen = game.fen()
  const orientation = game.turn() === "w" ? "white" : "black"

  // 2) the solution, replayed move-by-move, captured as SAN
  const sanMoves = []
  for (let i = 1; i < uciMoves.length; i++) {
    let res
    try {
      res = game.move(uciToParts(uciMoves[i]))
    } catch {
      return null
    }
    if (!res) return null
    sanMoves.push(res.san)
  }

  // Sanity: a sound puzzle ends with the learner's move (odd-length solution),
  // i.e. the last move belongs to the learner, not the opponent.
  if (sanMoves.length % 2 === 0) return null
  if (sanMoves.length === 0) return null

  return {
    fen: startFen,
    orientation,
    sanMoves,
    setup: { fenBefore: fen, san: setupRes.san, from: setupRes.from, to: setupRes.to },
  }
}

// Independently re-validate a finished puzzle object end-to-end with a fresh
// chess.js instance — exactly how the app's PuzzleStep replays it.
function validatePuzzle(p) {
  const game = new Chess(p.fen)
  for (const san of p.solution.moves) {
    let res
    try {
      res = game.move(san)
    } catch {
      return false
    }
    if (!res) return false
  }
  // For mate puzzles, the line must actually end in checkmate.
  if (p._expectMate && !game.isCheckmate()) return false
  return true
}

function difficultyForRating(rating) {
  for (const [label, lo, hi] of BANDS) {
    if (rating >= lo && rating < hi) return label
  }
  return null
}

function ratingStars(rating) {
  if (rating < 1300) return "★☆☆☆"
  if (rating < 1700) return "★★☆☆"
  if (rating < 2100) return "★★★☆"
  return "★★★★"
}

function buildPuzzleStep(themeCfg, row, converted) {
  const { id: themeId, verb } = themeCfg
  const isMate = themeCfg.mate != null || themeCfg.theme.startsWith("mateIn") || themeCfg.theme === "backRankMate"
  const learnerMoves = Math.ceil(converted.sanMoves.length / 2)
  const sideLabel = converted.orientation === "white" ? "White" : "Black"

  let subType, question
  if (themeCfg.mate === 1) {
    subType = "checkmate-in-n"
    question = `${sideLabel} to move. Find checkmate in one.`
  } else if (themeCfg.mate === 2) {
    subType = "checkmate-in-n"
    question = `${sideLabel} to move. Force checkmate in two.`
  } else if (isMate) {
    subType = "checkmate-in-n"
    question = `${sideLabel} to move. Find the forced checkmate.`
  } else {
    subType = "best-move"
    const directive = verb.charAt(0).toUpperCase() + verb.slice(1)
    question = `${sideLabel} to move. ${directive}.`
  }

  const ratingTxt = `${ratingStars(row.rating)} · Lichess rating ${row.rating}`
  const explanation = isMate
    ? `Checkmate! The full forcing line is ${formatLine(converted.sanMoves)}. (${ratingTxt}, puzzle ${row.id}.)`
    : `The winning idea is ${formatLine(converted.sanMoves)}. (${ratingTxt}, puzzle ${row.id}.)`

  const step = {
    type: "puzzle",
    id: `p-${themeId}-${row.id}`,
    subType,
    question,
    fen: converted.fen,
    orientation: converted.orientation,
    solution: { moves: converted.sanMoves },
    preMovePosition: {
      fen: converted.setup.fenBefore,
      san: converted.setup.san,
      annotation: `The opponent just played ${converted.setup.san}. Now it's your turn — ${verb}.`,
      arrows: [{ from: converted.setup.from, to: converted.setup.to, color: "#ef4444" }],
      highlightSquares: { [converted.setup.to]: "rgba(239, 68, 68, 0.35)" },
    },
    successMessage: learnerMoves > 1
      ? `Solved in ${learnerMoves} moves — ${formatLine(converted.sanMoves)}!`
      : `Correct — ${converted.sanMoves[0]}!`,
    explanation,
    // internal hint for the validator (stripped before writing)
    _expectMate: isMate,
    _rating: row.rating,
  }
  return step
}

function formatLine(sanMoves) {
  // Render as "1. e4 e5 2. Nf3" style from the learner's first move.
  const parts = []
  for (let i = 0; i < sanMoves.length; i++) {
    if (i % 2 === 0) parts.push(`${Math.floor(i / 2) + 1}. ${sanMoves[i]}`)
    else parts[parts.length - 1] += ` ${sanMoves[i]}`
  }
  return parts.join(" ")
}

// ── Streaming pipeline ──────────────────────────────────────────────────────

const ignoreEpipe = (e) => {
  if (e && (e.code === "EPIPE" || e.code === "ECONNRESET")) return
  console.error("stream error:", e?.message ?? e)
}

// Returns { stream, cleanup }. `cleanup()` tears down any child processes and
// swallows the broken-pipe noise that results from stopping the stream early.
function openInput(csvArg) {
  if (csvArg) {
    if (!existsSync(csvArg)) throw new Error(`CSV not found: ${csvArg}`)
    if (csvArg.endsWith(".zst")) {
      const proc = spawn("zstd", ["-dc", csvArg], { stdio: ["ignore", "pipe", "inherit"] })
      proc.on("error", ignoreEpipe)
      proc.stdout.on("error", ignoreEpipe)
      return { stream: proc.stdout, cleanup: () => { try { proc.kill("SIGKILL") } catch {} } }
    }
    const rs = createReadStream(csvArg)
    return { stream: rs, cleanup: () => { try { rs.destroy() } catch {} } }
  }
  // Stream straight from the network through zstd's stdin.
  console.error(`Streaming ${DB_URL} …`)
  const curl = spawn("curl", ["-sL", DB_URL], { stdio: ["ignore", "pipe", "inherit"] })
  const zstd = spawn("zstd", ["-dc"], { stdio: ["pipe", "pipe", "inherit"] })
  // Swallow EPIPE on every hop of the pipeline (expected when we stop early).
  curl.on("error", ignoreEpipe)
  zstd.on("error", ignoreEpipe)
  curl.stdout.on("error", ignoreEpipe)
  zstd.stdin.on("error", ignoreEpipe)
  zstd.stdout.on("error", ignoreEpipe)
  curl.stdout.pipe(zstd.stdin)
  const cleanup = () => {
    try { curl.stdout.unpipe(zstd.stdin) } catch {}
    try { curl.kill("SIGKILL") } catch {}
    try { zstd.kill("SIGKILL") } catch {}
  }
  return { stream: zstd.stdout, cleanup }
}

async function main() {
  const { csv } = parseArgs()

  // buckets[themeId][bandLabel] = array of accepted puzzle steps
  const buckets = new Map()
  const seenIds = new Set()
  for (const t of THEMES) {
    const m = new Map()
    for (const [label] of BANDS) m.set(label, [])
    buckets.set(t.id, m)
  }

  const themeByName = new Map(THEMES.map((t) => [t.theme, t]))
  const bandTarget = new Map(BANDS.map((b) => [b[0], b[3]]))

  function bucketsFull() {
    for (const t of THEMES) {
      const m = buckets.get(t.id)
      for (const [label, lo, hi, want] of BANDS) {
        if (m.get(label).length < want) return false
      }
    }
    return true
  }

  const { stream: input, cleanup } = openInput(csv)
  const rl = createInterface({ input, crlfDelay: Infinity })

  let lineNo = 0
  let accepted = 0
  let scanned = 0
  let headerSkipped = false

  for await (const line of rl) {
    lineNo++
    if (lineNo > HARD_LINE_CAP) break
    if (!headerSkipped) { headerSkipped = true; if (line.startsWith("PuzzleId")) continue }
    if (!line) continue
    scanned++

    const cols = splitCsv(line)
    if (cols.length < 8) continue
    const [puzzleId, fen, movesStr, ratingStr, rdStr, popStr, npStr, themesStr] = cols

    const rating = parseInt(ratingStr, 10)
    const ratingDeviation = parseInt(rdStr, 10)
    const popularity = parseInt(popStr, 10)
    const nbPlays = parseInt(npStr, 10)
    if (!Number.isFinite(rating)) continue

    // Quality gate
    if (popularity < MIN_POPULARITY) continue
    if (nbPlays < MIN_NB_PLAYS) continue
    if (ratingDeviation > MAX_RATING_DEVIATION) continue

    const band = difficultyForRating(rating)
    if (!band) continue

    const themes = themesStr.split(" ")
    // Which of our curated themes does this puzzle belong to? (first match wins)
    let themeCfg = null
    for (const th of themes) {
      if (themeByName.has(th)) { themeCfg = themeByName.get(th); break }
    }
    if (!themeCfg) continue

    const m = buckets.get(themeCfg.id)
    if (m.get(band).length >= bandTarget.get(band)) continue // band already full
    if (seenIds.has(puzzleId)) continue

    const uciMoves = movesStr.split(" ")
    if (uciMoves.length - 1 > MAX_SOLUTION_PLIES) continue

    const converted = convertPuzzle(fen, uciMoves)
    if (!converted) continue

    const step = buildPuzzleStep(themeCfg, { id: puzzleId, rating }, converted)
    if (!validatePuzzle(step)) continue

    m.get(band).push(step)
    seenIds.add(puzzleId)
    accepted++

    if (accepted % 20 === 0) console.error(`  accepted ${accepted} (scanned ${scanned})…`)
    if (bucketsFull()) { console.error("All buckets full — stopping early."); break }
  }

  rl.close()
  cleanup()

  console.error(`\nScanned ${scanned} rows, accepted ${accepted} puzzles.`)

  // ── Assemble the course ───────────────────────────────────────────────────
  const tacticThemes = THEMES.filter((t) => !(t.mate != null || t.theme.startsWith("mateIn") || t.theme === "backRankMate"))
  const mateThemes = THEMES.filter((t) => t.mate != null || t.theme.startsWith("mateIn") || t.theme === "backRankMate")

  function lessonFor(t) {
    const m = buckets.get(t.id)
    // Order easy → hard across bands.
    const steps = []
    for (const [label] of BANDS) {
      const inBand = m.get(label).sort((a, b) => a._rating - b._rating)
      steps.push(...inBand)
    }
    if (steps.length === 0) return null

    const concept = {
      type: "concept",
      id: `c-${t.id}-intro`,
      title: t.title,
      body: `${t.blurb}\n\nEach puzzle below is a real position from the **Lichess** open puzzle database, ordered from easier to harder. The opponent has just moved — find the solution. Use the **← Black/White played** toggle to review the setup move, and **🔍 Analyze** to explore lines before committing.`,
    }

    // strip internal fields from steps
    const cleanSteps = steps.map(stripInternal)

    return {
      id: `l-tactics-${t.id}`,
      title: t.title,
      description: `${t.blurb} ${cleanSteps.length} curated Lichess puzzles, easy to hard.`,
      estimatedMinutes: Math.max(6, Math.round(cleanSteps.length * 1.5)),
      steps: [concept, ...cleanSteps],
    }
  }

  function stripInternal(step) {
    const { _expectMate, _rating, ...rest } = step
    return rest
  }

  const tacticLessons = tacticThemes.map(lessonFor).filter(Boolean)
  const mateLessons = mateThemes.map(lessonFor).filter(Boolean)

  const totalPuzzles = [...tacticLessons, ...mateLessons]
    .reduce((s, l) => s + l.steps.filter((st) => st.type === "puzzle").length, 0)

  const course = {
    id: "tactics-trainer",
    title: "Tactics Trainer",
    description:
      `Sharpen your tactical vision on ${totalPuzzles} hand-filtered puzzles from the ` +
      `Lichess open puzzle database (CC0 / public domain). Organized by motif — forks, ` +
      `pins, skewers, discovered attacks, sacrifices, and mating patterns — and ordered ` +
      `from beginner to expert.`,
    subject: "chess",
    chapters: [
      {
        id: "ch-tactical-motifs",
        title: "Tactical Motifs",
        description: "The core money-makers: forks, pins, skewers, discovered attacks, deflections, and sacrifices.",
        lessons: tacticLessons,
      },
      {
        id: "ch-mating-patterns",
        title: "Checkmating Patterns",
        description: "Convert your advantage into mate — mate in one, mate in two, and the back-rank mate.",
        lessons: mateLessons,
      },
    ],
  }

  const outPath = path.join(APP_DIR, "content", "courses", "tactics-trainer.json")
  await writeFile(outPath, JSON.stringify(course, null, 2) + "\n", "utf8")

  // Report per-theme counts
  console.error("\nPer-lesson puzzle counts:")
  for (const t of THEMES) {
    const l = [...tacticLessons, ...mateLessons].find((x) => x.id === `l-tactics-${t.id}`)
    const n = l ? l.steps.filter((s) => s.type === "puzzle").length : 0
    console.error(`  ${t.title.padEnd(22)} ${n}`)
  }
  console.error(`\nWrote ${totalPuzzles} puzzles → ${path.relative(APP_DIR, outPath)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
