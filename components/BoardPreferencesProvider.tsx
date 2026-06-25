"use client"

import { createContext, useCallback, useContext, useSyncExternalStore } from "react"
import { getShowLegalMoves, setShowLegalMoves as persistShowLegalMoves, getBoardSoundsEnabled, setBoardSoundsEnabled as persistBoardSounds } from "@/lib/board-preferences"

interface BoardPreferencesContextValue {
  showLegalMoves: boolean
  setShowLegalMoves: (enabled: boolean) => void
  boardSounds: boolean
  setBoardSounds: (enabled: boolean) => void
}

const BoardPreferencesContext = createContext<BoardPreferencesContextValue>({
  showLegalMoves: true,
  setShowLegalMoves: () => {},
  boardSounds: true,
  setBoardSounds: () => {},
})

let listeners: Array<() => void> = []

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

function emitChange() {
  for (const listener of listeners) listener()
}

export function BoardPreferencesProvider({ children }: { children: React.ReactNode }) {
  const showLegalMoves = useSyncExternalStore(subscribe, getShowLegalMoves, () => true)
  const boardSounds = useSyncExternalStore(subscribe, getBoardSoundsEnabled, () => true)

  const setShowLegalMoves = useCallback((enabled: boolean) => {
    persistShowLegalMoves(enabled)
    emitChange()
  }, [])

  const setBoardSounds = useCallback((enabled: boolean) => {
    persistBoardSounds(enabled)
    emitChange()
  }, [])

  return (
    <BoardPreferencesContext.Provider value={{ showLegalMoves, setShowLegalMoves, boardSounds, setBoardSounds }}>
      {children}
    </BoardPreferencesContext.Provider>
  )
}

export function useBoardPreferences() {
  return useContext(BoardPreferencesContext)
}
