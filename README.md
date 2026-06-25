# ChessMind

ChessMind is an interactive chess learning app for intermediate young players who want to think like strong attackers — not grind isolated tactics. Learners find moves in annotated grandmaster games, calculate whole lines, and collect **Key Concepts** that transfer across positions.

---

## User Persona

### Alex — the rising attacker

**Age:** 11 (typical range: 8–18, roughly 3rd–12th grade)  
**Skill:** Intermediate — knows opening principles, can spot basic tactics, and has played enough games to recognize common middlegame ideas. Not a beginner, but not yet confident calculating deep combinations or understanding *why* top players choose certain moves over others.

**Goals**

- Walk through real master and grandmaster games with guidance, not just watch them replayed.
- Understand why engine-level moves are good — the plans, threats, and trade-offs behind them.
- Build deep positional understanding: initiative, piece activity, king safety, and when to sacrifice.
- Play sharper, more purposeful attacking chess in their own games.

**Frustrations**

- Tactics apps feel like disconnected puzzles that never show up in real games.
- Watching GM commentary is passive — they forget the moves minutes later.
- They know *what* the best move is sometimes, but not *why* it works or what happens if they try something else.
- Pure rating grind and leaderboard pressure make practice feel like a chore, not growth.

**What Alex needs from ChessMind**

- Active decision points: guess the move, calculate the line, then compare against the annotator.
- Pattern vocabulary — **Key Concepts** like *the initiative*, *calculate lines*, and *bring all pieces into the attack* — unlocked through solving, not memorized from a list.
- Coach-style feedback when a move fails: why it doesn't work, what the opponent gets, and what the position demands instead.
- A structured attack-focused path from fundamentals to annotated master games, at a pace that respects both their age and their existing chess foundation.

Alex represents our primary learner: young enough to benefit from guided, scaffolded instruction; skilled enough that we never talk down to them or waste time on pure beginner drills.

---

## Pedagogy

ChessMind teaches chess the way strong players actually think — by searching the board, calculating sequences, and recognizing plans. This is our product north star, aligned with [Our Purpose](/purpose) in the app.

### Find the move — don't just watch it

Most chess content shows brilliance after the fact. ChessMind puts the learner on the clock. In **Solitaire Chess**, they guess the grandmaster's move move-by-move. In **annotated master games**, they pause at **STOP** moments where the position demands a decision. Learning happens by searching the board, not passively replaying someone else's game.

### Calculate lines, not isolated moves

Strong players think in **lines** — whole sequences — and always ask: *Where does this lead?* Our courses and annotations reinforce that habit. A good move is never taught as a single SAN in a vacuum; it is the entry point to a calculated continuation with threats, sacrifices, and a goal (usually the king).

### Key Concepts and pattern recognition

Isolated tactics do not transfer to real games. As learners solve, they **collect Key Concepts** — durable ideas such as:

- **The initiative** — when ahead in development, play fast even if it means sacrificing material.
- **Calculate lines** — see the sequence, not just the next move.
- **Bring all pieces into the attack** — queens alone do not checkmate kings; coordinated armies do.
- **Consider your opponent's plans** — chess is two-sided; your idea must survive their reply.

Concepts unlock through play and reappear across lessons so patterns stick. This pattern-recognition layer is central to how ChessMind builds lasting understanding, not one-off puzzle memory.

### Annotated grandmaster games as the curriculum spine

Courses climb a structured staircase — from checkmate fundamentals through **Attacking Chess** — using real annotated games. Learners step through openings and middlegames with human commentary, compare their finds to the master's choice, and see how top-level plans (fast development, kingside pawn breaks, sacrifices for initiative) unfold over many moves.

### Coach-style feedback, not a red X

When a learner picks the wrong move, ChessMind explains **why it fails** — the way a coach annotating over their shoulder would: too slow, allows a counter-threat, loses the initiative, hangs material. Wrong moves are teaching moments, not silent failures. Tailored feedback for plausible alternatives is used wherever authored.

### Attack-focused, purposeful practice

The curriculum emphasizes **attacking chess**: development, initiative, open lines toward the king, and finishing attacks with calculation. We prioritize ideas that make learners dangerous over the board — not endless tactical motifs divorced from position type.

### A coach at your side, not a tactics grinder

Learners interact on a real board with legal-move highlights, orientation control, and analyze mode for deeper thinking. **XP, streaks, and trophies** reward steady practice — progress you earn for yourself, not a leaderboard designed to make you feel behind. ChessMind is built for learners who want to play sharper attacking chess, one calculated line at a time.

---

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
