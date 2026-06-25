"use client"

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react"
import {
  isLessonSoundEnabled,
  playLessonSound,
  unlockLessonSounds,
  type LessonSoundName,
} from "@/lib/ui-sounds"

interface LessonSoundContextValue {
  play: (name: LessonSoundName) => void
  enabled: boolean
}

const LessonSoundContext = createContext<LessonSoundContextValue>({
  play: (name) => playLessonSound(name),
  enabled: true,
})

export function LessonSoundProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    function unlock() {
      unlockLessonSounds()
    }
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [])

  const play = useCallback((name: LessonSoundName) => {
    playLessonSound(name)
  }, [])

  return (
    <LessonSoundContext.Provider value={{ play, enabled: isLessonSoundEnabled() }}>
      {children}
    </LessonSoundContext.Provider>
  )
}

export function useLessonSounds() {
  return useContext(LessonSoundContext)
}

/** Fire a sound once when `active` becomes true. */
export function useSoundOnActive(active: boolean, name: LessonSoundName) {
  const { play } = useLessonSounds()
  useEffect(() => {
    if (active) play(name)
  }, [active, name, play])
}
