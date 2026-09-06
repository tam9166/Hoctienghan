-- P33: aggregate production observability. Raw stack traces, request bodies,
-- auth tokens and private learning payloads are intentionally excluded.
create table if not exists public.production_error_events (
  event_date date not null,
  fingerprint text not null,
  error_type text not null check (error_type in ('frontend','backend','api','database','ai','sync','cache','unknown')),
  module text not null,
  frequency integer not null default 1 check (frequency >= 0),
  last_seen_at timestamptz not null default now(),
  source text not null default 'server-aggregate',
  primary key (event_date, fingerprint)
);
create table if not exists public.production_performance_metrics (
  metric_date date not null,
  metric_type text not null check (metric_type in ('page_load','api','database','ai','cache','sync')),
  module text not null,
  request_count bigint not null default 0 check (request_count >= 0),
  p50_ms integer,
  p95_ms integer,
  error_count bigint not null default 0 check (error_count >= 0),
  source text not null default 'server-aggregate',
  primary key (metric_date, metric_type, module)
);
create table if not exists public.production_health_checks (
  checked_at timestamptz not null default now(),
  backend_status text not null,
  database_status text not null,
  ai_status text not null,
  latency_ms integer,
  source text not null default 'health-endpoint'
);

create index if not exists production_error_events_date_idx on public.production_error_events(event_date desc, last_seen_at desc);
create index if not exists production_error_events_module_idx on public.production_error_events(module, event_date desc);
create index if not exists production_performance_date_idx on public.production_performance_metrics(metric_date desc, metric_type);
create index if not exists production_health_checks_checked_idx on public.production_health_checks(checked_at desc);
create index if not exists learning_sync_updated_at_idx on public.learning_sync(updated_at desc);

alter table public.production_error_events enable row level security;
alter table public.production_performance_metrics enable row level security;
alter table public.production_health_checks enable row level security;
drop policy if exists "admins read production error events" on public.production_error_events;
create policy "admins read production error events" on public.production_error_events for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read production performance metrics" on public.production_performance_metrics;
create policy "admins read production performance metrics" on public.production_performance_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins read production health checks" on public.production_health_checks;
create policy "admins read production health checks" on public.production_health_checks for select to authenticated using (public.has_any_role(array['admin']));

comment on table public.production_error_events is 'Aggregate frontend/backend/AI error frequency; no stack, payload, user ID or credential.';
comment on table public.production_performance_metrics is 'Aggregate page/API/database/AI latency and failures.';
comment on table public.production_health_checks is 'Health endpoint snapshots; no secrets or request bodies.';
