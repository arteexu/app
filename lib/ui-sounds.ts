/**
 * ChessMind UI sounds — Web Audio API.
 * Lesson celebration sounds are synthesized (no external assets) and respect
 * prefers-reduced-motion. Board move/capture/check/castle/promote/game-end use
 * custom audio files from /public/sounds (with a synth fallback) and are
 * functional feedback gated only by their own toggle.
 */

import type { Chess, Move } from "chess.js"
import { getBoardSoundsEnabled } from "@/lib/board-preferences"
import {
  getLessonSoundPreference,
  getNextStepPreset,
  getPuzzleSolvedPreset,
  setLessonSoundPreference,
  type LessonSoundCategory,
  type NextStepPresetId,
  type PuzzleSolvedPresetId,
} from "@/lib/lesson-sound-preferences"

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  if (audioCtx.state === "suspended") void audioCtx.resume()
  return audioCtx
}

export function isLessonSoundEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false
  return getLessonSoundPreference()
}

export function setLessonSoundEnabled(enabled: boolean) {
  setLessonSoundPreference(enabled)
}

function canPlay(): boolean {
  return isLessonSoundEnabled() && getAudioContext() !== null
}

/** Warm up audio after a user gesture (first tap / move). */
export function unlockLessonSounds() {
  getAudioContext()
  preloadBoardSounds()
}

type SoundFn = () => void

function playIfEnabled(fn: SoundFn) {
  if (!canPlay()) return
  try { fn() } catch { /* ignore autoplay / context errors */ }
}

/** Short pop — correct move in a multi-move line. */
export function playCorrectMove() {
  playIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.06)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.1)
  })
}

/** Two-note success — correct answer on a step. */
export function playCorrect() {
  playIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const baseFreq = 523
    const interval = 1.25
    const noteDuration = 0.1
    const gap = 0.06
    const volume = 0.22

    ;[0, 1].forEach(i => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = now + i * (noteDuration + gap)
      osc.type = "sine"
      osc.frequency.value = baseFreq * Math.pow(interval, i)
      gain.gain.setValueAtTime(volume, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + noteDuration + 0.01)
    })
  })
}

/** Gentle wrong-answer tone — not harsh for kids. */
export function playWrong() {
  playIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(350, now)
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.18)
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.22)
  })
}

// ── Puzzle solved presets (stepComplete) ───────────────────────────────────

function playPuzzleSolvedClassic(ctx: AudioContext, now: number) {
  const freqs = [523, 659, 784]
  const noteDuration = 0.11
  const gap = 0.05
  const volume = 0.24

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = now + i * (noteDuration + gap)
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.04)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + noteDuration + 0.06)
  })
}

function playPuzzleSolvedTriumph(ctx: AudioContext, now: number) {
  const freqs = [392, 494, 587, 784]
  const noteDuration = 0.12
  const gap = 0.04
  const volume = 0.18

  freqs.forEach((freq, i) => {
    const start = now + i * (noteDuration + gap)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.05)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + noteDuration + 0.08)

    const harmonic = ctx.createOscillator()
    const hGain = ctx.createGain()
    harmonic.type = "triangle"
    harmonic.frequency.value = freq * 2
    hGain.gain.setValueAtTime(volume * 0.35, start)
    hGain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.03)
    harmonic.connect(hGain)
    hGain.connect(ctx.destination)
    harmonic.start(start)
    harmonic.stop(start + noteDuration + 0.05)
  })
}

function playPuzzleSolvedChime(ctx: AudioContext, now: number) {
  const frequency = 660
  const modRatio = 2.5
  const modDepth = 800
  const duration = 0.4
  const volume = 0.22

  const mod = ctx.createOscillator()
  const modGain = ctx.createGain()
  mod.frequency.value = frequency * modRatio
  modGain.gain.setValueAtTime(modDepth, now)
  modGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7)

  const carrier = ctx.createOscillator()
  const cGain = ctx.createGain()
  carrier.frequency.value = frequency
  cGain.gain.setValueAtTime(volume, now)
  cGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  mod.connect(modGain)
  modGain.connect(carrier.frequency)
  carrier.connect(cGain)
  cGain.connect(ctx.destination)
  mod.start(now)
  carrier.start(now)
  mod.stop(now + duration + 0.01)
  carrier.stop(now + duration + 0.01)
}

function playPuzzleSolvedSparkle(ctx: AudioContext, now: number) {
  const freqs = [880, 1047, 1319, 1568]
  const noteDuration = 0.06
  const gap = 0.02
  const volume = 0.15

  freqs.forEach((freq, i) => {
    const start = now + i * (noteDuration + gap)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.1, start + noteDuration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.02)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + noteDuration + 0.04)
  })
}

function playPuzzleSolvedRoyal(ctx: AudioContext, now: number) {
  const freqs = [262, 330, 392, 523]
  const noteDuration = 0.14
  const gap = 0.06
  const volume = 0.26

  freqs.forEach((freq, i) => {
    const start = now + i * (noteDuration + gap)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + noteDuration + 0.1)
  })
}

function playPuzzleSolvedPreset(presetId: PuzzleSolvedPresetId) {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  switch (presetId) {
    case "classic": playPuzzleSolvedClassic(ctx, now); break
    case "triumph": playPuzzleSolvedTriumph(ctx, now); break
    case "chime": playPuzzleSolvedChime(ctx, now); break
    case "sparkle": playPuzzleSolvedSparkle(ctx, now); break
    case "royal": playPuzzleSolvedRoyal(ctx, now); break
  }
}

/** Triumphant fanfare — puzzle solved / SolveReward (preset from preferences). */
export function playStepComplete() {
  playIfEnabled(() => playPuzzleSolvedPreset(getPuzzleSolvedPreset()))
}

// ── Next step presets (stepAdvance) ─────────────────────────────────────────

function playNextStepWhoosh(ctx: AudioContext, now: number) {
  const duration = 0.18
  const bufferSize = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.setValueAtTime(1200, now)
  filter.frequency.exponentialRampToValueAtTime(300, now + duration)
  filter.Q.value = 0.8
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
  src.stop(now + duration + 0.01)
}

function playNextStepSlide(ctx: AudioContext, now: number) {
  const duration = 0.12
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(280, now + duration)
  gain.gain.setValueAtTime(0.1, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.02)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.03)

  const bufferSize = Math.floor(ctx.sampleRate * duration * 0.8)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * 0.3
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = "highpass"
  filter.frequency.value = 2000
  const nGain = ctx.createGain()
  nGain.gain.setValueAtTime(0.06, now)
  nGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  src.connect(filter)
  filter.connect(nGain)
  nGain.connect(ctx.destination)
  src.start(now)
  src.stop(now + duration + 0.01)
}

function playNextStepPop(ctx: AudioContext, now: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04)
  gain.gain.setValueAtTime(0.14, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.07)
}

function playNextStepForward(ctx: AudioContext, now: number) {
  const freqs = [440, 554]
  const noteDuration = 0.07
  const gap = 0.03
  const volume = 0.12

  freqs.forEach((freq, i) => {
    const start = now + i * (noteDuration + gap)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration + 0.02)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + noteDuration + 0.04)
  })
}

function playNextStepPreset(presetId: NextStepPresetId) {
  if (presetId === "none") return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  switch (presetId) {
    case "whoosh": playNextStepWhoosh(ctx, now); break
    case "slide": playNextStepSlide(ctx, now); break
    case "pop": playNextStepPop(ctx, now); break
    case "forward": playNextStepForward(ctx, now); break
  }
}

/** Transition sound when advancing to the next step (preset from preferences). */
export function playStepAdvance() {
  const preset = getNextStepPreset()
  if (preset === "none") return
  playIfEnabled(() => playNextStepPreset(preset))
}

/** Preview a lesson sound preset in settings — always plays on button click. */
export function previewLessonSound(category: LessonSoundCategory, presetId: string) {
  unlockLessonSounds()
  try {
    if (category === "puzzleSolved") {
      playPuzzleSolvedPreset(presetId as PuzzleSolvedPresetId)
    } else {
      playNextStepPreset(presetId as NextStepPresetId)
    }
  } catch { /* ignore autoplay / context errors */ }
}

/** Bell + ascending finish — lesson complete screen. */
export function playLessonComplete() {
  playIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const frequency = 880
    const modRatio = 1.4
    const modDepth = 1200
    const duration = 0.35
    const volume = 0.2

    const mod = ctx.createOscillator()
    const modGain = ctx.createGain()
    mod.frequency.value = frequency * modRatio
    modGain.gain.setValueAtTime(modDepth, now)
    modGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.75)

    const carrier = ctx.createOscillator()
    const cGain = ctx.createGain()
    carrier.frequency.value = frequency
    cGain.gain.setValueAtTime(volume, now)
    cGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    mod.connect(modGain)
    modGain.connect(carrier.frequency)
    carrier.connect(cGain)
    cGain.connect(ctx.destination)
    mod.start(now)
    carrier.start(now)
    mod.stop(now + duration + 0.01)
    carrier.stop(now + duration + 0.01)

    // Short victory tag after bell — uses current puzzle-solved preset
    setTimeout(() => {
      if (!canPlay()) return
      playPuzzleSolvedPreset(getPuzzleSolvedPreset())
    }, 280)
  })
}

/** Sparkle for combo streaks (2+). */
export function playCombo() {
  playIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(1047, now)
    osc.frequency.exponentialRampToValueAtTime(1319, now + 0.08)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.12)
  })
}

export type LessonSoundName =
  | "correctMove"
  | "correct"
  | "wrong"
  | "stepComplete"
  | "stepAdvance"
  | "lessonComplete"
  | "combo"

export function playLessonSound(name: LessonSoundName) {
  switch (name) {
    case "correctMove": playCorrectMove(); break
    case "correct": playCorrect(); break
    case "wrong": playWrong(); break
    case "stepComplete": playStepComplete(); break
    case "stepAdvance": playStepAdvance(); break
    case "lessonComplete": playLessonComplete(); break
    case "combo": playCombo(); break
  }
}

// ── Board move sounds (chess.com-style; routed through a limiter bus) ────────

export function isBoardSoundEnabled(): boolean {
  return getBoardSoundsEnabled() && getAudioContext() !== null
}

// Shared limiter on the board-sound bus. Board tones are louder than lesson
// feedback and can briefly overlap (e.g. move + check), so route them through a
// gentle compressor acting as a limiter to keep peaks well below clipping.
let boardLimiter: DynamicsCompressorNode | null = null

function getBoardOutput(ctx: AudioContext): AudioNode {
  if (!boardLimiter) {
    const comp = ctx.createDynamicsCompressor()
    const t = ctx.currentTime
    // Gentle safety limiter: single sounds (synth ≤ 0.30, files ≈ 0.9) pass
    // essentially untouched and stay loud; only rare overlaps (e.g. the mating
    // move + game-end flourish) get caught so the bus never clips past ~1.0.
    comp.threshold.setValueAtTime(-1, t)
    comp.knee.setValueAtTime(3, t)
    comp.ratio.setValueAtTime(8, t)
    comp.attack.setValueAtTime(0.003, t)
    comp.release.setValueAtTime(0.15, t)
    comp.connect(ctx.destination)
    boardLimiter = comp
  }
  return boardLimiter
}

function playBoardIfEnabled(fn: SoundFn) {
  if (!isBoardSoundEnabled()) return
  try { fn() } catch { /* ignore */ }
}

/** Soft wood tap — normal piece move. */
function playBoardMoveTone() {
  playBoardIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const duration = 0.045
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18))
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = 920
    filter.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(getBoardOutput(ctx))
    src.start(now)
    src.stop(now + duration + 0.01)
  })
}

/** Heavier thud — captures. */
function playBoardCaptureTone() {
  playBoardIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const duration = 0.065
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22))
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = 520
    filter.Q.value = 0.9
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.30, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(getBoardOutput(ctx))
    src.start(now)
    src.stop(now + duration + 0.01)
  })
}

/** Castling — slightly longer wood slide. */
function playBoardCastleTone() {
  playBoardIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const duration = 0.07
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35))
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = 700
    filter.Q.value = 1.0
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(getBoardOutput(ctx))
    src.start(now)
    src.stop(now + duration + 0.01)
  })
}

/** Promotion — soft ascending chirp. */
function playBoardPromoteTone() {
  playBoardIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.09)
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(getBoardOutput(ctx))
    osc.start(now)
    osc.stop(now + 0.11)
  })
}

/** Check alert — plays after move/capture tone. */
function playBoardCheckTone() {
  playBoardIfEnabled(() => {
    const ctx = getAudioContext()!
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(587, now)
    osc.frequency.setValueAtTime(740, now + 0.04)
    gain.gain.setValueAtTime(0.20, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.connect(gain)
    gain.connect(getBoardOutput(ctx))
    osc.start(now)
    osc.stop(now + 0.13)
  })
}

// ── Custom audio files (served from /public/sounds) ─────────────────────────
// These REPLACE the synthesized tones above; the synth functions remain as a
// graceful fallback when a file fails to fetch/decode (e.g. webm unsupported).

const BOARD_SOUND_FILES = {
  move:    "/sounds/move-self.mp3",
  capture: "/sounds/capture.mp3",
  check:   "/sounds/move-check.mp3",
  castle:  "/sounds/castle.mp3",
  promote: "/sounds/promote.mp3",
  gameEnd: "/sounds/game-end.webm",
} as const

type BoardSoundKey = keyof typeof BOARD_SOUND_FILES

const boardBuffers: Partial<Record<BoardSoundKey, AudioBuffer>> = {}
const boardLoading: Partial<Record<BoardSoundKey, Promise<AudioBuffer | null>>> = {}
const boardLoadFailed: Partial<Record<BoardSoundKey, boolean>> = {}

// Strong-but-safe playback levels; the shared limiter keeps overlaps < clipping.
const BOARD_FILE_GAIN = 0.9
const BOARD_GAME_END_GAIN = 0.8

function loadBoardBuffer(ctx: AudioContext, key: BoardSoundKey): Promise<AudioBuffer | null> {
  const cached = boardBuffers[key]
  if (cached) return Promise.resolve(cached)
  if (boardLoadFailed[key]) return Promise.resolve(null)
  const inflight = boardLoading[key]
  if (inflight) return inflight
  const load = (async () => {
    try {
      const res = await fetch(BOARD_SOUND_FILES[key])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const arr = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(arr)
      boardBuffers[key] = buf
      return buf
    } catch {
      boardLoadFailed[key] = true // remember failure → use synth fallback
      return null
    } finally {
      boardLoading[key] = undefined
    }
  })()
  boardLoading[key] = load
  return load
}

/** Preload + decode all board audio files once the context exists (first gesture). */
export function preloadBoardSounds() {
  const ctx = getAudioContext()
  if (!ctx) return
  for (const key of Object.keys(BOARD_SOUND_FILES) as BoardSoundKey[]) {
    if (!boardBuffers[key] && !boardLoadFailed[key]) void loadBoardBuffer(ctx, key)
  }
}

/**
 * Play a decoded board audio file through the shared limiter bus. If the buffer
 * isn't ready yet or the file failed to load, run the synth `fallback` so a
 * sound always plays.
 */
function playBoardFile(key: BoardSoundKey, gainValue: number, fallback?: SoundFn) {
  const ctx = getAudioContext()
  if (!ctx) { fallback?.(); return }
  const buf = boardBuffers[key]
  if (!buf) {
    if (!boardLoadFailed[key]) void loadBoardBuffer(ctx, key)
    fallback?.()
    return
  }
  try {
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.value = gainValue
    src.connect(gain)
    gain.connect(getBoardOutput(ctx))
    src.start()
  } catch {
    fallback?.()
  }
}

/** Game-over flourish — checkmate / stalemate / draw on the board. */
export function playBoardGameEnd() {
  if (!isBoardSoundEnabled()) return
  playBoardFile("gameEnd", BOARD_GAME_END_GAIN) // no synth equivalent → silent on failure
}

/** Play chess.com-style board sounds for a completed move (custom audio files). */
export function playBoardMoveSound(move: Move, gameAfterMove: Chess) {
  if (!isBoardSoundEnabled()) return

  const flags = move.flags
  const isCastle = flags.includes("k") || flags.includes("q")
  const isPromote = !!move.promotion || flags.includes("p")
  const isCapture = !!move.captured || flags.includes("c") || flags.includes("e")
  const isCheck = gameAfterMove.inCheck()

  if (isCastle) playBoardFile("castle", BOARD_FILE_GAIN, playBoardCastleTone)
  else if (isPromote) playBoardFile("promote", BOARD_FILE_GAIN, playBoardPromoteTone)
  else if (isCheck) playBoardFile("check", BOARD_FILE_GAIN, () => { playBoardMoveTone(); playBoardCheckTone() })
  else if (isCapture) playBoardFile("capture", BOARD_FILE_GAIN, playBoardCaptureTone)
  else playBoardFile("move", BOARD_FILE_GAIN, playBoardMoveTone)

  // Game-over flourish, layered shortly after the concluding move.
  if (gameAfterMove.isGameOver()) {
    setTimeout(() => playBoardGameEnd(), 150)
  }
}
