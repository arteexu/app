-- ─── Multiplayer Mode (async competitive Solitaire) ──────────────────────────
-- This migration adds the backend for "Multiplayer Mode": a shared pool of
-- engine games every user can play, competitive Solitaire scores that are
-- comparable across users, an Elo rating per user, and the views that power the
-- global + per-game leaderboards.
--
-- It is intentionally self-contained and idempotent (create ... if not exists,
-- add column if not exists, drop policy if exists) so it can be applied even if
-- 002_solitaire_scores.sql was never run on this database.
--
-- This is ASYNCHRONOUS multiplayer: players compete on the *same* engine games
-- by score + Elo + leaderboard, not real-time live play. See the app's
-- lib/multiplayer/ for the matching client code and the documented Elo formula.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · engine_games — the shared pool of games everyone can play
-- ═══════════════════════════════════════════════════════════════════════════
-- A canonical, cross-user registry of Solitaire games. Two users playing the
-- same `id` are guaranteed the identical line, so their scores are comparable.
--
--   * Curated master games (source = 'curated') are seeded from the bundled
--     content/solitaire/games.json (see 004_seed_engine_games.sql) and keep
--     their stable JSON ids.
--   * Engine self-play games (source = 'generated') can be promoted into the
--     pool by any signed-in user from the "Generate a game" flow.
create table if not exists engine_games (
  id              text primary key,                       -- stable id (shared by all users)
  title           text not null,
  opening         text not null default 'Unknown',
  eco             text not null default '',
  white           text not null default 'White',
  black           text not null default 'Black',
  event           text,
  year            integer,
  result          text not null check (result in ('1-0', '0-1', '1/2-1/2')),
  difficulty      integer not null default 3 check (difficulty between 1 and 5),
  start_fen       text,                                   -- null = standard start
  max_start_move  integer,
  moves           jsonb not null,                         -- string[] of SAN moves
  is_generated    boolean not null default false,
  source          text not null default 'curated' check (source in ('curated', 'generated')),
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists engine_games_opening_idx on engine_games (opening);
create index if not exists engine_games_source_idx  on engine_games (source);

alter table engine_games enable row level security;

-- Shared pool: anyone (incl. unauthenticated) may read it.
drop policy if exists "Anyone can read engine games" on engine_games;
create policy "Anyone can read engine games"
  on engine_games for select using (true);

-- Signed-in users may contribute generated games; they must stamp themselves as
-- the creator. (Curated games are inserted by the seed migration as the admin
-- role, which bypasses RLS.)
drop policy if exists "Users can add generated engine games" on engine_games;
create policy "Users can add generated engine games"
  on engine_games for insert with check (auth.uid() = created_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · solitaire_scores — ensure it exists, then open it up for leaderboards
-- ═══════════════════════════════════════════════════════════════════════════
-- Mirrors 002_solitaire_scores.sql so this migration stands alone. One row per
-- attempt; "best per game" is derived in the views below.
create table if not exists solitaire_scores (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  game_id        text not null,
  side           text not null check (side in ('white', 'black')),
  score          integer not null default 0,             -- difficulty-weighted
  accuracy       integer not null default 0,             -- 0–100
  moves_matched  integer not null default 0,
  total_moves    integer not null default 0,
  best_streak    integer not null default 0,
  difficulty     integer not null default 1 check (difficulty between 1 and 5),
  created_at     timestamptz not null default now()
);

-- Competitive extras (nullable / defaulted so the existing single-player insert
-- path in lib/solitaire/supabase-scores.ts keeps working untouched).
alter table solitaire_scores add column if not exists match_rate integer not null default 0;
alter table solitaire_scores add column if not exists is_competitive boolean not null default false;
alter table solitaire_scores add column if not exists elo_before integer;
alter table solitaire_scores add column if not exists elo_after integer;
alter table solitaire_scores add column if not exists elo_delta integer;

create index if not exists solitaire_scores_user_idx        on solitaire_scores (user_id);
create index if not exists solitaire_scores_game_idx         on solitaire_scores (game_id);
create index if not exists solitaire_scores_leaderboard_idx  on solitaire_scores (game_id, score desc);

alter table solitaire_scores enable row level security;

-- Keep the original own-row policies if 002 already created them; re-create
-- idempotently so this migration is self-sufficient.
drop policy if exists "Users can insert own solitaire scores" on solitaire_scores;
create policy "Users can insert own solitaire scores"
  on solitaire_scores for insert with check (auth.uid() = user_id);

-- NEW: leaderboards need to read everyone's scores. RLS policies combine with
-- OR, so this permissive read policy supersedes the old own-row read while
-- inserts stay restricted to auth.uid() = user_id.
drop policy if exists "Users can read own solitaire scores" on solitaire_scores;
drop policy if exists "Anyone can read solitaire scores"    on solitaire_scores;
create policy "Anyone can read solitaire scores"
  on solitaire_scores for select using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · user_ratings — one Elo rating per user
-- ═══════════════════════════════════════════════════════════════════════════
-- New players start at 1200. See lib/multiplayer/elo.ts for the exact formula
-- and K-factor schedule. Ratings are world-readable (leaderboard) but only the
-- owner may create/update their own row.
create table if not exists user_ratings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  elo           integer not null default 1200,
  peak_elo      integer not null default 1200,
  games_played  integer not null default 0,
  updated_at    timestamptz not null default now()
);

create index if not exists user_ratings_elo_idx on user_ratings (elo desc);

alter table user_ratings enable row level security;

drop policy if exists "Anyone can read ratings"        on user_ratings;
create policy "Anyone can read ratings"
  on user_ratings for select using (true);

drop policy if exists "Users can insert own rating" on user_ratings;
create policy "Users can insert own rating"
  on user_ratings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own rating" on user_ratings;
create policy "Users can update own rating"
  on user_ratings for update using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · Leaderboard views (expose display names without relaxing profiles RLS)
-- ═══════════════════════════════════════════════════════════════════════════
-- These views are owned by the migration (admin) role, so they read profiles
-- on the viewer's behalf — letting the leaderboard show other players' display
-- names while the profiles table itself stays own-row only. Display names are
-- intentionally public on a leaderboard.

-- Global Elo leaderboard.
create or replace view public.leaderboard as
select
  r.user_id,
  coalesce(nullif(p.display_name, ''), 'Anonymous') as display_name,
  r.elo,
  r.peak_elo,
  r.games_played,
  r.updated_at
from user_ratings r
left join profiles p on p.id = r.user_id;

-- Per-game leaderboard: each user's BEST attempt on each game, with their name.
create or replace view public.solitaire_game_leaderboard as
select distinct on (s.user_id, s.game_id)
  s.user_id,
  s.game_id,
  coalesce(nullif(p.display_name, ''), 'Anonymous') as display_name,
  s.side,
  s.score,
  s.accuracy,
  s.match_rate,
  s.moves_matched,
  s.total_moves,
  s.best_streak,
  s.difficulty,
  s.created_at
from solitaire_scores s
left join profiles p on p.id = s.user_id
order by s.user_id, s.game_id, s.score desc, s.created_at desc;

grant select on public.leaderboard                 to anon, authenticated;
grant select on public.solitaire_game_leaderboard  to anon, authenticated;
