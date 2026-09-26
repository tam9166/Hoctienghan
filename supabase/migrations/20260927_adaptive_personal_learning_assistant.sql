-- Adaptive Personal Korean Learning Assistant (additive, local-first projection).
-- The generic user_learning_records sync remains the source used by the client.
-- These normalized tables are safe server-side projections for reporting and future APIs.

create table if not exists public.learning_goals (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_level text not null default 'Beginner', target_topik smallint not null default 2 check (target_topik between 1 and 6),
  exam_date date, target_months smallint not null default 6 check (target_months between 1 and 60),
  daily_minutes smallint not null default 20 check (daily_minutes between 5 and 180),
  study_days_per_week smallint not null default 6 check (study_days_per_week between 1 and 7),
  priority_skills text[] not null default '{}', personal_goal text not null default '',
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.learning_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_level text not null, target_topik smallint not null check (target_topik between 1 and 6),
  skill_scores jsonb not null default '{}'::jsonb, question_type_scores jsonb not null default '{}'::jsonb,
  srs_summary jsonb not null default '{}'::jsonb, error_summary jsonb not null default '{}'::jsonb,
  study_summary jsonb not null default '{}'::jsonb, evidence_updated_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.skill_mastery (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null, question_type text not null default '', score numeric(5,2), sample_count integer not null default 0 check (sample_count >= 0),
  evidence jsonb not null default '{}'::jsonb, updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.adaptive_recommendations (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_date date not null, evidence_signature text not null, reason text not null,
  priority text not null, estimated_minutes smallint not null check (estimated_minutes between 1 and 180),
  payload jsonb not null default '{}'::jsonb, status text not null default 'planned' check (status in ('planned','active','completed','replaced')),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.learning_plans (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null, target_minutes smallint not null check (target_minutes between 5 and 180),
  evidence_signature text not null, status text not null default 'planned' check (status in ('planned','active','completed','replaced')),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.learning_plan_tasks (
  id text not null, plan_id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  task_order smallint not null check (task_order >= 1), task_type text not null, title text not null, reason text not null,
  estimated_minutes smallint not null check (estimated_minutes >= 1), priority smallint not null check (priority >= 1), completed boolean not null default false,
  result jsonb not null default '{}'::jsonb, updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id), foreign key (user_id, plan_id) references public.learning_plans(user_id, id) on delete cascade
);

create table if not exists public.learning_sessions (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text, status text not null check (status in ('active','paused','completed','abandoned')),
  target_minutes smallint not null check (target_minutes between 1 and 180), actual_minutes smallint,
  tasks jsonb not null default '[]'::jsonb, result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null, completed_at timestamptz, updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.weak_areas (
  id text not null, user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null, skill text not null, question_type text not null default '', score numeric(5,2), sample_count integer not null default 0,
  priority text not null check (priority in ('high','medium','low')), reason text not null, root_cause text,
  evidence jsonb not null default '{}'::jsonb, resolved_at timestamptz, updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

do $$
declare v_table_name text;
begin
  foreach v_table_name in array array['learning_goals','learning_profiles','skill_mastery','adaptive_recommendations','learning_plans','learning_plan_tasks','learning_sessions','weak_areas']
  loop
    execute format('alter table public.%I enable row level security', v_table_name);
    execute format('revoke all on public.%I from anon', v_table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_table_name);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_table_name and policyname = 'users manage own rows') then
      execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', 'users manage own rows', v_table_name);
    end if;
  end loop;
end $$;

create index if not exists adaptive_recommendations_user_date_idx on public.adaptive_recommendations(user_id, recommendation_date desc);
create index if not exists learning_sessions_user_started_idx on public.learning_sessions(user_id, started_at desc);
create index if not exists weak_areas_user_priority_idx on public.weak_areas(user_id, priority, score);

comment on table public.adaptive_recommendations is 'Evidence-backed recommendations; client continues to work offline through user_learning_records.';
