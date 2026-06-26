-- ─── Matchmaking (ranked head-to-head Solitaire) ─────────────────────────────
-- Adds asynchronous "Find Match" matchmaking on top of Multiplayer Mode.
--
-- FLOW: a player clicks "Find opponent" → we try to pair them, in order:
--   (a) LIVE  — another user currently searching in `match_queue` (claimed
--               atomically by the mm_find_live_opponent() SECURITY DEFINER fn);
--   (b) GHOST — if nobody is queued, an opponent drawn from another user's PAST
--               `solitaire_scores` attempt on a randomly chosen ranked game;
--   (c) BOT   — if no ghosts exist, a par/baseline bot.
-- Both players are given the SAME randomly-selected ranked engine game (prefer
-- the anti-cheat `eng-med-*` self-play games). Higher score by the existing
-- solitaire-scoring wins; tie = draw. Elo is awarded HEAD-TO-HEAD.
--
-- HONESTY: this is async (no websockets / no real-time synchronized board). A
-- live pairing's two players still solve on their own time; the match resolves
-- when both have submitted a score. The ghost/bot paths resolve instantly so the
-- searcher is never stuck waiting.
--
-- This migration OWNS ONLY the matchmaking objects (match_queue, matches, and
-- the mm_find_live_opponent function). It does not touch engine_games rows or
-- migrations 003/004/005.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · match_queue — players currently searching for a live opponent
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists match_queue (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  elo_snapshot  integer not null default 1200,
  joined_at     timestamptz not null default now(),
  status        text not null default 'searching' check (status in ('searching', 'matched', 'cancelled'))
);

create index if not exists match_queue_status_idx on match_queue (status, joined_at);

alter table match_queue enable row level security;

-- The queue is world-readable so clients can see who is waiting; each user may
-- only create/update/remove their OWN queue row.
drop policy if exists "Anyone can read queue" on match_queue;
create policy "Anyone can read queue" on match_queue for select using (true);

drop policy if exists "Users insert own queue row" on match_queue;
create policy "Users insert own queue row" on match_queue for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own queue row" on match_queue;
create policy "Users update own queue row" on match_queue for update using (auth.uid() = user_id);

drop policy if exists "Users delete own queue row" on match_queue;
create policy "Users delete own queue row" on match_queue for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · matches — one ranked head-to-head game (live, ghost, or bot)
-- ═══════════════════════════════════════════════════════════════════════════
-- `player_a` is always the initiator (the live human who pressed Find Match).
-- `player_b` is the opponent: another live user, the ghost's user id, or NULL
-- for a bot. Because RLS only lets a user write their OWN user_ratings row, each
-- side's rating is applied SELF-SERVICE: `a_applied`/`b_applied` track whether a
-- player's rating delta has been written. Ghost/bot opponents never change Elo.
create table if not exists matches (
  id                   uuid primary key default gen_random_uuid(),
  game_id              text not null references engine_games(id),
  player_a             uuid not null references auth.users(id) on delete cascade,
  player_b             uuid references auth.users(id) on delete set null,
  is_ghost             boolean not null default false,
  opponent_kind        text not null default 'live' check (opponent_kind in ('live', 'ghost', 'bot')),
  opponent_label       text,                 -- display name shown on the result screen
  player_a_score       integer,
  player_b_score       integer,              -- ghost's stored score / bot par when not live
  player_a_elo_before  integer,
  player_a_elo_after   integer,
  player_b_elo_before  integer,
  player_b_elo_after   integer,
  a_applied            boolean not null default false,  -- player_a rating written to user_ratings
  b_applied            boolean not null default false,  -- player_b rating written (live only)
  winner               text check (winner in ('a', 'b', 'draw')),
  status               text not null default 'pending' check (status in ('pending', 'active', 'complete')),
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create index if not exists matches_player_a_idx on matches (player_a);
create index if not exists matches_player_b_idx on matches (player_b);
create index if not exists matches_status_idx   on matches (status);

alter table matches enable row level security;

-- Read matches you're in (for resume/active play) and any COMPLETED match (so
-- there is a public match history, like the leaderboards).
drop policy if exists "Read own or completed matches" on matches;
create policy "Read own or completed matches" on matches for select using (
  auth.uid() = player_a or auth.uid() = player_b or status = 'complete'
);

-- A user may only create a match as themselves (the initiator).
drop policy if exists "Insert own match" on matches;
create policy "Insert own match" on matches for insert with check (auth.uid() = player_a);

-- Either participant may update the match (submit a score, finalize).
drop policy if exists "Update participant match" on matches;
create policy "Update participant match" on matches for update using (
  auth.uid() = player_a or auth.uid() = player_b
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · mm_find_live_opponent — atomic live pairing (race-safe)
-- ═══════════════════════════════════════════════════════════════════════════
-- Claims the oldest OTHER searching player from the queue and creates an active
-- live match against them, then removes the caller from the queue. SECURITY
-- DEFINER + FOR UPDATE SKIP LOCKED makes the claim atomic so two simultaneous
-- searchers can't grab the same opponent. Returns the new match id, or NULL when
-- nobody else is waiting (caller then falls back to ghost/bot). The caller must
-- already be enrolled in match_queue before calling.
create or replace function public.mm_find_live_opponent(p_game_id text, p_elo integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_opp record;
  v_match_id uuid;
begin
  if v_me is null then
    return null;
  end if;

  select user_id, elo_snapshot
    into v_opp
  from match_queue
  where status = 'searching'
    and user_id <> v_me
  order by joined_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  insert into matches (game_id, player_a, player_b, opponent_kind, status,
                       player_a_elo_before, player_b_elo_before)
  values (p_game_id, v_me, v_opp.user_id, 'live', 'active', p_elo, v_opp.elo_snapshot)
  returning id into v_match_id;

  -- Take both players out of the searching pool.
  update match_queue set status = 'matched' where user_id = v_opp.user_id;
  delete from match_queue where user_id = v_me;

  return v_match_id;
end;
$$;

grant execute on function public.mm_find_live_opponent(text, integer) to authenticated;
