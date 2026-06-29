# CCC (Concept-guided Chess Commentary) — method spec + ChessMind alignment

Reference: Kim, Goh, Hwang, Cho, Ok. **"Bridging the Gap between Expert and Language
Models: Concept-guided Chess Commentary Generation and Evaluation."** NAACL 2025
(arXiv:2410.20811). Official code: `ml-postech/concept-guided-chess-commentary`.

This document is the source of truth for how ChessMind's commentary layer maps to
the paper. It has four parts:

1. The paper's method, extracted precisely.
2. Is training required? (short answer: **no** for the headline pipeline.)
3. Gap analysis vs ChessMind's existing `lib/commentary/*`.
4. What we changed to align, how to test it, and honest remaining gaps.

---

## 1. The paper's method

CCC has two halves: **generation (CCC)** and **evaluation (GCC-Eval)**. Both are
*inference-time* pipelines on top of a frozen LLM (GPT-4o). The only thing that is
"trained" is a set of cheap **linear SVM probes** used to read concepts out of an
expert net — and even that is optional (see §2).

### 1.1 Concept taxonomy (the features fed to the LLM)

The concepts are **adopted directly from Stockfish 8's classical evaluation
terms** (paper §3.1.1, Table 6). Stockfish 8 can score a position for each of these.
The taxonomy (12 concept *families*, each reported per side → 24 rows in Table 6):

| Concept family | What it measures |
| --- | --- |
| Material | Net material (P=1, N/B=3, R=5, Q=9). |
| Imbalance | Non-material imbalance (bishop pair, minor-vs-minor, piece-count synergies). |
| Pawns | Pawn-structure quality (doubled, isolated, backward, …). |
| Knights | Knight placement/activity (outposts, mobility) per side. |
| Bishops | Bishop placement/activity (diagonals, bad bishop) per side. |
| Rooks | Rook activity (open/semi-open files, 7th rank) per side. |
| Queens | Queen activity/safety per side. |
| Mobility | Number of available/controlled squares per side. |
| Kingsafety | All potential threats against the king (shelter, attacker pressure) per side. |
| Threats | Attacks on/against pieces (hanging, attacked-by-lower-value) per side. |
| Space | Controlled squares in the opponent's half per side. |
| Passedpawns | Passed pawns weighted by advancement per side. |

How each is computed in the paper: collect 200k Lichess positions, score each with
**Stockfish 8** per concept, label top-5% positive / bottom-5% negative (20k per
concept), then train a **linear SVM** on **LeelaChessZero T78** layer-40
representations. The SVM normal vector is the *concept vector*; the signed distance
of a position's representation from the SVM boundary is the position's **concept
score**. Reported probe accuracy ≈ 0.91 (Table 6).

> Key point: the concept *labels themselves come straight from Stockfish's
> classical eval*. The SVM step only exists to read those same concepts out of a
> neural net's latent space. You can skip it and use a chess engine's concept
> scores (or deterministic proxies) directly — this is exactly what the paper says
> the concepts "are adopted from."

### 1.2 Concept prioritization (the "concept-guided" selection)

Local (per-move) importance, not global (per-class) importance (paper §3.1.2):

1. For the position, compute each concept's score = dot(expert representation,
   concept vector).
2. Do this **before** the move and **after** the move.
3. **Prioritize concepts by the magnitude of the before→after change (delta).** The
   concepts whose score moved the most are "what this move is about."
4. Feed the **top-k** prioritized concepts to the LLM (their Figure 3 example uses
   ~2–3, e.g. *Pawns, Black Passedpawns, White Kingsafety*).

### 1.3 Prompt structure (serialization into the LLM)

The generation prompt (paper §3.1.2, Figure 2/3) gives the LLM:

- The position (**FEN**, also validated with **PGN** — Appendix F shows both work).
- The played move.
- **Engine evaluation** as a hint, in this exact shape (Appendix A example):
  `actual move - Bd2+ 232cp, expected reply - f4g3, best move - Bd2+ similar to
  actual move, second best move - Nc5 similar to actual move`.
- The **top-k prioritized concepts**.
- An **enumeration of all existing attacks toward opponent pieces** — explicitly to
  "prevent mentioning of non-existing pieces or illegal moves."
- Few-shot examples + **Chain-of-Thought** prompting + chess-specific information.

Base LLM: **GPT-4o**, temperature **0.1** (low, to avoid noisy output). They also
tested GPT-4o-mini / GPT-3.5 / ChessGPT and found GPT-4o strongest at chess.

### 1.4 GCC-Eval (the rubric judge)

GCC-Eval extends **G-Eval** with chess expertise (paper §3.2, Appendix A). Four
components: (i) multi-dimensional LLM scoring; (ii) **expert-model augmentation**
for chess-knowledge dimensions; (iii) **Auto-CoT, score-only** output; (iv)
**weighted-summation** for non-integer scores.

**Dimensions (each scored 1–5):**

- **Relevance** — only info relevant to the move/reasoning. *Engine eval given as a hint.*
- **Completeness** — covers all critical points, nothing important missed. *Engine eval given as a hint.*
- **Clarity** — clear and detailed, no vague/ambiguous statements. *(linguistic; no hint.)*
- **Fluency** — smooth, well-structured, coherent transitions. *(linguistic; no hint.)*

(Correctness is a **human-only**, 3-point question in the paper — not part of the
automatic GCC-Eval score, because it needs a strong human judge.)

**Scoring math (weighted summation, Eq. 1):** the LLM emits a single integer 1–5
after Auto-CoT; using the token probabilities of "1".."5",
`score(x) = Σ_{s∈{1..5}} s · p(s | x)`. This yields smooth non-integer scores.
Relevance/completeness prompts include the engine-eval hint; clarity/fluency do not.
GCC-Eval correlates with human judgments far better than BLEU/ROUGE (Table 4).

---

## 2. Do you need to train a model? **No.**

- The **LLM is frozen** (GPT-4o, used via API). CCC is a *prompting* method — no
  fine-tuning is required for any headline result (Tables 1, 5).
- The only trained components are **linear SVM concept probes**, which are (a)
  trivial linear classifiers, not a model you'd "train" in the deep-learning sense,
  and (b) **optional**: the concepts are defined by Stockfish's classical eval, so an
  engine (or deterministic chess proxies) can supply the same concept scores
  directly. The probes only matter if you specifically want to read concepts out of
  Leela's latent space.
- GCC-Eval is also **inference-time** (LLM judge + engine hint). The paper mentions
  "fine-tuning generation with GCC-Eval as a reward" only as **future work**
  (§5), not part of the method.

**What fine-tuning WOULD add (optional, not needed):** a smaller/cheaper local model
could be distilled to imitate CCC outputs, or RL-tuned against GCC-Eval to squeeze
out a bit more relevance/completeness without an API. **What it would NOT add:** any
new capability — the accuracy comes from the engine concepts + attack enumeration +
strong base LLM, all of which we already have. So ChessMind stays **training-free**.

ChessMind's adaptation: instead of SVM-on-Leela probes, we compute the **same
concept taxonomy as deterministic chess proxies** (chess.js) plus the Stockfish
eval/MultiPV layer already in the app, then prioritize by before→after delta exactly
as the paper does. This is faithful to "concepts adopted from Stockfish 8" and needs
zero training.

---

## 3. Gap analysis vs ChessMind (before this change)

| CCC element | ChessMind before | Status |
| --- | --- | --- |
| Engine eval (cp), best move, classification | `classify.ts`, `concept-record.ts` | ✅ had |
| MultiPV candidates + refutation lines | `analysis-shared.ts` (rigorous) | ✅ had (beyond paper) |
| Attack enumeration (anti-hallucination) | `attacks.ts` `enumerateAttacks` | ✅ had |
| Hanging-piece detection | `attacks.ts` `findHanging` | ✅ had |
| Material delta | `match.ts` `materialDelta` | ✅ had |
| Phase, check/mate/capture flags | `concept-record.ts`, `match.ts` | ✅ had |
| Tactical-pattern / key-concept tags | `match.ts`, taxonomies | ✅ had (app-specific) |
| CoT + "use ONLY listed facts" + rating depth | `prompt.ts` | ✅ had (+ anti-vagueness/line-citation, beyond paper) |
| **CCC concept taxonomy** (Stockfish 12 families) | — | ❌ missing → **added** (`concepts.ts`) |
| **Before→after concept delta** | partial (eval swing only) | ❌ weak → **added** (full taxonomy delta) |
| **Top-k concept prioritization** | `prioritize.ts` (signal-weight, not concept-delta) | ⚠️ diverged → **added** concept-delta top-k, k in `config.ts` |
| **Concept block in prompt** | only eval/attacks/tags | ❌ missing → **added** prioritized-concepts block |
| **CCC engine-eval hint format** | free-form eval lines | ⚠️ diverged → **added** paper-format hint line |
| **GCC-Eval rubric judge** | — | ❌ missing → **added** (`gcc-eval.ts` + `/api/commentary-eval`) |
| Weighted-summation scoring (logprobs) | — | ❌ missing → **added** (logprob weighted sum + integer fallback) |

ChessMind already exceeds the paper on grounding (verified MultiPV lines, a line
verifier, an anti-vagueness verifier, rating-conditioned depth). The gaps were all on
the *concept* side and the *evaluator*.

---

## 4. What we changed (alignment) + how to test

### Files added
- `lib/commentary/concepts.ts` — the CCC concept taxonomy as deterministic
  chess.js proxies (`computeConcepts(fen, mover)`), plus `prioritizeConcepts(...)`
  that ranks concepts by normalized before→after delta and returns top-k.
- `lib/commentary/gcc-eval.ts` — GCC-Eval prompts (per the paper's Appendix A,
  one per dimension), the engine-eval hint builder, and `scoreFromLogprobs`
  (weighted summation, Eq. 1) with an integer fallback.
- `app/api/commentary-eval/route.ts` — POST `{ record, comment }` → 4 rubric
  scores (relevance, completeness, clarity, fluency) + overall. Behind the feature
  flag; graceful no-key fallback. Uses a chat model for logprobs.

### Files extended (not rebuilt)
- `lib/commentary/types.ts` — `ConceptScore`, `PrioritizedConcept`, and optional
  `conceptScores` / `prioritizedConcepts` on `ConceptRecord`.
- `lib/commentary/concept-record.ts` — compute the taxonomy before/after and attach
  the prioritized top-k.
- `lib/commentary/config.ts` — `COMMENTARY_TOP_K_CONCEPTS`, eval-model + dimensions.
- `lib/commentary/prioritize.ts` — fold the concept-delta signals into top-k.
- `lib/commentary/prompt.ts` — add the **PRIORITIZED CONCEPTS** block and the
  CCC-format **engine-eval hint** line (kept the existing attack enumeration,
  CoT, line-citation, anti-vagueness).
- `app/commentary-eval/page.tsx` — show the prioritized concepts + a "Run GCC-Eval"
  button that renders the four rubric scores for the generated comment.

### How to test on `/commentary-eval`
1. `cd app && npm run dev`, open `http://localhost:3000/commentary-eval`.
2. Pick a built-in case (or type a FEN + SAN move), choose a student level, **Run
   pipeline**. You'll get the CCC-aligned comment + the full ConceptRecord.
3. The **Prioritized concepts (CCC)** panel shows the top-k concept families and
   their before→after deltas (this is the concept guidance the LLM received).
4. Click **Run GCC-Eval** to score that comment on relevance / completeness /
   clarity / fluency (1–5, weighted-summation) + overall.
   - With `OPENAI_API_KEY` set you get live LLM scores; without it the route returns
     a clearly-labeled heuristic fallback so the UI still works.

### Honest limitations vs the paper
- We use **deterministic chess proxies** for concept scores, not SVM-on-Leela
  probes. Faithful to the taxonomy and training-free, but the absolute scores differ
  from the paper's latent-space distances (the *prioritization by delta* is the part
  that matters for guidance, and that is preserved).
- Weighted-summation needs token **logprobs**, which chat models expose but
  reasoning models (e.g. gpt-5.x) do not under JSON mode. The evaluator therefore
  defaults to a chat model (`COMMENTARY_EVAL_MODEL`, default `gpt-4o-mini`) and falls
  back to a single-integer parse if logprobs are unavailable.
- Generation uses the app's configured model (currently a reasoning model) with the
  app's richer grounding, rather than GPT-4o @ temp 0.1; output quality tracks the
  configured model.
