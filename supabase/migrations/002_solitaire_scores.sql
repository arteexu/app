-- ─── solitaire_scores ─────────────────────────────────────────────────────────
-- Stores results for the "Solitaire Chess" mode (guess a grandmaster's moves).
--
-- The MVP persists scores in localStorage and writes here only when the table
-- exists (the app feature-detects and never crashes if it is absent — see
-- lib/solitaire/supabase-scores.ts). Apply this migration to enable durable,
-- cross-device scores and to unlock the future "all users + difficulty-based
-- leaderboard" direction.
--
-- Forward-looking design notes:
--   * `difficulty` is denormalized onto each row so historical scores remain
--     meaningful even if a game's curated difficulty is re-rated later.
--   * `score` is already difficulty-weighted by lib/solitaire-scoring.ts, so
--     leaderboards can rank on it directly.
--   * One row per attempt (not upsert) → keeps full history for analytics;
--     "best"/"last" are derived with queries (see the helper view below).

create table if not exists solitaire_scores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  game_id        text not null,                       -- SolitaireGame.id (from content JSON)
  side           text not null check (side in ('white', 'black')),
  score          integer not null default 0,          -- difficulty-weighted
  accuracy       integer not null default 0,          -- 0–100 (correct / total guesses)
  moves_matched  integer not null default 0,
  total_moves    integer not null default 0,
  best_streak    integer not null default 0,
  difficulty     integer not null default 1 check (difficulty between 1 and 5),
  created_at     timestamptz not null default now()
);

create index if not exists solitaire_scores_user_idx       on solitaire_scores (user_id);
create index if not exists solitaire_scores_game_idx        on solitaire_scores (game_id);
create index if not exists solitaire_scores_leaderboard_idx on solitaire_scores (game_id, score desc);

alter table solitaire_scores enable row level security;

-- Users can read and write only their own rows. (A future public leaderboard
-- would add a separate read policy or a SECURITY DEFINER aggregate view.)
create policy "Users can read own solitaire scores"
  on solitaire_scores for select using (auth.uid() = user_id);
create policy "Users can insert own solitaire scores"
  on solitaire_scores for insert with check (auth.uid() = user_id);

-- Convenience view: each user's best score per game/side. Safe to query from
-- the app once the table exists.
create or replace view solitaire_best_scores as
select distinct on (user_id, game_id, side)
  user_id, game_id, side, score, accuracy, moves_matched, total_moves,
  best_streak, difficulty, created_at
from solitaire_scores
order by user_id, game_id, side, score desc, created_at desc;
