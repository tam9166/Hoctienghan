-- P32: contextual AI companion memory and aggregate quality telemetry only.
-- Raw prompts, essays, chat turns, audio, credentials and tokens are intentionally excluded.
create table if not exists public.ai_companion_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text,
  level text,
  weak_skills jsonb not null default '[]'::jsonb,
  frequent_errors jsonb not null default '[]'::jsonb,
  learning_style text,
  preferred_explanation text,
  target_language text not null default 'ko' check (target_language in ('ko','ja','zh')),
  updated_at timestamptz not null default now()
);
alter table public.ai_companion_memory enable row level security;
drop policy if exists "users read own companion memory" on public.ai_companion_memory;
create policy "users read own companion memory" on public.ai_companion_memory for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own companion memory" on public.ai_companion_memory;
create policy "users create own companion memory" on public.ai_companion_memory for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own companion memory" on public.ai_companion_memory;
create policy "users update own companion memory" on public.ai_companion_memory for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.ai_companion_quality_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (char_length(task) between 1 and 40),
  language_code text not null check (language_code in ('ko','ja','zh')),
  quality_status text not null check (quality_status in ('pass','review','blocked')),
  quality_score numeric(4,3) check (quality_score between 0 and 1),
  fallback_used boolean not null default false,
  source_approved boolean,
  created_at timestamptz not null default now()
);
create index if not exists ai_companion_quality_logs_user_created_idx on public.ai_companion_quality_logs (user_id, created_at desc);
alter table public.ai_companion_quality_logs enable row level security;
drop policy if exists "users read own companion quality logs" on public.ai_companion_quality_logs;
create policy "users read own companion quality logs" on public.ai_companion_quality_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own companion quality logs" on public.ai_companion_quality_logs;
create policy "users create own companion quality logs" on public.ai_companion_quality_logs for insert to authenticated with check (user_id = auth.uid());
comment on table public.ai_companion_memory is 'Structured learner preferences only; no raw chat, writing or audio.';
comment on table public.ai_companion_quality_logs is 'Aggregate quality status only; no prompts or model responses.';
