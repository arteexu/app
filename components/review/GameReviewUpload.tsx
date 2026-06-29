"use client"
// components/review/GameReviewUpload.tsx
// Upload or paste a game (PGN, FEN-start PGN, or bare movetext) and run it
// through the exact same review + insights pipeline used for saved Play games:
// move-by-move replay (PlayGameReviewStepper) + uncapped notable-move insights
// with the click-to-practice motifs and the Standard/Deep depth selector
// (PlayGameInsights). Parsing reuses chess.js via parseGame().

import { useRef, useState } from "react"
import Link from "next/link"
import { parseGame, GameParseError, type ParsedGame } from "@/lib/insights/parse-game"
import { PlayGameReviewStepper } from "@/components/play/PlayGameReviewStepper"
import { PlayGameInsights } from "@/components/play/PlayGameInsights"

const SAMPLE_PGN = `[Event "Immortal Game"]
[Site "London"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`

export function GameReviewUpload() {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedGame | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setText(typeof reader.result === "string" ? reader.result : "")
    }
    reader.onerror = () => setError("Couldn't read that file. Try pasting the moves instead.")
    reader.readAsText(file)
  }

  function review() {
    setError(null)
    try {
      const result = parseGame(text)
      setParsed(result)
    } catch (e) {
      setParsed(null)
      setError(
        e instanceof GameParseError
          ? e.message
          : "Couldn't parse that game. Make sure it's valid PGN or a list of moves.",
      )
    }
  }

  function reset() {
    setParsed(null)
    setError(null)
    setText("")
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  if (parsed) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold text-gray-900 dark:text-slate-100 truncate">
                {parsed.title}
              </h1>
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">
                {parsed.resultLabel}
                {" · "}
                {Math.ceil(parsed.moves.length / 2)} moves
                {!parsed.fromStandardStart && " · custom start position"}
              </p>
            </div>
            <button
              onClick={reset}
              className="shrink-0 font-display font-bold text-sm px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 transition"
            >
              ↻ Review another
            </button>
          </div>
          {(parsed.headers.Event || parsed.headers.Date || parsed.headers.Site) && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {[parsed.headers.Event, parsed.headers.Site, parsed.headers.Date]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <PlayGameReviewStepper
          moves={parsed.moves}
          userColor="white"
          startFen={parsed.startFen}
        />

        <PlayGameInsights
          moves={parsed.moves}
          userColor="white"
          startFen={parsed.startFen}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="pgn-input"
            className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400"
          >
            Paste PGN or moves
          </label>
          <textarea
            id="pgn-input"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            rows={10}
            spellCheck={false}
            placeholder={'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 …\n\nor a full PGN with [Event "…"] tags.'}
            className="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 transition cursor-pointer">
            📎 Upload .pgn
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,.txt,text/plain"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {fileName && (
            <span className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[12rem]">
              {fileName}
            </span>
          )}
          <button
            onClick={() => {
              setText(SAMPLE_PGN)
              setFileName(null)
              setError(null)
            }}
            className="text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
          >
            Load a sample game
          </button>

          <button
            onClick={review}
            disabled={!text.trim()}
            className="ml-auto inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Review game →
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/30 p-5 text-sm text-gray-600 dark:text-slate-400 flex flex-col gap-2">
        <p className="font-bold text-gray-700 dark:text-slate-300">What you&apos;ll get</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Every notable move — mistakes, brilliancies, and instructive tactics (no fixed cap).</li>
          <li>Detected key concepts &amp; tactical patterns, plus tap-to-practice drills.</li>
          <li>
            A <span className="font-semibold">Standard / Deep</span> selector on the insights panel —
            Deep searches further and writes more coach notes (slower).
          </li>
        </ul>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Supports standard PGN, games starting from a custom{" "}
          <span className="font-mono">[FEN]</span>, and bare move lists. Analysis runs locally in
          your browser. Prefer one of your{" "}
          <Link href="/play/saved" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            saved games
          </Link>
          ?
        </p>
      </div>
    </div>
  )
}
