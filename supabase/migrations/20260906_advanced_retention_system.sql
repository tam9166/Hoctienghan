-- P24: privacy-preserving aggregate retention analytics.
-- Personal retention records remain inside the existing per-user learning_sync JSONB payload.

create table if not exists public.retention_daily_metrics (
  metric_date date primary key,
  active_users integer,
  returning_users integer,
  inactive_7d_users integer,
  inactive_30d_users integer,
  drop_points jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  constraint retention_daily_metrics_non_negative check (
    active_users is null or active_users >= 0
  ),
  constraint retention_returning_non_negative check (
    returning_users is null or returning_users >= 0
  )
);

alter table public.retention_daily_metrics enable row level security;

drop policy if exists "admins read retention aggregates" on public.retention_daily_metrics;
create policy "admins read retention aggregates"
on public.retention_daily_metrics
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No browser insert/update/delete policy is created. A trusted backend job owns aggregation.
revoke insert, update, delete on public.retention_daily_metrics from anon, authenticated;
grant select on public.retention_daily_metrics to authenticated;

comment on table public.retention_daily_metrics is
  'Daily aggregate retention metrics only; no user ids, journal text, chat, recordings, or raw learning events.';
