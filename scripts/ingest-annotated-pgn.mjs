#!/usr/bin/env node
// scripts/ingest-annotated-pgn.mjs
//
// Convert an annotated PGN into the AnnotatedGame JSON consumed by the
// "Annotated Master Games" feature (see lib/annotated/types.ts and the
// `annotated-pgn-to-lesson` skill).
//
// What it does:
//   1. Parses the PGN with @mliebelt/pgn-parser (robust comments / NAGs / variations).
//   2. Replays the main line with chess.js, validating every SAN and recording
//      the FEN after each ply.
//   3. Maps NAG codes ($1 → "!", $2 → "?", …) to display glyphs and cleans any
//      stray "$N" tokens left inside comment text.
//   4. Builds one level of sidelines (variations) per move, with their own FENs.
//   5. Merges an optional meta sidecar (id/title/description, header overrides,
//      and hand-authored conceptChecks) so re-running never clobbers authoring.
//
// Usage:
//   node scripts/ingest-annotated-pgn.mjs \
//     --pgn  content/annotated-games/sources/<id>.pgn \
//     --meta content/annotated-games/sources/<id>.meta.json \
//     --out  content/annotated-games/<id>.json
//
// --meta is optional. If omitted, the [id] is derived from the file name and
// headers come straight from the PGN with no concept checks.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { dirname, basename, resolve } from "node:path"
import { parseGame } from "@mliebelt/pgn-parser"
import { Chess } from "chess.js"

// ── NAG code → display glyph ────────────────────────────────────────────────
// https://en.wikipedia.org/wiki/Numeric_Annotation_Glyphs (common subset).
const NAG_TO_GLYPH = {
  $1: "!", $2: "?", $3: "!!", $4: "??", $5: "!?", $6: "?!",
  $7: "□", $10: "=", $11: "=", $12: "=", $13: "∞",
  $14: "⩲", $15: "⩱", $16: "±", $17: "∓", $18: "+−", $19: "−+",
  $20: "+−", $21: "−+", $22: "⨀", $23: "⨀",
  $36: "→", $40: "→", $132: "⇆", $133: "⇆",
}

function glyphForNag(code) {
  return NAG_TO_GLYPH[code] ?? code
}

function mapNags(nag) {
  if (!Array.isArray(nag) || nag.length === 0) return undefined
  const glyphs = nag.map(glyphForNag)
  return glyphs.length ? glyphs : undefined
}

// Replace stray "$N" tokens inside comment prose with their glyph and tidy up.
function cleanComment(...parts) {
  const text = parts.filter(Boolean).join(" ").trim()
  if (!text) return undefined
  const cleaned = text
    .replace(/\s*\$(\d+)/g, (_, n) => glyphForNag(`$${n}`))
    .replace(/\s{2,}/g, " ")
    .trim()
  return cleaned || undefined
}

function commentOf(move) {
  // @mliebelt/pgn-parser exposes commentMove (before move number),
  // commentBefore (before the move), and commentAfter (after the move).
  return cleanComment(move.commentMove, move.commentBefore, move.commentAfter)
}

function san(move) {
  return move?.notation?.notation
}

// A PGN tag can be a plain string or a structured object ({ value, year, ... }).
function tagStr(tag) {
  if (tag == null) return undefined
  if (typeof tag === "string") return tag
  if (typeof tag === "object" && typeof tag.value === "string") return tag.value
  return undefined
}

// ── Build one sideline (variation) from a branch FEN ────────────────────────
function buildVariation(varMoves, branchFen, startsAfterPly, warnings) {
  const chess = new Chess(branchFen)
  const moves = []
  let leadComment
  for (let i = 0; i < varMoves.length; i++) {
    const vm = varMoves[i]
    const s = san(vm)
    let result
    try {
      result = chess.move(s)
    } catch {
      warnings.push(`Illegal variation move "${s}" after ply ${startsAfterPly}; truncating sideline.`)
      break
    }
    if (vm.variations?.length) {
      warnings.push(`Nested sub-variation after "${s}" (ply ${startsAfterPly}) ignored (MVP supports one level).`)
    }
    const comment = commentOf(vm)
    if (i === 0 && vm.commentBefore) leadComment = cleanComment(vm.commentBefore)
    moves.push({
      san: result.san,
      fen: chess.fen(),
      ...(comment ? { comment } : {}),
      ...(mapNags(vm.nag) ? { nags: mapNags(vm.nag) } : {}),
    })
  }
  return moves.length ? { startsAfterPly, moves, ...(leadComment ? { comment: leadComment } : {}) } : null
}

// ── Main ingest ─────────────────────────────────────────────────────────────
function ingest({ pgnPath, metaPath, outPath }) {
  const pgnText = readFileSync(pgnPath, "utf8")
  const meta = metaPath && existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {}
  const warnings = []

  const parsed = parseGame(pgnText)
  const tags = parsed.tags ?? {}
  const overrides = meta.headerOverrides ?? {}

  const headers = {
    event: overrides.event ?? tagStr(tags.Event),
    site: overrides.site ?? tagStr(tags.Site),
    date: overrides.date ?? tagStr(tags.Date),
    round: overrides.round ?? tagStr(tags.Round),
    white: overrides.white ?? tagStr(tags.White) ?? "White",
    black: overrides.black ?? tagStr(tags.Black) ?? "Black",
    result: overrides.result ?? tagStr(tags.Result) ?? "*",
    eco: overrides.eco ?? tagStr(tags.ECO),
    annotator: overrides.annotator ?? tagStr(tags.Annotator),
    link: overrides.link ?? tagStr(tags.Link) ?? tagStr(tags.Source),
    year:
      overrides.year ??
      (() => {
        const d = tagStr(tags.Date) ?? ""
        const m = d.match(/^(\d{4})/)
        return m ? Number(m[1]) : null
      })(),
  }
  // Drop undefined keys for a clean JSON.
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k]

  const chess = new Chess()
  const plies = []

  parsed.moves.forEach((move, i) => {
    const ply = i + 1
    const fenBefore = chess.fen()
    const s = san(move)
    let result
    try {
      result = chess.move(s)
    } catch (err) {
      throw new Error(`Illegal main-line move #${ply} "${s}": ${err.message}`)
    }

    const variations = []
    for (const varLine of move.variations ?? []) {
      const v = buildVariation(varLine, fenBefore, i, warnings)
      if (v) variations.push(v)
    }

    plies.push({
      ply,
      moveNumber: Math.floor((ply - 1) / 2) + 1,
      side: ply % 2 === 1 ? "white" : "black",
      san: result.san,
      fen: chess.fen(),
      ...(mapNags(move.nag) ? { nags: mapNags(move.nag) } : {}),
      ...(commentOf(move) ? { comment: commentOf(move) } : {}),
      ...(variations.length ? { variations } : {}),
    })
  })

  // Cross-check PlyCount header if present.
  const declared = Number(tagStr(tags.PlyCount))
  if (Number.isFinite(declared) && declared !== plies.length) {
    warnings.push(`PlyCount header says ${declared} but parsed ${plies.length} plies.`)
  }

  // Validate concept-check plies reference real moves.
  const conceptChecks = meta.conceptChecks ?? []
  for (const cc of conceptChecks) {
    if (!plies.some((p) => p.ply === cc.ply)) {
      warnings.push(`Concept check "${cc.id}" targets ply ${cc.ply}, which is out of range (1..${plies.length}).`)
    }
  }

  const id = meta.id ?? basename(pgnPath).replace(/\.pgn$/i, "")
  const game = {
    id,
    title: meta.title ?? `${headers.white} vs ${headers.black}`,
    description: meta.description ?? "",
    headers,
    plies,
    ...(conceptChecks.length ? { conceptChecks } : {}),
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(game, null, 2) + "\n", "utf8")

  console.log(`✓ Wrote ${outPath}`)
  console.log(`  id: ${id}`)
  console.log(`  plies: ${plies.length}  (${headers.white} vs ${headers.black}, ${headers.result})`)
  console.log(`  variations: ${plies.reduce((n, p) => n + (p.variations?.length ?? 0), 0)}`)
  console.log(`  concept checks: ${conceptChecks.length}${conceptChecks.length ? " @ plies " + conceptChecks.map((c) => c.ply).join(", ") : ""}`)
  if (warnings.length) {
    console.log("  warnings:")
    for (const w of warnings) console.log("   - " + w)
  } else {
    console.log("  warnings: none")
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--pgn") args.pgnPath = argv[++i]
    else if (a === "--meta") args.metaPath = argv[++i]
    else if (a === "--out") args.outPath = argv[++i]
  }
  return args
}

const argv = process.argv.slice(2)
const args = parseArgs(argv)
if (!args.pgnPath || !args.outPath) {
  console.error(
    "Usage: node scripts/ingest-annotated-pgn.mjs --pgn <in.pgn> [--meta <meta.json>] --out <out.json>"
  )
  process.exit(1)
}
ingest({
  pgnPath: resolve(args.pgnPath),
  metaPath: args.metaPath ? resolve(args.metaPath) : undefined,
  outPath: resolve(args.outPath),
})
