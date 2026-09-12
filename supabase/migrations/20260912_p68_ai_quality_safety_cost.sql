-- P68: aggregate AI quality, safety, feedback and cost metadata only.
-- Raw prompts, responses, chat, audio, email, credentials and learning records are excluded.

alter table public.ai_evaluation_logs
  add column if not exists request_ref text,
  add column if not exists task_value text check (task_value is null or task_value in ('high','medium','low')),
  add column if not exists accuracy_score integer check (accuracy_score is null or accuracy_score between 0 and 100),
  add column if not exists usefulness_score integer check (usefulness_score is null or usefulness_score between 0 and 100),
  add column if not exists naturalness_score integer check (naturalness_score is null or naturalness_score between 0 and 100),
  add column if not exists completeness_score integer check (completeness_score is null or completeness_score between 0 and 100),
  add column if not exists validation_reasons text[] not null default '{}',
  add column if not exists latency_ms integer check (latency_ms is null or latency_ms >= 0),
  add column if not exists estimated_cost_micros bigint check (estimated_cost_micros is null or estimated_cost_micros >= 0),
  add column if not exists cost_source text not null default 'not_configured' check (cost_source in ('server_environment','not_configured')),
  add column if not exists cache_status text not null default 'miss' check (cache_status in ('hit','miss','bypass')),
  add column if not exists subscription_plan text check (subscription_plan is null or subscription_plan in ('free','premium','pro'));

create unique index if not exists ai_evaluation_logs_user_request_ref_idx
  on public.ai_evaluation_logs (user_id, request_ref) where request_ref is not null;
create index if not exists ai_evaluation_logs_task_cost_idx
  on public.ai_evaluation_logs (task, created_at desc, total_tokens, estimated_cost_micros);

create table if not exists public.ai_response_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_ref text not null check (char_length(request_ref) between 4 and 120),
  task text not null check (task ~ '^[a-z0-9_]{2,50}$'),
  rating text not null check (rating in ('helpful','not_helpful')),
  reason text not null default 'none' check (reason in ('wrong_grammar','hard_to_understand','unnatural_example','level_mismatch','none')),
  created_at timestamptz not null default now(),
  unique (user_id, request_ref),
  check (rating = 'helpful' or reason <> 'none')
);

alter table public.ai_response_feedback enable row level security;
drop policy if exists "users read own ai feedback" on public.ai_response_feedback;
create policy "users read own ai feedback" on public.ai_response_feedback
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own ai feedback" on public.ai_response_feedback;
create policy "users create own ai feedback" on public.ai_response_feedback
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admins read ai feedback" on public.ai_response_feedback;
create policy "admins read ai feedback" on public.ai_response_feedback
  for select to authenticated using (public.has_any_role(array['admin']));

create or replace view public.ai_usage_daily_summary
with (security_invoker = true) as
select user_id, created_at::date as usage_date, task,
  count(*)::integer as request_count,
  sum(total_tokens)::bigint as total_tokens,
  avg(latency_ms)::numeric(12,2) as average_latency_ms,
  avg(quality_score)::numeric(5,4) as average_quality_score,
  sum(estimated_cost_micros)::bigint as estimated_cost_micros,
  count(*) filter (where fallback)::integer as fallback_count
from public.ai_evaluation_logs
group by user_id, created_at::date, task;

grant select on public.ai_usage_daily_summary to authenticated;
grant select, insert on public.ai_response_feedback to authenticated;

comment on table public.ai_response_feedback is
  'User quality rating metadata only; raw AI prompts and responses are prohibited.';
comment on view public.ai_usage_daily_summary is
  'RLS-invoker AI request, token, latency, quality and configured-cost aggregates.';
