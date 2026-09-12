-- P71B: additive real Korean practice records.
-- Existing auth, CloudSync, SRS, mastery, conversation and voice tables are untouched.
-- Audio blobs and raw source documents are intentionally not stored in these tables.

create table if not exists public.real_korean_pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_id text not null check (char_length(target_id) between 1 and 80),
  target_text text not null check (char_length(target_text) between 1 and 120),
  recognized_text text not null default '' check (char_length(recognized_text) <= 300),
  accuracy integer not null check (accuracy between 0 and 100),
  missing_sound text not null default '' check (char_length(missing_sound) <= 40),
  wrong_sound text not null default '' check (char_length(wrong_sound) <= 40),
  feedback text not null default '' check (char_length(feedback) <= 500),
  analysis_method text not null default 'transparent-text-fallback' check (char_length(analysis_method) <= 80),
  created_at timestamptz not null default now()
);

create table if not exists public.sentence_mining_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('film','webtoon','youtube','document')),
  source_label text not null default '' check (char_length(source_label) <= 80),
  sentence text not null check (char_length(sentence) between 1 and 300),
  translation text not null default '' check (char_length(translation) <= 300),
  vocabulary jsonb not null default '[]'::jsonb check (jsonb_typeof(vocabulary) = 'array'),
  grammar jsonb not null default '[]'::jsonb check (jsonb_typeof(grammar) = 'array'),
  flashcard_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.real_korean_media_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  media_id text not null check (char_length(media_id) between 1 and 100),
  line_index integer not null default 0 check (line_index >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, media_id)
);

create table if not exists public.real_korean_scenario_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id text not null check (char_length(scenario_id) between 1 and 100),
  topic text not null check (topic in ('restaurant','airport','interview','hospital','workplace')),
  learner_answer text not null check (char_length(learner_answer) between 1 and 500),
  meaning_score integer not null check (meaning_score between 0 and 100),
  grammar_score integer not null check (grammar_score between 0 and 100),
  naturalness_score integer not null check (naturalness_score between 0 and 100),
  context_score integer not null check (context_score between 0 and 100),
  overall_score integer not null check (overall_score between 0 and 100),
  ai_status text not null default 'not-requested' check (ai_status in ('not-requested','available','fallback')),
  created_at timestamptz not null default now()
);

create table if not exists public.real_korean_shadowing_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shadowing_id text not null check (char_length(shadowing_id) between 1 and 100),
  target_text text not null check (char_length(target_text) between 1 and 300),
  recognized_text text not null default '' check (char_length(recognized_text) <= 300),
  playback_speed numeric(3,2) not null default 1 check (playback_speed between 0.5 and 1.5),
  accuracy integer not null check (accuracy between 0 and 100),
  fluency integer not null check (fluency between 0 and 100),
  overall_score integer not null check (overall_score between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.real_korean_pronunciation_attempts enable row level security;
alter table public.sentence_mining_items enable row level security;
alter table public.real_korean_media_progress enable row level security;
alter table public.real_korean_scenario_attempts enable row level security;
alter table public.real_korean_shadowing_attempts enable row level security;

create policy "users manage own real pronunciation attempts" on public.real_korean_pronunciation_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own mined sentences" on public.sentence_mining_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own real media progress" on public.real_korean_media_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own real scenario attempts" on public.real_korean_scenario_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own real shadowing attempts" on public.real_korean_shadowing_attempts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists real_pronunciation_user_time_idx on public.real_korean_pronunciation_attempts(user_id, created_at desc);
create index if not exists sentence_mining_user_time_idx on public.sentence_mining_items(user_id, updated_at desc);
create index if not exists real_media_user_updated_idx on public.real_korean_media_progress(user_id, updated_at desc);
create index if not exists real_scenario_user_time_idx on public.real_korean_scenario_attempts(user_id, created_at desc);
create index if not exists real_shadowing_user_time_idx on public.real_korean_shadowing_attempts(user_id, created_at desc);

comment on table public.real_korean_pronunciation_attempts is 'Owner-only scores and short recognized text; audio storage is forbidden.';
comment on table public.sentence_mining_items is 'Owner-only short sentence notes; full films, videos, webtoons and source documents are forbidden.';
comment on table public.real_korean_media_progress is 'Owner-only progress for approved original learning dialogues.';
comment on table public.real_korean_scenario_attempts is 'Owner-only local-first scenario evaluation with optional AI status.';
comment on table public.real_korean_shadowing_attempts is 'Owner-only shadowing scores and short recognized text; audio storage is forbidden.';
