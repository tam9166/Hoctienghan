-- P28: explicit consent, bounded in-app events and user feedback. No credentials or raw learning content.
create table if not exists public.research_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'unknown' check (status in ('unknown','granted','denied')),
  updated_at timestamptz not null default now()
);

alter table public.research_consents enable row level security;
drop policy if exists "users manage own research consent" on public.research_consents;
create policy "users manage own research consent"
  on public.research_consents for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.learning_research_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in ('app_opened','lesson_started','lesson_completed','practice_abandoned','feature_used','review_completed','feedback_submitted','survey_submitted','experiment_exposed','returned')),
  feature text check (feature is null or char_length(feature) between 1 and 120),
  content_id text check (content_id is null or char_length(content_id) between 1 and 120),
  step text check (step is null or char_length(step) between 1 and 80),
  experiment_id text check (experiment_id is null or char_length(experiment_id) between 1 and 80),
  variant text check (variant is null or char_length(variant) between 1 and 60),
  score numeric check (score is null or score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists learning_research_events_created_idx
  on public.learning_research_events (created_at desc, event_name);
alter table public.learning_research_events enable row level security;
drop policy if exists "users read own learning research events" on public.learning_research_events;
create policy "users read own learning research events"
  on public.learning_research_events for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "users create own learning research events" on public.learning_research_events;
create policy "users create own learning research events"
  on public.learning_research_events for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "admins read bounded research events" on public.learning_research_events;
create policy "admins read bounded research events"
  on public.learning_research_events for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create table if not exists public.research_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('lesson_rating','issue_report','feature_suggestion')),
  target_id text check (target_id is null or char_length(target_id) <= 120),
  rating integer check (rating is null or rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

alter table public.research_feedback enable row level security;
drop policy if exists "users manage own research feedback" on public.research_feedback;
create policy "users manage own research feedback"
  on public.research_feedback for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create research feedback" on public.research_feedback;
create policy "users create research feedback"
  on public.research_feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "reviewers manage research feedback" on public.research_feedback;
create policy "reviewers manage research feedback"
  on public.research_feedback for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('reviewer','admin'))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('reviewer','admin'));

create table if not exists public.research_experiment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experiment_id text not null check (char_length(experiment_id) between 1 and 80),
  variant text not null check (char_length(variant) between 1 and 60),
  goal text not null check (char_length(goal) between 1 and 200),
  outcome text not null check (outcome in ('positive','neutral','negative','unknown')),
  metric text check (metric is null or char_length(metric) <= 80),
  value numeric,
  created_at timestamptz not null default now()
);
alter table public.research_experiment_logs enable row level security;
drop policy if exists "users read own experiment logs" on public.research_experiment_logs;
create policy "users read own experiment logs"
  on public.research_experiment_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own experiment logs" on public.research_experiment_logs;
create policy "users create own experiment logs"
  on public.research_experiment_logs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admins read experiment logs" on public.research_experiment_logs;
create policy "admins read experiment logs"
  on public.research_experiment_logs for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

comment on table public.learning_research_events is
  'Bounded in-app learning signals only; never stores prompts, journal, chat, audio, credentials or tracking outside the app.';
