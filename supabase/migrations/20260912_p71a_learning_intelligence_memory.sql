-- P71A: additive long-term learning memory and diagnostic records.
-- Existing progress, SRS, mastery, adaptive, auth and learning_sync tables are untouched.

create table if not exists public.learning_memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  memory_type text not null check (memory_type in ('milestone','achievement','weakness_snapshot','learning_pattern','improvement_snapshot')),
  signature text not null check (char_length(signature) between 1 and 180),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 500),
  signal jsonb not null default '{}'::jsonb check (jsonb_typeof(signal) = 'object'),
  source text not null default 'learning-evidence' check (char_length(source) <= 80),
  occurred_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_type, signature)
);

create table if not exists public.learning_diagnostic_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill_scores jsonb not null check (jsonb_typeof(skill_scores) = 'object'),
  weakest_skill text check (weakest_skill is null or weakest_skill in ('vocabulary','grammar','listening','reading','speaking','writing','pronunciation')),
  strongest_skill text check (strongest_skill is null or strongest_skill in ('vocabulary','grammar','listening','reading','speaking','writing','pronunciation')),
  overall_score integer check (overall_score is null or overall_score between 0 and 100),
  evidence_coverage integer not null default 0 check (evidence_coverage between 0 and 100),
  generated_at timestamptz not null default now()
);

create table if not exists public.learning_prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  diagnostic_id uuid references public.learning_diagnostic_reports(id) on delete set null,
  duration_days integer not null check (duration_days between 7 and 30),
  priorities text[] not null default '{}'::text[],
  plan jsonb not null check (jsonb_typeof(plan) = 'array'),
  status text not null default 'active' check (status in ('active','completed','replaced')),
  review_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_goal_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('topik','study','work','travel','conversation')),
  target text not null default '' check (char_length(target) <= 80),
  duration_months integer not null check (duration_months between 1 and 24),
  assumptions jsonb not null default '{}'::jsonb check (jsonb_typeof(assumptions) = 'object'),
  timeline jsonb not null check (jsonb_typeof(timeline) = 'array'),
  disclaimer text not null check (char_length(disclaimer) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.learning_memory_events enable row level security;
alter table public.learning_diagnostic_reports enable row level security;
alter table public.learning_prescriptions enable row level security;
alter table public.learning_goal_simulations enable row level security;

create policy "users manage own learning memory events" on public.learning_memory_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own diagnostic reports" on public.learning_diagnostic_reports for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own learning prescriptions" on public.learning_prescriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own goal simulations" on public.learning_goal_simulations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists learning_memory_events_timeline_idx on public.learning_memory_events(user_id, occurred_at desc);
create index if not exists learning_memory_events_type_idx on public.learning_memory_events(user_id, memory_type, updated_at desc);
create index if not exists learning_diagnostic_reports_user_idx on public.learning_diagnostic_reports(user_id, generated_at desc);
create index if not exists learning_prescriptions_active_idx on public.learning_prescriptions(user_id, status, review_on);
create index if not exists learning_goal_simulations_user_idx on public.learning_goal_simulations(user_id, created_at desc);

comment on table public.learning_memory_events is 'Owner-only derived learning signals; credentials, raw chats, private notes and audio are forbidden.';
comment on table public.learning_diagnostic_reports is 'Evidence-based seven-skill learning health reports; missing evidence remains null.';
comment on table public.learning_prescriptions is 'Short learning plans derived from a diagnostic without changing the adaptive engine.';
comment on table public.learning_goal_simulations is 'Non-guaranteed learning timelines based on user-selected goals and study assumptions.';
