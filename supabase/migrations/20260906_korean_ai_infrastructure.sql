-- P26: AI infrastructure telemetry only. Raw prompts, responses and secrets are never stored.
create table if not exists public.ai_evaluation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (char_length(task) between 1 and 40),
  model_route text not null check (model_route in ('small','strong')),
  prompt_version text not null check (char_length(prompt_version) between 1 and 100),
  quality_status text not null check (quality_status in ('pass','review','blocked')),
  quality_score numeric(4,3) check (quality_score between 0 and 1),
  fallback boolean not null default false,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_evaluation_logs_user_created_idx
  on public.ai_evaluation_logs (user_id, created_at desc);

alter table public.ai_evaluation_logs enable row level security;
drop policy if exists "users read own ai evaluation logs" on public.ai_evaluation_logs;
create policy "users read own ai evaluation logs"
  on public.ai_evaluation_logs for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "users create own ai evaluation logs" on public.ai_evaluation_logs;
create policy "users create own ai evaluation logs"
  on public.ai_evaluation_logs for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "admins read ai evaluation logs" on public.ai_evaluation_logs;
create policy "admins read ai evaluation logs"
  on public.ai_evaluation_logs for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

comment on table public.ai_evaluation_logs is
  'Aggregate AI quality and cost telemetry; intentionally excludes raw learner prompts and AI responses.';
