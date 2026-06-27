"use client"
// components/solitaire/SolitaireApp.tsx
// Standalone Solitaire Chess experience as a three-phase state machine
// (setup → play → results) living on one route. Keeping it in a single client
// component means setup config, the played line, and results stay coherent —
// and avoids useSearchParams/Suspense prerender pitfalls.

import { useState } from "react"
import { clsx } from "clsx"
import { LessonSoundProvider } from "@/hooks/useLessonSounds"
import type { SolitaireSetup } from "@/lib/solitaire/types"
import type { MoveResult } from "@/lib/solitaire-scoring"
import type { SharedGame, MatchAndGame } from "@/lib/multiplayer/types"
import { SolitaireSetupScreen } from "./SolitaireSetup"
import { SolitaireGenerate } from "./SolitaireGenerate"
import { SolitaireSaved } from "./SolitaireSaved"
import { SolitaireMultiplayer } from "./SolitaireMultiplayer"
import { SolitairePlay } from "./SolitairePlay"
import { SolitaireResults } from "./SolitaireResults"
import { SolitaireCompeteResults } from "./SolitaireCompeteResults"
import { SolitaireMatchResults } from "./SolitaireMatchResults"

type Phase = "setup" | "play" | "results"
type SetupTab = "master" | "generate" | "saved" | "multiplayer"

export function SolitaireApp({
  initialTab = "master",
  autoFindMatch = false,
}: {
  initialTab?: SetupTab
  autoFindMatch?: boolean
}) {
  const [phase, setPhase] = useState<Phase>("setup")
  const [setupTab, setSetupTab] = useState<SetupTab>(initialTab)
  const [setup, setSetup] = useState<SolitaireSetup | null>(null)
  const [results, setResults] = useState<MoveResult[] | null>(null)
  const [runKey, setRunKey] = useState(0)
  // When set, the current run is a casual competitive attempt on this shared
  // game; results route to the casual screen (rank + leaderboard, no Elo).
  const [competing, setCompeting] = useState<SharedGame | null>(null)
  // When set, the current run is a RANKED head-to-head match; results route to
  // the match screen (head-to-head Elo).
  const [matchCtx, setMatchCtx] = useState<MatchAndGame | null>(null)
  // True when the user resigned the current match → result screen records a loss.
  const [resigned, setResigned] = useState(false)
  // Remount key for the matchmaking screen; bumping it (with autoFind) re-runs a
  // search, e.g. after "Find another match".
  const [autoFindKey, setAutoFindKey] = useState(autoFindMatch ? 1 : 0)

  function startGame(next: SolitaireSetup) {
    setCompeting(null)
    setMatchCtx(null)
    setResigned(false)
    setSetup(next)
    setResults(null)
    setRunKey((k) => k + 1)
    setPhase("play")
  }

  function startCompetitive(next: SolitaireSetup, shared: SharedGame) {
    setCompeting(shared)
    setMatchCtx(null)
    setResigned(false)
    setSetup(next)
    setResults(null)
    setRunKey((k) => k + 1)
    setPhase("play")
  }

  function startMatch(next: SolitaireSetup, ctx: MatchAndGame) {
    setMatchCtx(ctx)
    setCompeting(null)
    setResigned(false)
    setSetup(next)
    setResults(null)
    setRunKey((k) => k + 1)
    setPhase("play")
  }

  // Resign the in-progress ranked match → jump to the result screen, which
  // records the forfeit loss + Elo. Results aren't needed (score is forfeited).
  function resignMatchNow() {
    setResigned(true)
    setResults([])
    setPhase("results")
  }

  function findAnotherMatch() {
    setMatchCtx(null)
    setResigned(false)
    setResults(null)
    setSetupTab("multiplayer")
    setAutoFindKey((k) => k + 1)
    setPhase("setup")
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
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex justify-center px-5 sm:px-8 pt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-2xl bg-gray-100 dark:bg-slate-800 p-1 w-full max-w-2xl">
              <TabButton
                label="🏆 Master games"
                active={setupTab === "master"}
                onClick={() => setSetupTab("master")}
              />
              <TabButton
                label="⚔️ Multiplayer"
                active={setupTab === "multiplayer"}
                onClick={() => setSetupTab("multiplayer")}
              />
              <TabButton
                label="🤖 Generate a game"
                active={setupTab === "generate"}
                onClick={() => setSetupTab("generate")}
              />
              <TabButton
                label="💾 Saved games"
                active={setupTab === "saved"}
                onClick={() => setSetupTab("saved")}
              />
            </div>
          </div>
          {setupTab === "master" ? (
            <SolitaireSetupScreen initialSetup={setup} onStart={startGame} />
          ) : setupTab === "multiplayer" ? (
            <SolitaireMultiplayer
              key={autoFindKey}
              onStartMatch={startMatch}
              onCompete={startCompetitive}
              autoFind={autoFindKey > 0}
            />
          ) : setupTab === "generate" ? (
            <SolitaireGenerate onStart={startGame} />
          ) : (
            <SolitaireSaved onStart={startGame} />
          )}
        </div>
      )}
      {phase === "play" && setup && (
        <SolitairePlay
          key={runKey}
          setup={setup}
          onFinish={finishGame}
          onExit={newGame}
          onResign={matchCtx ? resignMatchNow : undefined}
        />
      )}
      {phase === "results" && setup && results && (
        matchCtx ? (
          <SolitaireMatchResults
            setup={setup}
            match={matchCtx}
            results={results}
            forfeit={resigned}
            onFindAnother={findAnotherMatch}
            onExit={newGame}
          />
        ) : competing ? (
          <SolitaireCompeteResults
            setup={setup}
            shared={competing}
            results={results}
            onPlayAgain={playAgain}
            onNewGame={newGame}
          />
        ) : (
          <SolitaireResults
            setup={setup}
            results={results}
            onPlayAgain={playAgain}
            onNewGame={newGame}
          />
        )
      )}
    </LessonSoundProvider>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-xl py-2.5 text-sm font-bold transition",
        active
          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
          : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200",
      )}
    >
      {label}
    </button>
  )
}
