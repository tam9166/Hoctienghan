-- P44: user-scoped progress for choice-based immersive experiences.
-- No raw free text, transcript, microphone recording or audio is stored here.
create table if not exists public.immersive_korean_world_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  immersion_level text not null default 'beginner' check (immersion_level in ('beginner','intermediate','advanced')),
  daily_runs integer not null default 0 check (daily_runs >= 0),
  story_runs integer not null default 0 check (story_runs >= 0),
  culture_runs integer not null default 0 check (culture_runs >= 0),
  survival_runs integer not null default 0 check (survival_runs >= 0),
  daily_best_score smallint not null default 0 check (daily_best_score between 0 and 100),
  story_best_score smallint not null default 0 check (story_best_score between 0 and 100),
  culture_best_score smallint not null default 0 check (culture_best_score between 0 and 100),
  updated_at timestamptz not null default now()
);
alter table public.immersive_korean_world_profiles enable row level security;
drop policy if exists "users read own immersive profile" on public.immersive_korean_world_profiles;
create policy "users read own immersive profile" on public.immersive_korean_world_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own immersive profile" on public.immersive_korean_world_profiles;
create policy "users create own immersive profile" on public.immersive_korean_world_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own immersive profile" on public.immersive_korean_world_profiles;
create policy "users update own immersive profile" on public.immersive_korean_world_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.immersive_korean_world_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_type text not null check (experience_type in ('city','roleplay','daily-life','story','culture','survival')),
  content_id text not null check (char_length(content_id) between 1 and 100),
  immersion_level text not null check (immersion_level in ('beginner','intermediate','advanced')),
  score smallint check (score between 0 and 100),
  completed boolean not null default false,
  selected_choice_ids jsonb not null default '[]'::jsonb,
  raw_text_stored boolean not null default false check (raw_text_stored = false),
  raw_audio_stored boolean not null default false check (raw_audio_stored = false),
  created_at timestamptz not null default now()
);
create index if not exists immersive_world_events_user_created_idx on public.immersive_korean_world_events (user_id, created_at desc);
create index if not exists immersive_world_events_user_type_idx on public.immersive_korean_world_events (user_id, experience_type, completed);
alter table public.immersive_korean_world_events enable row level security;
drop policy if exists "users read own immersive events" on public.immersive_korean_world_events;
create policy "users read own immersive events" on public.immersive_korean_world_events for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own immersive events" on public.immersive_korean_world_events;
create policy "users create own immersive events" on public.immersive_korean_world_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own immersive events" on public.immersive_korean_world_events;
create policy "users update own immersive events" on public.immersive_korean_world_events for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on table public.immersive_korean_world_profiles is 'Aggregate P44 learner progress only; protected by per-user RLS.';
comment on table public.immersive_korean_world_events is 'Choice identifiers and scores only; excludes free text, transcripts and audio.';
