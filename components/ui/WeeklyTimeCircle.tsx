"use client"

interface Props {
  hours: number   // actual hours this week
  goal?: number   // goal hours (default 5)
}

// Returns stroke color + glow filter based on completion percentage.
// The circle gets progressively brighter: transparent → faint indigo → vivid → glowing.
function getStyle(pct: number): { stroke: string; filter: string; trackStroke: string } {
  if (pct <= 0) {
    return { stroke: "transparent", filter: "none", trackStroke: "#e2e8f0" }
  }
  if (pct < 0.2) {
    return { stroke: "#e0e7ff", filter: "none", trackStroke: "#e2e8f0" }            // indigo-100 — barely visible
  }
  if (pct < 0.4) {
    return { stroke: "#a5b4fc", filter: "none", trackStroke: "#e2e8f0" }            // indigo-300
  }
  if (pct < 0.6) {
    return {
      stroke: "#818cf8",
      filter: "drop-shadow(0 0 4px rgba(129,140,248,0.4))",
      trackStroke: "#e2e8f0",
    }                                                                                 // indigo-400 + faint glow
  }
  if (pct < 0.8) {
    return {
      stroke: "#6366f1",
      filter: "drop-shadow(0 0 8px rgba(99,102,241,0.55))",
      trackStroke: "#e0e7ff",
    }                                                                                 // indigo-500 + glow
  }
  return {
    stroke: "#4f46e5",
    filter: "drop-shadow(0 0 14px rgba(79,70,229,0.7))",
    trackStroke: "#c7d2fe",
  }                                                                                   // indigo-600 — max glow
}

export function WeeklyTimeCircle({ hours, goal = 5 }: Props) {
  const pct    = Math.min(hours / goal, 1)
  const radius = 52
  const cx     = 64
  const cy     = 64
  const circ   = 2 * Math.PI * radius
  const offset = circ * (1 - pct)

  const { stroke, filter, trackStroke } = getStyle(pct)

  const displayHours = hours.toFixed(1)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
        This week
      </p>

      <svg width="128" height="128" viewBox="0 0 128 128">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={trackStroke}
          strokeWidth="9"
          className="dark:[stroke:#334155]"
        />
        {/* Progress arc */}
        {pct > 0 && (
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter, transition: "stroke-dashoffset 0.6s ease, filter 0.6s ease" }}
          />
        )}
        {/* Center: hours number */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="currentColor"
          className="fill-gray-900 dark:fill-slate-100"
        >
          {displayHours}
        </text>
        <text
          x={cx} y={cy + 13}
          textAnchor="middle"
          fontSize="9.5"
          fill="currentColor"
          className="fill-gray-400 dark:fill-slate-500"
        >
          hrs
        </text>
      </svg>

      <p className="text-xs text-gray-400 dark:text-slate-500 text-center leading-snug">
        of {goal}h weekly goal
      </p>
    </div>
  )
}
