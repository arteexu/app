"use client"
// app/commentary-eval/page.tsx
// Hidden internal QA page (not linked in nav) for vetting commentary quality.
// Runs the full pipeline client-side: engine analysis (before/after) →
// ConceptRecord → POST /api/commentary, and shows ALL grounding facts so a
// strong player (FM) can judge correctness.

import { useEffect, useMemo, useState } from "react"
import { Chess } from "chess.js"
import { Chessboard } from "react-chessboard"
import { generateCoachComment } from "@/lib/commentary/client"
import { prioritizeSignals, type Signal } from "@/lib/commentary/prioritize"
import type { CommentaryResponse, ConceptRecord } from "@/lib/commentary/types"
import { COMMENTARY_RIGOROUS_DEPTH, COMMENTARY_MULTIPV } from "@/lib/commentary/config"
import { sideToMove } from "@/lib/engine/format"
import { buildLastMoveStyles } from "@/lib/legal-move-highlights"
import { FlipBoardButton } from "@/components/solitaire/FlipBoardButton"

// ── Labeling flywheel: persisted to localStorage; exportable as JSONL. ────────
const LABELS_KEY = "chessmind-commentary-labels"

interface CommentaryLabel {
  conceptRecord: ConceptRecord
  generated: string
  fmEdited: string
  verdict: "up" | "down" | null
  flaggedLines: string[]
  mode: "rigorous"
  createdAt: string
}

function loadLabels(): CommentaryLabel[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(LABELS_KEY)
    return raw ? (JSON.parse(raw) as CommentaryLabel[]) : []
  } catch {
    return []
  }
}

function saveLabels(labels: CommentaryLabel[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LABELS_KEY, JSON.stringify(labels))
}

interface TestCase {
  label: string
  theme: string
  fen: string
  move: string
}

// Built-in cases (engine decides the true classification; themes are a guide).
const TEST_CASES: TestCase[] = [
  { label: "Back-rank mate", theme: "checkmate", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", move: "Ra8#" },
  { label: "Knight royal fork", theme: "fork", fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", move: "Nc7+" },
  { label: "Hanging-queen blunder", theme: "blunder", fen: "b3k3/8/8/8/8/8/4Q3/4K3 w - - 0 1", move: "Qe4" },
  { label: "Quiet positional (castle)", theme: "positional", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6", move: "O-O" },
  { label: "Endgame king march", theme: "endgame", fen: "8/5k2/8/4K3/4P3/8/8/8 w - - 0 1", move: "Kd5" },
  { label: "Tactical knight jump", theme: "tactic", fen: "r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", move: "Ng5" },
  { label: "Fool's mate (Black)", theme: "mate", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", move: "Qh4#" },
]

const RATINGS = [
  { label: "Beginner (~800)", value: 800 },
  { label: "Intermediate (~1300)", value: 1300 },
  { label: "Advanced (~2000)", value: 2000 },
]

export default function CommentaryEvalPage() {
  const [fen, setFen] = useState(TEST_CASES[1].fen)
  const [move, setMove] = useState(TEST_CASES[1].move)
  const [rating, setRating] = useState<number>(1300)
  const [mistakes, setMistakes] = useState("")
  const [exemplarsText, setExemplarsText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<CommentaryResponse | null>(null)
  const [record, setRecord] = useState<ConceptRecord | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [orientation, setOrientation] = useState<"white" | "black">("white")

  const [serverAnalysis, setServerAnalysis] = useState(true)

  // Labeling state.
  const [verdict, setVerdict] = useState<"up" | "down" | null>(null)
  const [edited, setEdited] = useState("")
  const [flaggedInput, setFlaggedInput] = useState("")
  const [flaggedLines, setFlaggedLines] = useState<string[]>([])
  const [labelCount, setLabelCount] = useState(0)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  useEffect(() => {
    setLabelCount(loadLabels().length)
  }, [])

  // Live preview of the position(s) from the current inputs — renders before a
  // run and updates on every FEN/move change so the FM can confirm the position.
  const preview = useMemo(() => {
    const trimmedFen = fen.trim()
    if (!trimmedFen) return { valid: false as const }
    let chess: Chess
    try {
      chess = new Chess(trimmedFen)
    } catch {
      return { valid: false as const }
    }
    const before = chess.fen()
    const stm: "white" | "black" = sideToMove(before) === "b" ? "black" : "white"
    let after: string | null = null
    let from: string | null = null
    let to: string | null = null
    let moveError: string | null = null
    const trimmedMove = move.trim()
    if (trimmedMove) {
      try {
        const mv = chess.move(trimmedMove)
        if (mv) {
          after = chess.fen()
          from = mv.from
          to = mv.to
        } else {
          moveError = "illegal move for this position"
        }
      } catch {
        moveError = "illegal move for this position"
      }
    }
    return { valid: true as const, before, after, from, to, stm, moveError }
  }, [fen, move])

  // Auto-orient to the side to move whenever the position changes.
  useEffect(() => {
    if (preview.valid) setOrientation(preview.stm)
  }, [preview.valid, preview.valid ? preview.stm : null])

  function resetOutputs() {
    setResponse(null)
    setRecord(null)
    setSignals([])
    setVerdict(null)
    setEdited("")
    setFlaggedInput("")
    setFlaggedLines([])
    setSavedNote(null)
  }

  function loadCase(tc: TestCase) {
    setFen(tc.fen)
    setMove(tc.move)
    resetOutputs()
    setError(null)
  }

  async function run() {
    setLoading(true)
    setError(null)
    resetOutputs()
    try {
      const recurringMistakes = mistakes.trim() ? mistakes.split(",").map((m) => m.trim()).filter(Boolean) : undefined
      // Exemplars: blank-line separated blocks (fall back to per-line).
      const exemplars = exemplarsText.trim()
        ? exemplarsText.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
        : undefined
      const { response: resp, record: rec } = await generateCoachComment(
        { fenBefore: fen.trim(), moveSan: move.trim(), userRating: rating, recurringMistakes, exemplars },
        { rigorous: true, serverAnalysis, depth: COMMENTARY_RIGOROUS_DEPTH, multiPv: COMMENTARY_MULTIPV },
      )
      setResponse(resp)
      setRecord(rec)
      if (rec) setSignals(prioritizeSignals(rec))
      setEdited(resp.comment)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline failed")
    } finally {
      setLoading(false)
    }
  }

  function addFlaggedLine() {
    const v = flaggedInput.trim()
    if (!v) return
    setFlaggedLines((prev) => [...prev, v])
    setFlaggedInput("")
  }

  function saveLabel() {
    if (!record || !response) return
    const label: CommentaryLabel = {
      conceptRecord: record,
      generated: response.comment,
      fmEdited: edited.trim() || response.comment,
      verdict,
      flaggedLines,
      mode: "rigorous",
      createdAt: new Date().toISOString(),
    }
    const labels = [...loadLabels(), label]
    saveLabels(labels)
    setLabelCount(labels.length)
    setSavedNote(`Saved. ${labels.length} label(s) stored locally.`)
  }

  function downloadJsonl() {
    const labels = loadLabels()
    if (labels.length === 0) {
      setSavedNote("No labels to export yet.")
      return
    }
    const jsonl = labels.map((l) => JSON.stringify(l)).join("\n")
    const blob = new Blob([jsonl], { type: "application/x-ndjson" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `commentary-labels-${new Date().toISOString().slice(0, 10)}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  function clearLabels() {
    saveLabels([])
    setLabelCount(0)
    setSavedNote("Cleared local labels.")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold">Commentary QA / Eval</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Internal tool (not linked in nav). Rigorous mode: deep MultiPV (k={COMMENTARY_MULTIPV},
              depth ≤{COMMENTARY_RIGOROUS_DEPTH}) → line-cited commentary → line verification. Shows
              every grounding fact for vetting.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{labelCount} label(s)</span>
            <button onClick={downloadJsonl} className="font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-indigo-400 transition">
              Download JSONL
            </button>
            <button onClick={clearLabels} className="font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-red-400 transition">
              Clear
            </button>
          </div>
        </header>

        {/* Test cases */}
        <div className="flex flex-wrap gap-2">
          {TEST_CASES.map((tc) => (
            <button
              key={tc.label}
              onClick={() => loadCase(tc)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 transition"
              title={`${tc.theme} · ${tc.fen}`}
            >
              {tc.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">FEN (before move)</span>
            <input
              value={fen}
              onChange={(e) => setFen(e.target.value)}
              className="font-mono text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Move (SAN)</span>
              <input
                value={move}
                onChange={(e) => setMove(e.target.value)}
                placeholder="e.g. Nc7+"
                className="font-mono text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Student level</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Recurring mistakes (comma-sep)</span>
              <input
                value={mistakes}
                onChange={(e) => setMistakes(e.target.value)}
                placeholder="misses forks, weak back rank"
                className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </label>
          </div>
          <details className="group">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-indigo-500">
              Exemplars — your annotations (optional, few-shot)
            </summary>
            <textarea
              value={exemplarsText}
              onChange={(e) => setExemplarsText(e.target.value)}
              rows={4}
              placeholder={
                "Paste 1–4 of your own rigorous example comments, separated by a blank line.\n" +
                "The model is told to match their density, specificity, and voice."
              }
              className="mt-2 w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono"
            />
          </details>
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={run}
              disabled={loading}
              className="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {loading ? "Analyzing…" : "Run pipeline"}
            </button>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={serverAnalysis}
                onChange={(e) => setServerAnalysis(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              Server-side deep analysis
              <span className="text-xs font-normal text-slate-400">
                {serverAnalysis ? "(deeper; needs OPENAI_API_KEY-style Node server)" : "(browser engine)"}
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Position board(s) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Position</h2>
            <FlipBoardButton onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))} />
          </div>
          {!preview.valid ? (
            <p className="text-sm text-red-600 dark:text-red-400">Invalid FEN — fix it to preview the board.</p>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <BoardPanel
                  id="eval-before"
                  label="Before move"
                  fen={preview.before}
                  orientation={orientation}
                  highlight={buildLastMoveStyles(preview.from, preview.to)}
                />
                <BoardPanel
                  id="eval-after"
                  label={preview.after ? "After move" : "After move (enter a legal move)"}
                  fen={preview.after ?? preview.before}
                  orientation={orientation}
                  highlight={preview.after ? buildLastMoveStyles(preview.from, preview.to) : {}}
                  dim={!preview.after}
                />
              </div>
              {preview.moveError && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {move.trim()}: {preview.moveError}
                </p>
              )}
            </>
          )}
        </div>

        {/* Generated comment */}
        {response && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                Generated comment
              </span>
              <Badge>{response.source}</Badge>
              {record && <Badge>{record.classification}</Badge>}
              {response.analysisSource && (
                <Badge>
                  {response.analysisSource}
                  {response.analysisDepth != null ? ` · depth ${response.analysisDepth}` : ""}
                </Badge>
              )}
              <Badge className={response.guardrail.passed ? "text-green-700" : "text-red-700"}>
                guardrail: {response.guardrail.passed ? "pass" : "fail"}
              </Badge>
              {response.reason && <Badge>{response.reason}</Badge>}
            </div>
            <p className="text-base leading-relaxed">{response.comment}</p>
            {response.referencedBestMove != null && (
              <p className="text-xs text-slate-500">referencedBestMove: {String(response.referencedBestMove)}</p>
            )}
            {response.guardrail.failures.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Verification failures: {response.guardrail.failures.join("; ")}
              </p>
            )}
          </div>
        )}

        {/* Labeling flywheel */}
        {response && record && (
          <Section title="Label this comment (FM preference data)">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVerdict("up")}
                className={`text-sm font-bold px-3 py-1.5 rounded-lg border transition ${
                  verdict === "up"
                    ? "bg-green-600 text-white border-green-600"
                    : "border-slate-300 dark:border-slate-700 hover:border-green-400"
                }`}
              >
                👍 Good
              </button>
              <button
                onClick={() => setVerdict("down")}
                className={`text-sm font-bold px-3 py-1.5 rounded-lg border transition ${
                  verdict === "down"
                    ? "bg-red-600 text-white border-red-600"
                    : "border-slate-300 dark:border-slate-700 hover:border-red-400"
                }`}
              >
                👎 Bad
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Corrected commentary (your master edit → becomes the &quot;chosen&quot; example)
              </span>
              <textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                rows={3}
                className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Flag a wrong line / claim</span>
              <div className="flex gap-2">
                <input
                  value={flaggedInput}
                  onChange={(e) => setFlaggedInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addFlaggedLine() }}
                  placeholder='e.g. "claims Qg4+ wins but Kh8 holds"'
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button onClick={addFlaggedLine} className="text-sm font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-amber-400 transition">
                  Flag
                </button>
              </div>
              {flaggedLines.length > 0 && (
                <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-5">
                  {flaggedLines.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveLabel}
                className="self-start text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Save label
              </button>
              {savedNote && <span className="text-xs text-slate-500">{savedNote}</span>}
            </div>
          </Section>
        )}

        {/* Candidate lines (MultiPV) + refutations the model was given */}
        {record && (record.candidates.length > 0 || record.refutations.length > 0) && (
          <Section title="Engine lines the model was given (MultiPV + refutations)">
            {record.candidates.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Candidates</span>
                <ol className="text-sm font-mono flex flex-col gap-0.5">
                  {record.candidates.map((c, i) => (
                    <li key={i}>
                      <span className="text-indigo-600 dark:text-indigo-400">{c.san}</span>{" "}
                      <span className="text-slate-400">({(c.endEvalCp / 100).toFixed(2)})</span>{" "}
                      {c.pvSan.join(" ")}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {record.refutations.length > 0 && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Refutations / consequence lines</span>
                <ul className="text-sm font-mono flex flex-col gap-0.5">
                  {record.refutations.map((f, i) => (
                    <li key={i}>
                      <span className="text-amber-600 dark:text-amber-400">{f.ofMoveSan}</span>:{" "}
                      {f.pvSan.join(" ")}{" "}
                      <span className="text-slate-400">→ {(f.endEvalCp / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* Prioritized signals */}
        {signals.length > 0 && (
          <Section title="Prioritized signals (top-k)">
            <ul className="flex flex-col gap-1">
              {signals.map((s, i) => (
                <li key={i} className="text-sm font-mono">
                  <span className="text-indigo-600 dark:text-indigo-400">[{s.kind}]</span> {s.text}{" "}
                  <span className="text-slate-400">w={s.weight}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Full record */}
        {record && (
          <Section title="ConceptRecord (full grounding)">
            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(record, null, 2)}
            </pre>
          </Section>
        )}
      </div>
    </div>
  )
}

function BoardPanel({
  id,
  label,
  fen,
  orientation,
  highlight,
  dim,
}: {
  id: string
  label: string
  fen: string
  orientation: "white" | "black"
  highlight: Record<string, React.CSSProperties>
  dim?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className={dim ? "opacity-60" : undefined}>
        <Chessboard
          options={{
            id,
            position: fen,
            boardOrientation: orientation,
            allowDragging: false,
            squareStyles: highlight,
            darkSquareStyle: { backgroundColor: "#769656" },
            lightSquareStyle: { backgroundColor: "#eeeed2" },
          }}
        />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  )
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ${className}`}
    >
      {children}
    </span>
  )
}
