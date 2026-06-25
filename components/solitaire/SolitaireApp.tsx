"use client"
// components/solitaire/SolitaireApp.tsx
// Standalone Solitaire Chess experience as a three-phase state machine
// (setup → play → results) living on one route. Keeping it in a single client
// component means setup config, the played line, and results stay coherent —
// and avoids useSearchParams/Suspense prerender pitfalls.

import { useState } from "react"
import { LessonSoundProvider } from "@/hooks/useLessonSounds"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import type { MoveResult } from "@/lib/solitaire-scoring"
import { SolitaireSetupScreen } from "./SolitaireSetup"
import { SolitairePlay } from "./SolitairePlay"
import { SolitaireResults } from "./SolitaireResults"

type Phase = "setup" | "play" | "results"

export function SolitaireApp() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [setup, setSetup] = useState<SolitaireSetup | null>(null)
  const [results, setResults] = useState<MoveResult[] | null>(null)
  const [runKey, setRunKey] = useState(0)

  function startGame(next: SolitaireSetup) {
    setSetup(next)
    setResults(null)
    setRunKey((k) => k + 1)
    setPhase("play")
  }

  function finishGame(moveResults: MoveResult[]) {
    setResults(moveResults)
    setPhase("results")
  }

  function playAgain() {
    if (!setup) return setPhase("setup")
    setResults(null)
    setRunKey((k) => k + 1)
    setPhase("play")
  }

  function newGame() {
    setPhase("setup")
  }

  return (
    <LessonSoundProvider>
      {phase === "setup" && (
        <SolitaireSetupScreen initialSetup={setup} onStart={startGame} />
      )}
      {phase === "play" && setup && (
        <SolitairePlay key={runKey} setup={setup} onFinish={finishGame} onExit={newGame} />
      )}
      {phase === "results" && setup && results && (
        <SolitaireResults
          setup={setup}
          results={results}
          onPlayAgain={playAgain}
          onNewGame={newGame}
        />
      )}
    </LessonSoundProvider>
  )
}
