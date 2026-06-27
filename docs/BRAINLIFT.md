# Arthur Xu

# 

# BrainLift: ChessMind (First Draft)

## Purpose

The purpose of this BrainLift is to building an AI-powered chess
learning platform that generates trustworthy, master-level chess
commentary that explains *why* a move is good or bad, not just *what*
the best move is. An engine can output the best move in milliseconds.
But explaining the move in a way that actually teaches is fundamentally
different and much. ChessMind is an attempt to close that gap for
improving players by attacking the engagement process.

### Scope

**In scope**:

- Chess pedagogy: courses, Key Concepts (macro ideas) vs Tactical
  Patterns (micro motifs), coach-style feedback. Wrong answers are
  explained as understanding why alternative candidate moves are
  incorrect is vital.

- Interactive practice: lessons/puzzles, Solitaire Chess, Free Analysis
  with a real engine.

- AI commentary: engine-grounded, verified, anti-vague explanations of
  moves.

- On-Board learning: everything is taught THROUGH the board. The user
  only works with the board and sees commentary and coaching through the
  pieces and squares on the chess board.

- Competitive layer: engine-generated games, Elo, leaderboards,
  matchmaking.

**Out of scope (for now)**:

- Real-time synchronized live multiplayer (current multiplayer is
  async/ghost-based).

- Server-side anti-cheat replay of submitted scores (noted as a future
  hardening).

- Training a chess-playing model from scratch (engine handles play; LLM
  only explains).

- **Trained AI Model on chess commentary (insufficient training data and
  lack of experienced masters working on this subject)**

## Owner

- **Arthur Xu -** FIDE Master and chess domain expert.

## Experts & Sources

Papers and people I have learned from and based on my learning app off
of:

**Academic: chess commentary & human-like play** - **Jhamtani et al.,
ACL 2018** --- "Learning to Generate Move-by-Move Commentary..." --- the
GameKnot dataset (\~298K comments) + the GAC model. Lesson: amateur
forum data is noisy; BLEU is useless here.
[aclanthology.org/P18-1154](https://aclanthology.org/P18-1154/)

**Kim et al., NAACL 2025 (CCC + GCC-Eval)**: concept-guided commentary:
engine concepts → LLM, evaluated by a rubric judge. The
directly-replicable blueprint.
[arxiv.org/html/2410.20811](https://arxiv.org/html/2410.20811)

**ChessGPT (Waterhorse/Feng et al., NeurIPS 2023)**: large game+language
corpus + dataset.

**Maia / Maia-2 (McIlroy-Young et al.)**: human-like, rating-conditioned
move prediction; relevant for personalization.
[maiachess.com](https://www.maiachess.com/)

**ACT-Eval (2025/26)**: atomic-claim verification; shows even frontier
models hallucinate \~22% of chess claims without tools.
[openreview.net](https://openreview.net/forum?id=nne0ti66KT) - **VERICOT
/ REDI (2025)** --- verified distillation and learning from negative
traces (training recipe).

**Carl Hendrick:** retrieval IS learning. Students get access to key
concepts and tactical patterns that occur over and over in chess and get
pointed towards those lessons and concepts throughout their journey in
the course. They get to see these in their games whe they upload them
and get a deep dive into their thinking process and improving it.

## Learning Science Foundations

Every interaction decision in ChessMind is downstream of a specific,
named result in cognitive and learning science --- not aesthetic
preference. The product's central thesis ("teach *through* the board")
is itself a load-management claim. This section states each principle
correctly, names the theorist/effect, and maps it to the concrete
feature that implements it. Where a feature is not yet built, it is
marked **(planned)** so the doc stays honest.

### 1. Cognitive Load Theory & the split-attention effect --- the case for On-Board learning

**Sweller's Cognitive Load Theory** distinguishes *intrinsic* load (the
inherent complexity of the material --- a chess position has many
interacting elements and is irreducibly hard) from *extraneous* load
(load imposed purely by how the material is *presented*, which we can
and should engineer away). A learner has a fixed working-memory budget;
every unit spent on extraneous load is stolen from actual learning.

The **split-attention effect** is the specific failure we are
designing against: when a board and a *separate* text panel must be
mentally integrated, the learner burns working memory just holding both
in mind and shuttling their gaze and attention back and forth to
cross-reference "the knight on f3" in prose against the actual f3
square. Mayer's **spatial-contiguity principle** is the positive
formulation: people learn better when words and the corresponding
visuals are placed *physically near each other* rather than separated.

**→ ChessMind feature.** This is the direct, literal rationale for
"On-Board learning" and the "Focusing" idea. Commentary, arrows, and
square highlights are rendered *onto the board itself*
(`BoardSquareOverlay`), and explanations are revealed in place
(hover-to-reveal arrows/highlights, on-board move explanations) instead
of in a side wall of text. The learner looks in **one** place, the
center of the screen, eliminating the cross-reference cost entirely. The
SpikyPOV "students will interact with everything ON the board rather
than see walls of text" *is* the spatial-contiguity principle applied to
chess.

### 2. Working-memory limits --- reveal on demand

**Miller's "7 ± 2"** and **Cowan's** more conservative estimate of
roughly **4 chunks** establish that only a handful of unrelated items
fit in working memory at once. Dumping every relevant concept, pattern,
and candidate line onto the screen simultaneously guarantees overload.

**→ ChessMind feature.** Key Concepts and Tactical Patterns are
surfaced *when relevant* rather than all at once, and supporting detail
sits behind progressive-disclosure UI (the `Disclosure` component) so
the learner pulls in depth on demand. The macro (Key Concepts) vs micro
(Tactical Patterns) split is itself a chunking strategy: it gives the
learner pre-formed schemas to attach new positions to, which is how
experts compress board states into far fewer chunks than novices.

### 3. Worked examples & the expertise-reversal effect

The **worked-example effect** (Sweller, Renkl) shows that for novices,
studying fully worked solutions produces more learning per unit time
than unguided problem-solving, because it lets them build schemas
without first exhausting working memory on search. The
**expertise-reversal effect** (Kalyuga) is the crucial caveat: the same
heavy guidance that helps a novice *hurts* an expert, who no longer
needs it and is slowed by processing redundant explanation. The
prescription is **fading** --- withdraw guidance as competence grows.

**→ ChessMind feature.** Annotated master games (e.g., the Opera Game)
function as worked examples: the learner steps through a master's
solution with the reasoning attached. **(Planned)** adaptive *fading* of
guidance as a player's rating rises --- showing fewer hints and more
"you call it" prompts to stronger users --- so we don't trigger
expertise reversal on improving players.

### 4. Retrieval practice / active recall

The **testing effect** (Roediger & Karpicke) is one of the most robust
findings in the field: the act of *retrieving* an answer from memory
strengthens it far more than re-reading. This is exactly **Carl
Hendrick's** point above --- retrieval *is* learning, not just
measurement of it.

**→ ChessMind feature.** Puzzles and **Solitaire Chess**
(guess-the-move over a real game) force the learner to *produce* a move
from memory and understanding before any feedback appears --- retrieval,
not passive watching. The recent decision to **not reveal the correct
answer on a wrong move** is a deliberate retrieval-preserving choice:
handing over the answer collapses the retrieval attempt into recognition
and destroys the learning value of the next try.

### 5. Desirable difficulties

**Bjork's desirable-difficulties** framework explains *why* the choice
above is correct rather than merely frustrating: conditions that make
practice feel harder and more error-prone in the moment (effortful
retrieval, spacing, interleaving) produce more *durable* learning, while
fluent, frictionless study produces confident forgetting.

**→ ChessMind feature.** Wrong answers are explained as *why this
candidate fails* without spoiling the solution --- the difficulty is
preserved but made productive. Practice is varied across concepts and
positions rather than massed on one motif. **(Planned)** an explicit
**spaced-repetition** schedule for Key Concepts and missed patterns, so
ideas resurface at expanding intervals. [TODO: Arthur --- decide the
spacing cadence you want (e.g., 1d / 3d / 7d) and whether it keys off
rating or off miss-count.]

### 6. Immediate, specific, process-focused feedback

**Hattie & Timperley's** feedback model and **Kluger & DeNisi's**
meta-analysis converge on the same point: feedback works when it targets
the *process and self-regulation* level ("here is the idea you missed
and why this line refutes your move") and often *backfires* when it is
vague praise or bare right/wrong scoring directed at the person.

**→ ChessMind feature.** Coach feedback explains the *idea* behind the
move, not just a verdict. It is **immediate** (delivered at the moment
of the attempt) and **specific** (anchored to the actual line). This is
the explicit contrast in DOK 1 with "Game Review"-style tutors that give
"vague and 'drill' type explanations."

### 7. Concreteness & grounding --- "claim with a receipt"

Misconceptions form when explanations are stated in vague adjectives
("this move is strong," "the position is dynamic") that the learner
cannot tie to anything checkable. Grounding every claim in a concrete
referent --- a specific square, piece, and line --- both aids encoding
and prevents the formation of fuzzy, transfer-blocking beliefs.

**→ ChessMind feature.** The "claim with a receipt" SpikyPOV is
implemented literally: ChessMind builds a `ConceptRecord` per move (eval
delta, best-line PV, enumerated attacks, hanging pieces, candidates +
refutations) and passes *only those facts* to the LLM, and a **verifier
rejects any claim whose cited line isn't legal/eval-consistent**, then
reprompts or falls back to a deterministic template. Every statement the
learner reads is anchored to a verifiable board fact.

### 8. Dual coding / the multimedia principle

**Paivio's dual-coding theory** and **Mayer's multimedia principle**
hold that information encoded through *both* a verbal and a visual
channel is remembered better than either alone, provided the two are
complementary rather than redundant.

**→ ChessMind feature.** Concise verbal explanation is paired with
visual board cues --- arrows, highlighted squares, piece icons --- on
the same board, so the same idea is laid down through two channels at
once. Combined with §1, this is why the explanation lives *on* the board
rather than beside it: same idea, two encodings, one location.

### 9. Motivation & engagement --- Self-Determination Theory, done ethically

**Deci & Ryan's Self-Determination Theory** identifies three drivers of
durable intrinsic motivation: **competence** (visible mastery growth),
**autonomy** (the learner chooses their path), and **relatedness**
(connection to others). Gamification works when it *supports* these and
manipulates when it hijacks them with dark patterns (artificial loss
aversion, pay-to-skip-frustration, infinite-grind streaks that punish
real life).

**→ ChessMind feature.** Streaks, XP, Elo, and leaderboards are framed
to signal **competence** (you can see yourself improving) and respect
**autonomy** (the player chooses what to study and play). This is the
direct answer to the "leaderboards make a learning app toxic" myth:
randomly-generated games with fair shared scoring give a competence
signal that is motivating without being look-up-able or demoralizing.
The ethical line we hold: gamification exists to *motivate practice*,
not to manufacture compulsion.

### 10. Personalization & the Zone of Proximal Development

**Vygotsky's Zone of Proximal Development** is the band of tasks just
beyond what the learner can do alone but reachable *with* support;
learning is maximized when difficulty and scaffolding keep the learner
inside that band. Feedback and challenge pitched too low bore; too high
overwhelm.

**→ ChessMind feature.** **Maia / Maia-2's** rating-conditioned,
human-like move prediction is the model-side ingredient for meeting a
player at their level rather than at the engine's superhuman level.
**(Planned)** adaptive difficulty and rating-conditioned idea selection
--- choosing puzzles, opponents, and explanation depth that sit inside
each learner's ZPD, and scaffolding that fades (see §3) as they climb.

### Principle → feature map

| Learning-science principle | Named source | ChessMind feature | Status |
|---|---|---|---|
| Split-attention / spatial contiguity; CLT | Sweller; Mayer | On-Board learning, `BoardSquareOverlay`, hover-to-reveal | Built |
| Working-memory limits | Miller; Cowan | Reveal-on-demand `Disclosure`; Key Concepts vs Patterns chunking | Built |
| Worked examples | Sweller; Renkl | Annotated master games (Opera Game) | Built |
| Expertise reversal → fading | Kalyuga | Fading guidance by rating | Planned |
| Retrieval practice | Roediger & Karpicke; Hendrick | Puzzles, Solitaire; no answer-reveal on wrong move | Built |
| Desirable difficulties | Bjork | Why-it-fails feedback; varied practice; spacing | Built / spacing planned |
| Process-focused feedback | Hattie & Timperley; Kluger & DeNisi | Idea-level coach feedback, immediate & specific | Built |
| Concreteness / grounding | (anti-misconception) | `ConceptRecord` + verifier ("claim with a receipt") | Built |
| Dual coding / multimedia | Paivio; Mayer | Arrows + highlights + icons paired with concise text | Built |
| Motivation (SDT) | Deci & Ryan | Streaks, XP, Elo, fair leaderboards | Built |
| Zone of Proximal Development | Vygotsky; Maia | Rating-conditioned ideas; adaptive difficulty | Maia-informed / adaptive planned |

## SpikyPOVs (DOK 4)

Students learn by *changing* their thought process, which is something
that cannot be accomplished by simply knowing the best moves and
memorizing ideas. Drilling is important, but building concept
understanding is far more important. I teach students with interactive
instruction because Chess is an interactive game at its core. Students
will interact with everything ON the board rather than see walls of text
that they have to sift through like in traditional books. I evolve these
ideas into a proper simulation for students to ENJOY working through.

**Myths people believe**:

*"Leaderboards make a learning app toxic."* They can, but
randomly-generated games, fair shared scoring and Elo can be motivating
without being lookup-able or demoralizing.

"*Learning concepts and memorizing ideas is the best way to improve in
chess."* It will, but the only way you can apply this is through pattern
recognition. This requires a system, an app (which is what I am
providing) to actually compile and help the user understand that gives
them real-game examples to practice these and practical cases.
Otherwise, students will know concepts without knowing how to apply
them.

*"Books and long commentaries will help me improve."* Books have merit
in them. They are written by Grandmasters and have expert commentary.
But they aren't interactive. You don't get personalized answers to
questions on commentary and get to step through lines to see deeply in a
position. Videos of chess are also poor. Students do not retain
information from these videos and will struggle to apply the ideas they
do see as they are not interacting with it themselves.

## DOK 1:

\- A chess engine like Stockfish returns the objectively best move and a
numeric eval (centipawns, or mate-in-N) in milliseconds. Producing the
move is a solved problem.

\- The same engine can enumerate legal moves, attackers/defenders of a
square, and multiple candidate lines, they are all deterministic and
checkable.

\- LLMs, unprompted, routinely emit illegal moves, wrong evals, and
lines that don\'t exist in the position.

\- Commercial tutors (Chess.com Game Review, DecodeChess) are all
Stockfish + a templated/explainable language layer, but all give vague
and "drill" type explanations.

\- High-quality master commentary that exists is locked in copyrighted
books/videos; what\'s freely scrapable (forums) is amateur and noisy.

\- Strong human annotators (titled players willing to label data) are
scarce and expensive.

What I built so far:

\- ChessMind produces a ConceptRecord per move (eval delta,
classification, best line PV, enumerated attacks, hanging pieces,
matched concept/pattern tags, candidates + refutations) and passes only
those facts to the LLM.

\- A verifier rejects any claim whose cited line isn\'t
legal/eval-consistent; on failure it reprompts, then falls back to a
deterministic template.

## DOK 2:

\- We need more data and better models to create better commentary.

\- To make an AI comment like a master, fine-tune it on a big dataset of
master commentary.

\- An eval bar plus a few canned phrases (\'good move\', \'inaccuracy\')
is adequate coaching.

\- Competitive/game features need real, famous games or live human
opponents to be engaging.

## DOK 3:

\- The scarce, valuable ingredient is not the move (free from the
engine) --- it\'s the correct explanation rooted in concrete lines.

\- Students will learn better from interactive exercises for interactive
games.

\- Students will not learn from understanding concepts if they cannot
apply them in their own games or truly see how these concepts are
applied.

\- AI must swoop in and affect the engagement process and go down to the
thought process level.

\- The path matters way more than the actual end.
