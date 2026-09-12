-- P71C: teacher review provenance, learning effectiveness, issue feedback and anonymous aggregates.
-- Additive only: existing SRS, mastery, progress, learning outcomes and content rows are untouched.

create table if not exists public.content_science_reviews (
  content_id text primary key check (char_length(content_id) between 1 and 160),
  content_type text not null check (char_length(content_type) between 1 and 60),
  status text not null default 'review' check (status in ('draft','review','approved','deprecated')),
  created_by_display text not null check (char_length(created_by_display) between 1 and 120),
  created_by_role text not null check (char_length(created_by_role) between 1 and 80),
  reviewed_by_display text check (reviewed_by_display is null or char_length(reviewed_by_display) between 1 and 120),
  reviewed_by_role text check (reviewed_by_role is null or char_length(reviewed_by_role) between 1 and 80),
  review_scope text not null default 'Internal curriculum review' check (char_length(review_scope) <= 160),
  reviewed_at date,
  accuracy_score integer check (accuracy_score between 0 and 100),
  naturalness_score integer check (naturalness_score between 0 and 100),
  difficulty_score integer check (difficulty_score between 0 and 100),
  completeness_score integer check (completeness_score between 0 and 100),
  quality_score integer generated always as (
    round(coalesce(accuracy_score, 0) * .35 + coalesce(naturalness_score, 0) * .25 + coalesce(difficulty_score, 0) * .20 + coalesce(completeness_score, 0) * .20)
  ) stored,
  sources text[] not null default '{}'::text[],
  evidence text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or (reviewed_by_display is not null and reviewed_by_role is not null and reviewed_at is not null and accuracy_score is not null and naturalness_score is not null and difficulty_score is not null and completeness_score is not null))
);

create table if not exists public.content_learning_effectiveness_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_event_id text not null check (char_length(client_event_id) between 1 and 220),
  content_id text not null check (char_length(content_id) between 1 and 160),
  content_type text not null check (char_length(content_type) between 1 and 60),
  evidence_type text not null check (evidence_type in ('studied','remembered','used','improved')),
  outcome text check (outcome is null or outcome in ('remembered','forgot','partial','completed')),
  score integer check (score is null or score between 0 and 100),
  source text not null default 'learning-action' check (char_length(source) <= 80),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create table if not exists public.content_science_issue_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content_id text not null check (char_length(content_id) between 1 and 160),
  content_type text not null check (char_length(content_type) between 1 and 60),
  report_type text not null check (report_type in ('wrong_meaning','confusing_example','broken_audio')),
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'received' check (status in ('received','reviewing','resolved','dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This table contains aggregate buckets only. It deliberately has no user_id,
-- IP, device, free-text, transcript, audio, journal, email or credential fields.
create table if not exists public.anonymous_content_science_aggregates (
  date_bucket date not null,
  segment text not null check (segment in ('beginner','topik_learner','conversation_learner','unclassified')),
  level_band text not null check (level_band in ('foundation','topik-1-2','topik-3-4','topik-5-6')),
  content_id text not null check (char_length(content_id) between 1 and 160),
  content_type text not null check (char_length(content_type) between 1 and 60),
  retention_band text not null check (retention_band in ('insufficient','0-49','50-69','70-84','85-100')),
  score_band text not null check (score_band in ('insufficient','0-49','50-69','70-84','85-100')),
  studied_count bigint not null default 0 check (studied_count >= 0),
  remembered_count bigint not null default 0 check (remembered_count >= 0),
  used_count bigint not null default 0 check (used_count >= 0),
  improved_count bigint not null default 0 check (improved_count >= 0),
  submissions bigint not null default 0 check (submissions >= 0),
  updated_at timestamptz not null default now(),
  primary key (date_bucket, segment, level_band, content_id, content_type, retention_band, score_band)
);

alter table public.content_science_reviews enable row level security;
alter table public.content_learning_effectiveness_events enable row level security;
alter table public.content_science_issue_reports enable row level security;
alter table public.anonymous_content_science_aggregates enable row level security;

create policy "public reads approved content science reviews" on public.content_science_reviews for select to anon, authenticated using (status = 'approved');
create policy "content reviewers read all content science reviews" on public.content_science_reviews for select to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));
create policy "content reviewers create content science reviews" on public.content_science_reviews for insert to authenticated with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));
create policy "content reviewers update content science reviews" on public.content_science_reviews for update to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin')) with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));

create policy "users manage own content effectiveness" on public.content_learning_effectiveness_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own content science reports" on public.content_science_issue_reports for select to authenticated using (user_id = auth.uid());
create policy "users create own content science reports" on public.content_science_issue_reports for insert to authenticated with check (user_id = auth.uid());
create policy "reviewers read content science reports" on public.content_science_issue_reports for select to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));
create policy "reviewers update content science reports" on public.content_science_issue_reports for update to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin')) with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));
create policy "reviewers read anonymous content science aggregates" on public.anonymous_content_science_aggregates for select to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('teacher','content_editor','reviewer','admin'));

revoke insert, update, delete on public.anonymous_content_science_aggregates from anon, authenticated;

create or replace function public.submit_anonymous_content_science(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_date date := date_trunc('month', now())::date;
  v_segment text := coalesce(p_payload ->> 'segment', 'unclassified');
  v_level text := p_payload ->> 'levelBand';
  v_content_id text := left(coalesce(p_payload ->> 'contentId', 'all'), 160);
  v_content_type text := left(coalesce(p_payload ->> 'contentType', 'aggregate'), 60);
  v_retention text := coalesce(p_payload ->> 'retentionBand', 'insufficient');
  v_score text := coalesce(p_payload ->> 'scoreBand', 'insufficient');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_segment not in ('beginner','topik_learner','conversation_learner','unclassified') then raise exception 'Invalid segment'; end if;
  if v_level not in ('foundation','topik-1-2','topik-3-4','topik-5-6') then raise exception 'Invalid level band'; end if;
  if v_retention not in ('insufficient','0-49','50-69','70-84','85-100') or v_score not in ('insufficient','0-49','50-69','70-84','85-100') then raise exception 'Invalid score band'; end if;
  if p_payload ?| array['userId','email','password','token','freeText','audio','transcript','journal','ipAddress','deviceId'] then raise exception 'Sensitive field rejected'; end if;
  if exists (select 1 from jsonb_object_keys(p_payload) as item(key) where item.key not in ('dateBucket','segment','levelBand','contentId','contentType','studiedCount','rememberedCount','usedCount','improvedCount','retentionBand','scoreBand')) then raise exception 'Unexpected field rejected'; end if;
  if v_content_id !~ '^[A-Za-z0-9가-힣_.:-]+$' or v_content_type !~ '^[A-Za-z0-9_-]+$' then raise exception 'Invalid aggregate identity'; end if;

  insert into public.anonymous_content_science_aggregates(date_bucket, segment, level_band, content_id, content_type, retention_band, score_band, studied_count, remembered_count, used_count, improved_count, submissions)
  values (v_date, v_segment, v_level, v_content_id, v_content_type, v_retention, v_score,
    greatest(0, least(1000, coalesce((p_payload ->> 'studiedCount')::integer, 0))),
    greatest(0, least(1000, coalesce((p_payload ->> 'rememberedCount')::integer, 0))),
    greatest(0, least(1000, coalesce((p_payload ->> 'usedCount')::integer, 0))),
    greatest(0, least(1000, coalesce((p_payload ->> 'improvedCount')::integer, 0))), 1)
  on conflict (date_bucket, segment, level_band, content_id, content_type, retention_band, score_band)
  do update set studied_count = anonymous_content_science_aggregates.studied_count + excluded.studied_count,
    remembered_count = anonymous_content_science_aggregates.remembered_count + excluded.remembered_count,
    used_count = anonymous_content_science_aggregates.used_count + excluded.used_count,
    improved_count = anonymous_content_science_aggregates.improved_count + excluded.improved_count,
    submissions = anonymous_content_science_aggregates.submissions + 1, updated_at = now();
end;
$$;

revoke all on function public.submit_anonymous_content_science(jsonb) from public, anon;
grant execute on function public.submit_anonymous_content_science(jsonb) to authenticated;

create index if not exists content_effectiveness_user_time_idx on public.content_learning_effectiveness_events(user_id, occurred_at desc);
create index if not exists content_effectiveness_content_idx on public.content_learning_effectiveness_events(content_id, evidence_type, occurred_at desc);
create index if not exists content_science_reports_status_idx on public.content_science_issue_reports(status, created_at desc);

comment on table public.content_science_reviews is 'Human review provenance and four-dimensional quality evidence; calculated score cannot approve content.';
comment on table public.content_learning_effectiveness_events is 'Owner-only evidence that content was studied, remembered, used or improved.';
comment on table public.content_science_issue_reports is 'Owner-private issue reports readable by authorized reviewers.';
comment on table public.anonymous_content_science_aggregates is 'Consent-driven coarse aggregate buckets with no user identifier or private learning content.';
