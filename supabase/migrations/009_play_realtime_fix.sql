-- ─── Fix: live opponent moves not delivered over Realtime ────────────────────
-- SYMPTOM: in Play vs Human, draw offers/acceptance (UPDATEs on play_games)
-- propagated in real time, but the opponent's MOVES (INSERTs on play_moves) did
-- not appear for the other player.
--
-- ROOT CAUSE: Supabase Realtime `postgres_changes` only delivers a row to a
-- subscriber if that subscriber is allowed to SELECT it under RLS, and the
-- authorization check is evaluated per-change against the row. play_games' SELECT
-- policy is COLUMN-ONLY (auth.uid() = white_id/black_id or status='complete') and
-- authorizes reliably — which is why draw offers worked. play_moves' SELECT policy
-- was a CROSS-TABLE SUBQUERY into play_games (exists (select 1 from play_games …)),
-- which the Realtime authorizer does not evaluate reliably, so the INSERT events
-- were silently dropped for the receiving participant.
--
-- FIX: denormalize the two participant ids onto play_moves (auto-populated by a
-- trigger so the client insert path is unchanged) and replace the subquery SELECT
-- policy with a COLUMN-ONLY one. Idempotent and reproducible.

-- 1 · Participant columns on play_moves (nullable; filled by the trigger below).
alter table play_moves add column if not exists white_id uuid references auth.users(id) on delete set null;
alter table play_moves add column if not exists black_id uuid references auth.users(id) on delete set null;

-- 2 · Auto-fill participants from the parent game on insert (SECURITY DEFINER so
--     it can read play_games regardless of the inserting user's policies).
create or replace function public.play_moves_fill_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.white_id is null or new.black_id is null then
    select g.white_id, g.black_id
      into new.white_id, new.black_id
    from play_games g
    where g.id = new.game_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_play_moves_fill on play_moves;
create trigger trg_play_moves_fill
  before insert on play_moves
  for each row execute function public.play_moves_fill_participants();

-- 3 · Backfill existing rows so historical moves stay readable to participants.
update play_moves m
set white_id = g.white_id,
    black_id = g.black_id
from play_games g
where g.id = m.game_id
  and (m.white_id is null or m.black_id is null);

-- 4 · Replace the subquery SELECT policy with a Realtime-friendly column-only one.
drop policy if exists "Read play moves of readable games" on play_moves;
drop policy if exists "Read play moves participant" on play_moves;
create policy "Read play moves participant" on play_moves for select using (
  auth.uid() = white_id or auth.uid() = black_id
);

-- 5 · Keep INSERT secure (author must be self and a participant). INSERT policies
--     do not affect Realtime delivery; re-created idempotently for completeness.
drop policy if exists "Insert move into own play game" on play_moves;
create policy "Insert move into own play game" on play_moves for insert with check (
  auth.uid() = by_user
  and exists (
    select 1 from play_games g
    where g.id = play_moves.game_id
      and (auth.uid() = g.white_id or auth.uid() = g.black_id)
  )
);

-- 6 · Full row image on the WAL (defensive: guarantees Realtime always carries
--     the columns the SELECT policy needs to authorize a change).
alter table play_moves replica identity full;

-- 7 · Ensure play_moves is in the Realtime publication (no-op if already added).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table play_moves;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
