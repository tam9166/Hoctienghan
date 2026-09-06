-- P25: learning trust, native validation and content health.
-- Apply after 20260905_learning_content_ecosystem.sql.

create table if not exists public.content_quality_reviews (
  content_id text primary key,
  native_checked boolean not null default false,
  grammar_checked boolean not null default false,
  example_checked boolean not null default false,
  accuracy_score integer check (accuracy_score between 0 and 100),
  source text[] not null default '{}',
  translation_naturalness integer check (translation_naturalness between 0 and 100),
  difficulty_validated boolean not null default false,
  audio_checks jsonb not null default '{}'::jsonb,
  review_status text not null default 'review' check (review_status in ('draft','review','approved','deprecated')),
  reviewer_id uuid references auth.users(id) on delete set null,
  version_history jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists content_quality_status_idx
  on public.content_quality_reviews (review_status, accuracy_score, updated_at desc);

alter table public.content_quality_reviews enable row level security;
drop policy if exists "learners read approved content quality" on public.content_quality_reviews;
create policy "learners read approved content quality"
  on public.content_quality_reviews for select to anon, authenticated
  using (review_status = 'approved');
drop policy if exists "admins read all content quality" on public.content_quality_reviews;
create policy "admins read all content quality"
  on public.content_quality_reviews for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
drop policy if exists "admins create content quality" on public.content_quality_reviews;
create policy "admins create content quality"
  on public.content_quality_reviews for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
drop policy if exists "admins update content quality" on public.content_quality_reviews;
create policy "admins update content quality"
  on public.content_quality_reviews for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create table if not exists public.content_quality_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  report_type text not null check (report_type in ('meaning','audio','example','difficulty','duplicate')),
  message text not null check (char_length(message) between 1 and 1200),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_quality_reports enable row level security;
drop policy if exists "users read own quality reports" on public.content_quality_reports;
create policy "users read own quality reports"
  on public.content_quality_reports for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "users create own quality reports" on public.content_quality_reports;
create policy "users create own quality reports"
  on public.content_quality_reports for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "reviewers read quality reports" on public.content_quality_reports;
create policy "reviewers read quality reports"
  on public.content_quality_reports for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('reviewer','admin'));
drop policy if exists "reviewers manage quality reports" on public.content_quality_reports;
create policy "reviewers manage quality reports"
  on public.content_quality_reports for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('reviewer','admin'))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('reviewer','admin'));

comment on table public.content_quality_reviews is
  'Native/grammar/example validation, confidence, source transparency, difficulty and audio checks.';
comment on table public.content_quality_reports is
  'User-reported content quality issues; private to the reporter and trusted reviewers.';
