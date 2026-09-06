-- P30: server-generated aggregate BI for product operations.
-- These tables intentionally contain no user_id, email, raw support message,
-- credential, chat, journal or audio. Only a trusted server job should write them.

create table if not exists public.edtech_bi_daily_metrics (
  metric_date date primary key,
  total_users integer check (total_users is null or total_users >= 0),
  new_users integer check (new_users is null or new_users >= 0),
  active_users integer check (active_users is null or active_users >= 0),
  returning_users integer check (returning_users is null or returning_users >= 0),
  churn_users integer check (churn_users is null or churn_users >= 0),
  day_1_retention numeric check (day_1_retention is null or day_1_retention between 0 and 100),
  day_7_retention numeric check (day_7_retention is null or day_7_retention between 0 and 100),
  day_30_retention numeric check (day_30_retention is null or day_30_retention between 0 and 100),
  learning_minutes bigint check (learning_minutes is null or learning_minutes >= 0),
  learning_value numeric check (learning_value is null or learning_value >= 0),
  source text not null default 'server-aggregate',
  generated_at timestamptz not null default now()
);

create table if not exists public.edtech_bi_course_metrics (
  metric_date date not null,
  course_id text not null,
  course_title text not null default '',
  starts integer check (starts is null or starts >= 0),
  completions integer check (completions is null or completions >= 0),
  completion_rate numeric check (completion_rate is null or completion_rate between 0 and 100),
  engagement_score numeric check (engagement_score is null or engagement_score between 0 and 100),
  learning_minutes bigint check (learning_minutes is null or learning_minutes >= 0),
  source text not null default 'server-aggregate',
  primary key (metric_date, course_id)
);

create table if not exists public.edtech_bi_content_metrics (
  metric_date date not null,
  content_id text not null,
  content_title text not null default '',
  content_type text not null default 'content',
  engagements integer check (engagements is null or engagements >= 0),
  completions integer check (completions is null or completions >= 0),
  roi_score numeric check (roi_score is null or roi_score between 0 and 100),
  source text not null default 'server-aggregate',
  primary key (metric_date, content_id)
);

create table if not exists public.edtech_bi_premium_metrics (
  metric_date date primary key,
  free_users integer check (free_users is null or free_users >= 0),
  premium_users integer check (premium_users is null or premium_users >= 0),
  conversions integer check (conversions is null or conversions >= 0),
  conversion_rate numeric check (conversion_rate is null or conversion_rate between 0 and 100),
  source text not null default 'server-aggregate'
);

create table if not exists public.edtech_bi_system_health (
  metric_date date primary key,
  error_rate numeric check (error_rate is null or error_rate between 0 and 100),
  p95_ms integer check (p95_ms is null or p95_ms >= 0),
  api_success_rate numeric check (api_success_rate is null or api_success_rate between 0 and 100),
  slow_requests integer check (slow_requests is null or slow_requests >= 0),
  source text not null default 'server-aggregate'
);

create table if not exists public.edtech_bi_operation_reports (
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  summary text not null default '',
  source text not null default 'server-aggregate',
  generated_at timestamptz not null default now(),
  primary key (period_type, period_start)
);

alter table public.edtech_bi_daily_metrics enable row level security;
alter table public.edtech_bi_course_metrics enable row level security;
alter table public.edtech_bi_content_metrics enable row level security;
alter table public.edtech_bi_premium_metrics enable row level security;
alter table public.edtech_bi_system_health enable row level security;
alter table public.edtech_bi_operation_reports enable row level security;

drop policy if exists "admins read BI daily metrics" on public.edtech_bi_daily_metrics;
create policy "admins read BI daily metrics" on public.edtech_bi_daily_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read BI course metrics" on public.edtech_bi_course_metrics;
create policy "admins read BI course metrics" on public.edtech_bi_course_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read BI content metrics" on public.edtech_bi_content_metrics;
create policy "admins read BI content metrics" on public.edtech_bi_content_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read BI premium metrics" on public.edtech_bi_premium_metrics;
create policy "admins read BI premium metrics" on public.edtech_bi_premium_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read BI system health" on public.edtech_bi_system_health;
create policy "admins read BI system health" on public.edtech_bi_system_health for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read BI operation reports" on public.edtech_bi_operation_reports;
create policy "admins read BI operation reports" on public.edtech_bi_operation_reports for select to authenticated using (public.has_any_role(array['admin']));

create index if not exists edtech_bi_course_date_idx on public.edtech_bi_course_metrics(metric_date desc);
create index if not exists edtech_bi_content_date_idx on public.edtech_bi_content_metrics(metric_date desc);
create index if not exists edtech_bi_reports_period_idx on public.edtech_bi_operation_reports(period_type, period_start desc);

comment on table public.edtech_bi_daily_metrics is 'Aggregate user lifecycle, retention and learning value; no user-level PII.';
comment on table public.edtech_bi_course_metrics is 'Aggregate course performance and engagement; no enrollment identifiers.';
comment on table public.edtech_bi_content_metrics is 'Aggregate content engagement and ROI score; no user-level events.';
comment on table public.edtech_bi_premium_metrics is 'Aggregate free-to-premium conversion metrics; no payment credentials.';
comment on table public.edtech_bi_system_health is 'Aggregate error, latency and API health metrics.';
comment on table public.edtech_bi_operation_reports is 'Daily, weekly and monthly aggregate operating reports.';
