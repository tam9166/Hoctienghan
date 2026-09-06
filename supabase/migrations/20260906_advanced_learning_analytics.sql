-- P29: personal learning analytics reports.
-- Reports are derived from the current user's own learning evidence only;
-- no peer comparison, raw chat, private journal or audio is stored here.
create table if not exists public.learning_analytics_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('weekly', 'monthly', 'yearly')),
  period_start date,
  period_end date,
  velocity jsonb not null default '{}'::jsonb,
  retention jsonb not null default '[]'::jsonb,
  skill_growth jsonb not null default '{}'::jsonb,
  efficiency jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  completion jsonb not null default '{}'::jsonb,
  quality jsonb not null default '{}'::jsonb,
  benchmark jsonb not null default '{}'::jsonb,
  generated_by text not null default 'deterministic-personal-analytics',
  created_at timestamptz not null default now()
);

create index if not exists learning_analytics_reports_user_created_idx
  on public.learning_analytics_reports(user_id, created_at desc);

alter table public.learning_analytics_reports enable row level security;

drop policy if exists "learning analytics reports are readable by owner" on public.learning_analytics_reports;
create policy "learning analytics reports are readable by owner"
  on public.learning_analytics_reports for select
  using (auth.uid() = user_id);

drop policy if exists "learning analytics reports are insertable by owner" on public.learning_analytics_reports;
create policy "learning analytics reports are insertable by owner"
  on public.learning_analytics_reports for insert
  with check (auth.uid() = user_id);

comment on table public.learning_analytics_reports is
  'P29 personal weekly/monthly/yearly learning reports; intentionally excludes peer comparisons, raw chat, journal and audio.';
