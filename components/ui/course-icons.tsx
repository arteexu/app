// components/ui/course-icons.tsx — custom, chess-grounded emblem icons for the
// course preview cards. Each course gets one hand-drawn SVG that captures its
// identity; icons inherit `currentColor` so the card can paint them in the
// course's accent. Add a new icon by extending COURSE_ICONS, and reference it
// from lib/course-previews.ts via the `icon` key. Unknown keys fall back to a
// neutral chess pawn so a new course is never left without an emblem.

export type CourseIconName = "fallen-king" | "charging-knight" | "pawn"

interface IconProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Checkmating — a toppled king resting on the board's edge. The fallen king is
 * chess's universal sign of resignation, the moment mate lands. Drawn upright,
 * then tipped onto its side over a baseline with a faint contact shadow.
 */
function FallenKingIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden focusable="false">
      {/* board edge the king has fallen onto */}
      <line x1="6" y1="40.5" x2="42" y2="40.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
      {/* contact shadow */}
      <ellipse cx="26" cy="39.6" rx="13" ry="1.7" fill="currentColor" opacity="0.16" />

      {/* the king, toppled to the right and lying down */}
      <g transform="rotate(72 24 24)" fill="currentColor">
        {/* cross finial */}
        <rect x="22" y="3.5" width="4" height="9.5" rx="1.4" />
        <rect x="18.5" y="5.6" width="11" height="3.6" rx="1.4" />
        {/* domed head */}
        <path d="M24 12.5c-4.7 0-7.7 3.1-7.7 6.7 0 2.2 1.2 3.9 3 5h9.4c1.8-1.1 3-2.8 3-5 0-3.6-3-6.7-7.7-6.7Z" />
        {/* flared body */}
        <path d="M19.4 24.2h9.2c2.3 4 3.7 8 4.1 12.1H15.3c.4-4.1 1.8-8.1 4.1-12.1Z" />
        {/* base */}
        <rect x="11.5" y="35.4" width="25" height="5" rx="2.4" />
      </g>
    </svg>
  )
}

/**
 * Attacking Chess — a knight rearing into a strike. The knight is the assault
 * piece: it leaps, forks, and sacrifices. Head faces forward with three speed
 * lines trailing behind it to read as momentum and initiative.
 */
function ChargingKnightIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden focusable="false">
      {/* speed lines — the charge */}
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <line x1="5" y1="15" x2="13" y2="15" />
        <line x1="3" y1="22" x2="12" y2="22" />
        <line x1="6" y1="29" x2="13" y2="29" />
      </g>

      <g fill="currentColor">
        {/* knight head + neck, facing right */}
        <path d="M20.5 6.2c-1 1.6-1.3 3.2-1.1 4.7-1.9 1.4-3.6 3.2-4.9 5.6-1.4 2.6-2 5-2.2 6.7-.1 1 .8 1.8 1.8 1.6 1.5-.3 2.7-1 3.8-2.2.5 1.7.4 3.4-.5 5.2-1.4 2.8-2.2 4.9-2.6 6.6h17.8c.7-4 .6-7.6-.2-10.9-1.1-4.6-3.4-8.3-6.6-11.2.6-1 .8-2 .6-3.1-.2-1.2-.9-2.4-2.1-3.6-1.1.2-2.1.6-2.9 1.2-.1-.5-.2-1-.4-1.5l-.5.6Z" />
        {/* eye, knocked out of the fill */}
        <circle cx="22" cy="13.4" r="1.2" fill="#ffffff" />
        {/* pedestal */}
        <rect x="11.5" y="35.6" width="22" height="3.4" rx="1.6" />
        {/* base plate */}
        <rect x="9" y="39.6" width="27" height="3.6" rx="1.8" />
      </g>
    </svg>
  )
}

/** Neutral fallback — a simple pawn, so every course shows an emblem. */
function PawnIcon({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} style={style} aria-hidden focusable="false">
      <g fill="currentColor">
        <circle cx="24" cy="13" r="6.2" />
        <path d="M18.6 18.5h10.8c1.4 2 1.4 4.2-.2 6.6-1.4 2.1-2.2 5.7-2.4 10.7h-5.6c-.2-5-1-8.6-2.4-10.7-1.6-2.4-1.6-4.6-.2-6.6Z" />
        <rect x="13.5" y="35.4" width="21" height="3.4" rx="1.6" />
        <rect x="11" y="39.4" width="26" height="3.6" rx="1.8" />
      </g>
    </svg>
  )
}

const COURSE_ICONS: Record<CourseIconName, (props: IconProps) => React.ReactElement> = {
  "fallen-king": FallenKingIcon,
  "charging-knight": ChargingKnightIcon,
  pawn: PawnIcon,
}

interface CourseIconProps extends IconProps {
  name?: CourseIconName
}

export function CourseIcon({ name, className, style }: CourseIconProps) {
  const Icon = (name && COURSE_ICONS[name]) || PawnIcon
  return <Icon className={className} style={style} />
}
