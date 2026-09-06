-- P43: privacy-safe metadata for task routing and quality evaluation.
-- Raw prompts, model responses, writing, chat history and audio are intentionally excluded.
create table if not exists public.ai_agent_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_agent text check (preferred_agent in ('planner','grammar','vocabulary','speaking','writing','exam','career','memory')),
  architecture_version text not null default 'p43-v1',
  updated_at timestamptz not null default now()
);
alter table public.ai_agent_preferences enable row level security;
drop policy if exists "users read own agent preferences" on public.ai_agent_preferences;
create policy "users read own agent preferences" on public.ai_agent_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own agent preferences" on public.ai_agent_preferences;
create policy "users create own agent preferences" on public.ai_agent_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own agent preferences" on public.ai_agent_preferences;
create policy "users update own agent preferences" on public.ai_agent_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.ai_agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null check (agent_id in ('planner','grammar','vocabulary','speaking','writing','exam','career','memory')),
  intent text not null check (char_length(intent) between 1 and 50),
  quality_status text not null check (quality_status in ('pass','review','blocked','confirmation-required')),
  quality_score numeric(4,3) not null check (quality_score between 0 and 1),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  input_chars integer not null default 0 check (input_chars >= 0),
  source_id text,
  primary_agents_used smallint not null default 1 check (primary_agents_used = 1),
  quality_controller_ran boolean not null default true check (quality_controller_ran = true),
  architecture_version text not null default 'p43-v1',
  created_at timestamptz not null default now()
);
create index if not exists ai_agent_audit_user_created_idx on public.ai_agent_audit_logs (user_id, created_at desc);
create index if not exists ai_agent_audit_agent_status_idx on public.ai_agent_audit_logs (agent_id, quality_status, created_at desc);
alter table public.ai_agent_audit_logs enable row level security;
drop policy if exists "users read own agent audit" on public.ai_agent_audit_logs;
create policy "users read own agent audit" on public.ai_agent_audit_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own agent audit" on public.ai_agent_audit_logs;
create policy "users create own agent audit" on public.ai_agent_audit_logs for insert to authenticated with check (user_id = auth.uid());

comment on table public.ai_agent_preferences is 'Per-user agent preference metadata; no prompt or response text.';
comment on table public.ai_agent_audit_logs is 'Routing and quality metadata only; excludes raw prompts, responses, writing, chat and audio.';
