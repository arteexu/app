-- ─── profiles.avatar_icon ─────────────────────────────────────────────────────
-- Stores the user's chosen chess-themed avatar glyph (e.g. '♞', '🏆'). Nullable;
-- when null the UI falls back to the display-name initial. Idempotent so it is
-- safe to re-run.
alter table profiles add column if not exists avatar_icon text;

-- RLS: the existing "Users can update own profile" policy (using auth.uid() = id)
-- already governs updates to this table, so users can update their own avatar_icon
-- and cannot touch others'. No new policy is required.
