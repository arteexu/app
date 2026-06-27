// lib/play/bot-levels.ts
// Labeled Stockfish strength presets for Play vs Bot. Strength is driven by UCI
// `Skill Level` (0–20) and, where the build honors it, `UCI_LimitStrength` +
// `UCI_Elo`. Weaker levels also think for less time so they blunder like a human
// at that rating instead of finding only-moves. `nominalElo` is what the bot is
// "worth" for the head-to-head Play-rating update.

import type { BotLevel } from "./types"

export const BOT_LEVELS: BotLevel[] = [
  {
    id: "beginner",
    label: "Beginner",
    blurb: "~800 · learning the ropes, makes frequent mistakes",
    skill: 0,
    uciElo: 800,
    moveTimeMs: 120,
    nominalElo: 800,
  },
  {
    id: "casual",
    label: "Casual",
    blurb: "~1100 · plays sensibly but misses tactics",
    skill: 3,
    uciElo: 1100,
    moveTimeMs: 180,
    nominalElo: 1100,
  },
  {
    id: "intermediate",
    label: "Intermediate",
    blurb: "~1500 · solid club-level opposition",
    skill: 7,
    uciElo: 1500,
    moveTimeMs: 300,
    nominalElo: 1500,
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "~1900 · sharp, punishes loose play",
    skill: 13,
    uciElo: 1900,
    moveTimeMs: 600,
    nominalElo: 1900,
  },
  {
    id: "master",
    label: "Master",
    blurb: "~2200 · very strong, near full engine strength",
    skill: 20,
    uciElo: 2200,
    moveTimeMs: 1000,
    nominalElo: 2200,
  },
]

export const DEFAULT_BOT_LEVEL = BOT_LEVELS[2] // Intermediate

export function botLevelById(id: string | null | undefined): BotLevel {
  return BOT_LEVELS.find((l) => l.id === id) ?? DEFAULT_BOT_LEVEL
}
