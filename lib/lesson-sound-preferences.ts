export const LESSON_SOUND_ENABLED_KEY = "chessmind-sound-enabled"
export const PUZZLE_SOLVED_PRESET_KEY = "chessmind-puzzle-solved-preset"
export const NEXT_STEP_PRESET_KEY = "chessmind-next-step-preset"

export type PuzzleSolvedPresetId = "classic" | "triumph" | "chime" | "sparkle" | "royal"
export type NextStepPresetId = "whoosh" | "slide" | "pop" | "forward" | "none"

export type LessonSoundCategory = "puzzleSolved" | "nextStep"

export interface SoundPresetOption<T extends string> {
  id: T
  label: string
  description: string
}

export const PUZZLE_SOLVED_PRESETS: SoundPresetOption<PuzzleSolvedPresetId>[] = [
  { id: "classic", label: "Classic", description: "Bright three-note fanfare" },
  { id: "triumph", label: "Triumph", description: "Rich ascending celebration with harmonics" },
  { id: "chime", label: "Chime", description: "Bell-like FM tone" },
  { id: "sparkle", label: "Sparkle", description: "Quick ascending sparkle" },
  { id: "royal", label: "Royal", description: "Deep, satisfying finish" },
]

export const NEXT_STEP_PRESETS: SoundPresetOption<NextStepPresetId>[] = [
  { id: "whoosh", label: "Whoosh", description: "Soft sweep downward" },
  { id: "slide", label: "Slide", description: "Gentle page-turn motion" },
  { id: "pop", label: "Pop", description: "Subtle click" },
  { id: "forward", label: "Forward", description: "Bright forward motion" },
  { id: "none", label: "None", description: "Silent — no sound on advance" },
]

const DEFAULT_PUZZLE_SOLVED: PuzzleSolvedPresetId = "triumph"
const DEFAULT_NEXT_STEP: NextStepPresetId = "slide"

const PUZZLE_SOLVED_IDS = new Set<string>(PUZZLE_SOLVED_PRESETS.map((p) => p.id))
const NEXT_STEP_IDS = new Set<string>(NEXT_STEP_PRESETS.map((p) => p.id))

export function getLessonSoundPreference(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(LESSON_SOUND_ENABLED_KEY) !== "false"
}

export function setLessonSoundPreference(enabled: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LESSON_SOUND_ENABLED_KEY, enabled ? "true" : "false")
}

export function getPuzzleSolvedPreset(): PuzzleSolvedPresetId {
  if (typeof window === "undefined") return DEFAULT_PUZZLE_SOLVED
  const stored = localStorage.getItem(PUZZLE_SOLVED_PRESET_KEY)
  if (stored && PUZZLE_SOLVED_IDS.has(stored)) return stored as PuzzleSolvedPresetId
  return DEFAULT_PUZZLE_SOLVED
}

export function setPuzzleSolvedPreset(id: PuzzleSolvedPresetId): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PUZZLE_SOLVED_PRESET_KEY, id)
}

export function getNextStepPreset(): NextStepPresetId {
  if (typeof window === "undefined") return DEFAULT_NEXT_STEP
  const stored = localStorage.getItem(NEXT_STEP_PRESET_KEY)
  if (stored && NEXT_STEP_IDS.has(stored)) return stored as NextStepPresetId
  return DEFAULT_NEXT_STEP
}

export function setNextStepPreset(id: NextStepPresetId): void {
  if (typeof window === "undefined") return
  localStorage.setItem(NEXT_STEP_PRESET_KEY, id)
}
