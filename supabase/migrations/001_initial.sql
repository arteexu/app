-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- ─── user_progress ────────────────────────────────────────────────────────────
-- Tracks which steps a user has completed within each lesson.
create table if not exists user_progress (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  course_id           text not null,
  lesson_id           text not null,
  completed_step_ids  text[] not null default '{}',
  is_lesson_complete  boolean not null default false,
  completed_at        timestamptz,
  updated_at          timestamptz not null default now(),
  unique (user_id, lesson_id)
);

alter table user_progress enable row level security;
create policy "Users can read own progress"  on user_progress for select using (auth.uid() = user_id);
create policy "Users can insert own progress" on user_progress for insert with check (auth.uid() = user_id);
create policy "Users can update own progress" on user_progress for update using (auth.uid() = user_id);

-- ─── user_streaks ─────────────────────────────────────────────────────────────
create table if not exists user_streaks (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  current_streak      int not null default 0,
  longest_streak      int not null default 0,
  last_activity_date  date
);

alter table user_streaks enable row level security;
create policy "Users can read own streak"  on user_streaks for select using (auth.uid() = user_id);
create policy "Users can insert own streak" on user_streaks for insert with check (auth.uid() = user_id);
create policy "Users can update own streak" on user_streaks for update using (auth.uid() = user_id);

-- ─── lesson_attempts ──────────────────────────────────────────────────────────
-- One row per step attempt — used to calculate first-attempt mastery rate.
create table if not exists lesson_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  lesson_id     text not null,
  step_id       text not null,
  is_correct    boolean not null,
  attempted_at  timestamptz not null default now()
);

alter table lesson_attempts enable row level security;
create policy "Users can read own attempts"  on lesson_attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts" on lesson_attempts for insert with check (auth.uid() = user_id);

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Stores display name; created automatically on sign-up via trigger.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "Users can read own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  insert into public.user_streaks (user_id) values (new.id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
