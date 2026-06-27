-- ─── Play Chess (full games vs Bot and live vs Human) ────────────────────────
-- Adds the backend for the "Play" feature: COMPLETE normal chess games (not
-- Solitaire puzzles) in two modes —
--   • vs Bot   — a full game against a client-side Stockfish at a chosen strength.
--   • vs Human — a true real-time game with a chess clock, matchmaking, and a
--                server-persisted authoritative move list relayed via Supabase
--                Realtime (postgres_changes on play_games + play_moves).
--
-- The Play rating is kept SEPARATE from the Solitaire competitive rating
-- (public.user_ratings): it lives in its own table public.play_ratings so the
-- two ladders never mix. Head-to-head Elo math is the same shared formula
-- (lib/multiplayer/elo.ts computeHeadToHead).
--
-- This migration OWNS ONLY the new Play objects (play_ratings, play_games,
-- play_moves, play_queue, the play_find_live_opponent RPC, and the
-- play_leaderboard view). It does NOT touch migrations 003–006 or their data.
--
-- Idempotent: create ... if not exists / drop policy if exists, safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · play_ratings — one SEPARATE Play Elo rating per user
-- ═══════════════════════════════════════════════════════════════════════════
-- New players start at 1200 (same baseline as Solitaire, but a distinct ladder).
-- World-readable for the Play leaderboard; only the owner may create/update.
create table if not exists play_ratings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  elo           integer not null default 1200,
  peak_elo      integer not null default 1200,
  games_played  integer not null default 0,
  wins          integer not null default 0,
  losses        integer not null default 0,
  draws         integer not null default 0,
  updated_at    timestamptz not null default now()
);

create index if not exists play_ratings_elo_idx on play_ratings (elo desc);

alter table play_ratings enable row level security;

drop policy if exists "Anyone can read play ratings" on play_ratings;
create policy "Anyone can read play ratings"
  on play_ratings for select using (true);

drop policy if exists "Users can insert own play rating" on play_ratings;
create policy "Users can insert own play rating"
  on play_ratings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own play rating" on play_ratings;
create policy "Users can update own play rating"
  on play_ratings for update using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · play_games — one full chess game (vs bot or live vs human)
-- ═══════════════════════════════════════════════════════════════════════════
-- For a BOT game exactly one of white_id/black_id is the human and the other is
-- NULL (is_bot = true, bot_elo/bot_level describe the engine). For a LIVE game
-- both white_id and black_id are real users. The authoritative move list lives in
-- play_moves; play_games carries the live mirror (fen, turn, clocks) so a joining
-- or reconnecting client can render the current state in one read.
--
-- Ratings use the same deferred "self-service" pattern as matches (006): because
-- RLS only lets a user write their OWN play_ratings row, each side applies its own
-- delta (white_applied / black_applied) — the finalizer writes its own rating
-- immediately and the opponent applies theirs on next Play screen mount.
create table if not exists play_games (
  id                   uuid primary key default gen_random_uuid(),
  mode                 text not null check (mode in ('bot', 'human')),

  white_id             uuid references auth.users(id) on delete set null,
  black_id             uuid references auth.users(id) on delete set null,
  is_bot               boolean not null default false,
  bot_elo              integer,                 -- engine's nominal Elo (for rating)
  bot_level            text,                    -- labeled level id (e.g. 'intermediate')

  -- Time control (base + increment, Fischer). 0 increment allowed.
  tc_base_seconds      integer not null default 300,
  tc_increment_seconds integer not null default 0,

  status               text not null default 'waiting'
                         check (status in ('waiting', 'active', 'complete', 'aborted')),
  -- result/winner/end_reason are set when status = 'complete'.
  result               text check (result in ('1-0', '0-1', '1/2-1/2')),
  winner               text check (winner in ('white', 'black', 'draw')),
  end_reason           text check (end_reason in (
                         'checkmate', 'resign', 'timeout', 'stalemate',
                         'draw_agreement', 'insufficient_material',
                         'threefold', 'fifty_move', 'abandon')),

  -- Live mirror of the game state (authoritative list is play_moves).
  fen                  text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn                  text not null default '',
  turn                 text not null default 'white' check (turn in ('white', 'black')),
  ply                  integer not null default 0,
  white_clock_ms       integer not null default 300000,
  black_clock_ms       integer not null default 300000,
  -- Wall-clock instant the side-to-move's clock started ticking (server time).
  turn_started_at      timestamptz,

  -- Pending draw offer (the color that offered), cleared on accept/decline/move.
  draw_offer_by        text check (draw_offer_by in ('white', 'black')),

  -- Head-to-head Play-rating bookkeeping (live games rate both sides).
  white_elo_before     integer,
  white_elo_after      integer,
  black_elo_before     integer,
  black_elo_after      integer,
  white_applied        boolean not null default false,
  black_applied        boolean not null default false,

  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists play_games_white_idx  on play_games (white_id);
create index if not exists play_games_black_idx  on play_games (black_id);
create index if not exists play_games_status_idx on play_games (status);

alter table play_games enable row level security;

-- Read games you're a participant in, plus any COMPLETED game (public history).
drop policy if exists "Read own or completed play games" on play_games;
create policy "Read own or completed play games" on play_games for select using (
  auth.uid() = white_id or auth.uid() = black_id or status = 'complete'
);

-- A user may create a game only as one of its participants (the bot path creates
-- its own game; the live path is created by the SECURITY DEFINER RPC below).
drop policy if exists "Insert own play game" on play_games;
create policy "Insert own play game" on play_games for insert with check (
  auth.uid() = white_id or auth.uid() = black_id
);

-- Either participant may update the game (relay a move, clocks, offer/accept
-- draw, resign, finalize, apply own rating).
drop policy if exists "Update participant play game" on play_games;
create policy "Update participant play game" on play_games for update using (
  auth.uid() = white_id or auth.uid() = black_id
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · play_moves — the authoritative, server-persisted move list
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per ply. unique(game_id, ply) makes move relay idempotent and prevents
-- two clients racing the same ply. Clients subscribe via postgres_changes INSERT
-- to receive the opponent's moves live.
create table if not exists play_moves (
  id             bigint generated always as identity primary key,
  game_id        uuid not null references play_games(id) on delete cascade,
  ply            integer not null,             -- 1-based half-move number
  san            text not null,
  uci            text not null,
  fen_after      text not null,
  color          text not null check (color in ('white', 'black')),
  by_user        uuid references auth.users(id) on delete set null,
  white_clock_ms integer not null,
  black_clock_ms integer not null,
  created_at     timestamptz not null default now(),
  unique (game_id, ply)
);

create index if not exists play_moves_game_idx on play_moves (game_id, ply);

alter table play_moves enable row level security;

-- You can read moves of a game you can read (participant or a completed game).
drop policy if exists "Read play moves of readable games" on play_moves;
create policy "Read play moves of readable games" on play_moves for select using (
  exists (
    select 1 from play_games g
    where g.id = play_moves.game_id
      and (auth.uid() = g.white_id or auth.uid() = g.black_id or g.status = 'complete')
  )
);

-- You may append a move only to a game you're a participant in, and you must
-- stamp yourself as the author.
drop policy if exists "Insert move into own play game" on play_moves;
create policy "Insert move into own play game" on play_moves for insert with check (
  auth.uid() = by_user
  and exists (
    select 1 from play_games g
    where g.id = play_moves.game_id
      and (auth.uid() = g.white_id or auth.uid() = g.black_id)
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · play_queue — players waiting for a live opponent (per time control)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists play_queue (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  elo_snapshot         integer not null default 1200,
  tc_base_seconds      integer not null default 300,
  tc_increment_seconds integer not null default 0,
  joined_at            timestamptz not null default now(),
  status               text not null default 'searching'
                         check (status in ('searching', 'matched', 'cancelled'))
);

create index if not exists play_queue_tc_idx on play_queue (tc_base_seconds, tc_increment_seconds, status, joined_at);

alter table play_queue enable row level security;

drop policy if exists "Anyone can read play queue" on play_queue;
create policy "Anyone can read play queue" on play_queue for select using (true);

drop policy if exists "Users insert own play queue row" on play_queue;
create policy "Users insert own play queue row" on play_queue for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own play queue row" on play_queue;
create policy "Users update own play queue row" on play_queue for update using (auth.uid() = user_id);

drop policy if exists "Users delete own play queue row" on play_queue;
create policy "Users delete own play queue row" on play_queue for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · play_find_live_opponent — atomic live pairing (race-safe)
-- ═══════════════════════════════════════════════════════════════════════════
-- Claims the oldest OTHER searching player with the SAME time control and creates
-- an 'active' live game, assigning colors randomly. The caller becomes one color
-- and the claimed opponent the other. SECURITY DEFINER + FOR UPDATE SKIP LOCKED
-- makes the claim atomic. Returns the new game id, or NULL when nobody else is
-- waiting on that time control. The caller must already be enrolled in play_queue.
create or replace function public.play_find_live_opponent(
  p_tc_base integer,
  p_tc_increment integer,
  p_elo integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_opp record;
  v_game_id uuid;
  v_clock_ms integer := p_tc_base * 1000;
  v_me_is_white boolean := (random() < 0.5);
  v_white uuid;
  v_black uuid;
  v_white_elo integer;
  v_black_elo integer;
begin
  if v_me is null then
    return null;
  end if;

  select user_id, elo_snapshot
    into v_opp
  from play_queue
  where status = 'searching'
    and user_id <> v_me
    and tc_base_seconds = p_tc_base
    and tc_increment_seconds = p_tc_increment
  order by joined_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  if v_me_is_white then
    v_white := v_me;        v_black := v_opp.user_id;
    v_white_elo := p_elo;   v_black_elo := v_opp.elo_snapshot;
  else
    v_white := v_opp.user_id; v_black := v_me;
    v_white_elo := v_opp.elo_snapshot; v_black_elo := p_elo;
  end if;

  insert into play_games (
    mode, white_id, black_id, is_bot,
    tc_base_seconds, tc_increment_seconds,
    status, white_clock_ms, black_clock_ms, turn, turn_started_at, started_at,
    white_elo_before, black_elo_before
  ) values (
    'human', v_white, v_black, false,
    p_tc_base, p_tc_increment,
    'active', v_clock_ms, v_clock_ms, 'white', now(), now(),
    v_white_elo, v_black_elo
  )
  returning id into v_game_id;

  update play_queue set status = 'matched' where user_id = v_opp.user_id;
  delete from play_queue where user_id = v_me;

  return v_game_id;
end;
$$;

grant execute on function public.play_find_live_opponent(integer, integer, integer) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · play_leaderboard — global Play Elo ranking (with display names)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view public.play_leaderboard as
select
  r.user_id,
  coalesce(nullif(p.display_name, ''), 'Anonymous') as display_name,
  r.elo,
  r.peak_elo,
  r.games_played,
  r.wins,
  r.losses,
  r.draws,
  r.updated_at
from play_ratings r
left join profiles p on p.id = r.user_id;

grant select on public.play_leaderboard to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · Realtime — broadcast row changes for live play
-- ═══════════════════════════════════════════════════════════════════════════
-- Clients use postgres_changes on play_moves (opponent moves) and play_games
-- (clocks, draw offers, resign/finalize). Add both to the supabase_realtime
-- publication so changes are streamed. Guarded so re-runs don't error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table play_games;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table play_moves;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
