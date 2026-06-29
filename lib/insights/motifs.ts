// lib/insights/motifs.ts
// Catalog of detectable "insight motifs" — the tactical patterns and strategic
// concepts the post-game insights engine can flag from a single analyzed ply.
//
// This catalog is deliberately SEPARATE from the gamified TACTICAL_PATTERNS /
// KEY_CONCEPTS taxonomies (which are tied to lesson-unlock progression and the
// /tactical-patterns + /key-concepts browsers). Motifs here are detected purely
// from engine + chess.js signals on a ConceptRecord and power the click-to-
// practice flow, so adding to this list never affects unlock state or browsers.

export type InsightMotifKind = "tactic" | "concept"

export interface InsightMotif {
  id: InsightMotifId
  title: string
  description: string
  /** Distinct emoji shown on the chip. */
  icon: string
  kind: InsightMotifKind
  /** Short imperative used as the practice-drill prompt. */
  practicePrompt: string
}

// Keep in sync with INSIGHT_MOTIFS below.
export const INSIGHT_MOTIF_IDS = [
  // ── Tactics ────────────────────────────────────────────────────────────────
  "fork",
  "pin",
  "skewer",
  "discovered-attack",
  "double-attack",
  "hanging-piece",
  "removal-of-defender",
  "back-rank",
  "trapped-piece",
  "sacrifice",
  "taking-with-check",
  "mating-net",
  // ── Strategic / positional concepts ─────────────────────────────────────────
  "passed-pawn",
  "isolated-pawn",
  "doubled-pawn",
  "open-file",
  "outpost",
  "bishop-pair",
  "opposite-bishops",
  "exposed-king",
  "space-advantage",
] as const

export type InsightMotifId = (typeof INSIGHT_MOTIF_IDS)[number]

export const INSIGHT_MOTIFS: InsightMotif[] = [
  {
    id: "fork",
    title: "Fork",
    description: "One piece attacks two or more enemy targets at once, winning material.",
    icon: "🍴",
    kind: "tactic",
    practicePrompt: "Find the fork.",
  },
  {
    id: "pin",
    title: "Pin",
    description: "A piece is pinned to a more valuable piece (or the king) and cannot move off the line.",
    icon: "📌",
    kind: "tactic",
    practicePrompt: "Find the pinning move.",
  },
  {
    id: "skewer",
    title: "Skewer",
    description: "A valuable piece is attacked along a line; when it moves, the piece behind it is captured.",
    icon: "🍢",
    kind: "tactic",
    practicePrompt: "Find the skewer.",
  },
  {
    id: "discovered-attack",
    title: "Discovered Attack",
    description: "Moving one piece unveils an attack from a piece behind it.",
    icon: "🎯",
    kind: "tactic",
    practicePrompt: "Unleash the discovered attack.",
  },
  {
    id: "double-attack",
    title: "Double Attack",
    description: "Two enemy pieces come under attack from different attackers at the same time.",
    icon: "💥",
    kind: "tactic",
    practicePrompt: "Find the double attack.",
  },
  {
    id: "hanging-piece",
    title: "Loose Piece",
    description: "An undefended enemy piece is attacked and can be won for free.",
    icon: "🎁",
    kind: "tactic",
    practicePrompt: "Win the loose piece.",
  },
  {
    id: "removal-of-defender",
    title: "Removal of the Defender",
    description: "Capturing or deflecting a defender leaves another enemy piece hanging.",
    icon: "🧲",
    kind: "tactic",
    practicePrompt: "Remove the defender.",
  },
  {
    id: "back-rank",
    title: "Back-Rank Weakness",
    description: "The enemy king is boxed in on its back rank with no luft — a rook or queen exploits it.",
    icon: "🏰",
    kind: "tactic",
    practicePrompt: "Exploit the back rank.",
  },
  {
    id: "trapped-piece",
    title: "Trapped Piece",
    description: "An attacked enemy piece has no safe square to escape to.",
    icon: "🕸️",
    kind: "tactic",
    practicePrompt: "Trap the piece.",
  },
  {
    id: "sacrifice",
    title: "Sacrifice",
    description: "Giving up material to keep a winning attack or initiative.",
    icon: "💎",
    kind: "tactic",
    practicePrompt: "Find the sacrifice.",
  },
  {
    id: "taking-with-check",
    title: "Taking With Check",
    description: "Capture a piece and give check at the same time — the check must be answered first.",
    icon: "✅",
    kind: "tactic",
    practicePrompt: "Capture with check.",
  },
  {
    id: "mating-net",
    title: "Mating Net",
    description: "A forced sequence drives the enemy king into checkmate.",
    icon: "👑",
    kind: "tactic",
    practicePrompt: "Find the forced mate.",
  },
  {
    id: "passed-pawn",
    title: "Passed Pawn",
    description: "A pawn with no enemy pawns able to stop it from promoting.",
    icon: "🏃",
    kind: "concept",
    practicePrompt: "Find the best move with the passed pawn.",
  },
  {
    id: "isolated-pawn",
    title: "Isolated Pawn",
    description: "A pawn with no friendly pawns on adjacent files — a long-term weakness to target.",
    icon: "🏝️",
    kind: "concept",
    practicePrompt: "Find the best move in this structure.",
  },
  {
    id: "doubled-pawn",
    title: "Doubled Pawns",
    description: "Two pawns stacked on the same file — a structural weakness.",
    icon: "👯",
    kind: "concept",
    practicePrompt: "Find the best move in this structure.",
  },
  {
    id: "open-file",
    title: "Open File",
    description: "A rook lands on an open or semi-open file, seizing the line.",
    icon: "🚪",
    kind: "concept",
    practicePrompt: "Find the best move on the open file.",
  },
  {
    id: "outpost",
    title: "Outpost",
    description: "A knight reaches a protected square that no enemy pawn can challenge.",
    icon: "🛡️",
    kind: "concept",
    practicePrompt: "Find the best move with the outpost.",
  },
  {
    id: "bishop-pair",
    title: "Bishop Pair",
    description: "Holding both bishops while the opponent does not — strong in open positions.",
    icon: "⛪",
    kind: "concept",
    practicePrompt: "Find the best move.",
  },
  {
    id: "opposite-bishops",
    title: "Opposite-Colored Bishops",
    description: "Each side has one bishop on opposite colors — drawish in endgames, sharp with attacks.",
    icon: "🎭",
    kind: "concept",
    practicePrompt: "Find the best move.",
  },
  {
    id: "exposed-king",
    title: "Exposed King",
    description: "The enemy king has lost its pawn cover and is under pressure.",
    icon: "🚨",
    kind: "concept",
    practicePrompt: "Find the best move against the king.",
  },
  {
    id: "space-advantage",
    title: "Space Advantage",
    description: "Controlling significantly more territory, cramping the opponent's pieces.",
    icon: "🌌",
    kind: "concept",
    practicePrompt: "Find the best move.",
  },
]

const MOTIF_BY_ID = new Map(INSIGHT_MOTIFS.map((m) => [m.id, m]))

export function getInsightMotif(id: string): InsightMotif | undefined {
  return MOTIF_BY_ID.get(id as InsightMotifId)
}
