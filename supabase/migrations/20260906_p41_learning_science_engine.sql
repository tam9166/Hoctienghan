-- P41 Learning Science Engine: private metrics only; no raw answers or audio.
create table if not exists public.learning_science_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  model_version text not null default 'p41-heuristic-v1',
  preferred_difficulty text not null default 'normal' check (preferred_difficulty in ('easy','normal','hard')),
  daily_capacity_minutes smallint not null default 20 check (daily_capacity_minutes between 5 and 60),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_science_recall_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_type text not null check (knowledge_type in ('vocabulary','grammar','listening','reading','writing','speaking')),
  knowledge_id text not null,
  correct boolean not null,
  confidence smallint not null check (confidence between 1 and 5),
  response_ms integer check (response_ms is null or response_ms between 0 and 3600000),
  difficulty text not null check (difficulty in ('easy','normal','hard')),
  forgetting_probability numeric(5,4) check (forgetting_probability is null or forgetting_probability between 0 and 1),
  raw_answer_stored boolean not null default false check (raw_answer_stored = false),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_science_session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_type text not null check (session_type in ('active_recall','interleaved','daily_plan')),
  item_count smallint not null default 0 check (item_count between 0 and 500),
  correct_count smallint not null default 0 check (correct_count between 0 and item_count),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  skill_mix jsonb not null default '{}'::jsonb,
  fatigue_signal text not null default 'low' check (fatigue_signal in ('low','medium','high')),
  raw_answers_stored boolean not null default false check (raw_answers_stored = false),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_science_misconceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_key text not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  confidence text not null default 'insufficient' check (confidence in ('insufficient','developing','high')),
  status text not null default 'observed' check (status in ('observed','practising','resolved')),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_key)
);

create index if not exists learning_science_recall_user_created_idx on public.learning_science_recall_events(user_id, created_at desc);
create index if not exists learning_science_recall_knowledge_idx on public.learning_science_recall_events(user_id, knowledge_type, knowledge_id);
create index if not exists learning_science_sessions_user_created_idx on public.learning_science_session_summaries(user_id, created_at desc);
create index if not exists learning_science_misconceptions_user_idx on public.learning_science_misconceptions(user_id, status, updated_at desc);

alter table public.learning_science_profiles enable row level security;
alter table public.learning_science_recall_events enable row level security;
alter table public.learning_science_session_summaries enable row level security;
alter table public.learning_science_misconceptions enable row level security;

create policy "learning science profiles are private" on public.learning_science_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning science recall is private" on public.learning_science_recall_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning science sessions are private" on public.learning_science_session_summaries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning science misconceptions are private" on public.learning_science_misconceptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.learning_science_recall_events is 'P41 derived recall metrics only. Raw answers and audio are prohibited.';
comment on table public.learning_science_session_summaries is 'Private learning-session summaries; not medical or diagnostic data.';
