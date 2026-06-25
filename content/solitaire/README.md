# Solitaire Chess game data

`games.json` is an array of `SolitaireGame` objects (see `lib/solitaire/types.ts`).
Every move list is validated through chess.js (each SAN is a legal move).

## Optional per-move annotations (template — currently unpopulated)

Games may include an optional `annotations` map, keyed by **ply index** (0-based
half-move number), to attach authored content to specific moves. It is entirely
optional: games without it work unchanged, and each field within an annotation
is independently optional.

> Only add **verifiable, human-authored** content here. Do **not** fabricate
> analysis. The play screen already shows always-correct *mechanical* move facts
> (capture/check/castle/mate, via `describeMove`) automatically — annotations are
> for genuine human commentary and are rendered distinctly from those facts.

### Ply indexing

`moves` is a flat SAN array. Ply `0` is White's 1st move, ply `1` is Black's 1st,
ply `2` is White's 2nd, and so on. So **ply `n` → full move `floor(n / 2) + 1`**,
White if `n` is even, Black if `n` is odd. Annotate the ply whose move you want
to comment on.

### Fields (`MoveAnnotation`)

| field | type | shown in play UI |
| --- | --- | --- |
| `comment` | `string` | inline note under the move feedback once the move is played |
| `explanation` | `string` | revealed on demand via a "📖 Reveal explanation" button (after solved/revealed) |
| `alternatives` | `{ san, label?, note }[]` | if the learner guesses one of these `san`s, they get tailored feedback instead of the generic "wrong" message |

`alternatives[].san` is matched ignoring `+`, `#`, `!`, and `?` decorations.

### Example

Add an `annotations` object to any game in `games.json` (here annotating
ply `24` = White's 13th move, and ply `27` = Black's 14th move):

```json
{
  "id": "opera-game-1858",
  "...": "...other fields...",
  "moves": ["e4", "e5", "Nf3", "d6", "..."],
  "annotations": {
    "24": {
      "comment": "The start of the final combination.",
      "explanation": "Rxd7 removes the last defender; every Black piece is overloaded, so the rook sacrifice opens the d-file decisively.",
      "alternatives": [
        { "san": "Bxd7", "label": "Also winning", "note": "Keeps material level but lets Black trade off the attackers." }
      ]
    },
    "27": {
      "explanation": "Now the back-rank mate net is inescapable."
    }
  }
}
```

When you populate these, the "Reveal explanation" affordance and tailored
alternative feedback light up automatically — no code changes needed.
