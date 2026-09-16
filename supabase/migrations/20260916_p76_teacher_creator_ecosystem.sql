-- P76: Teacher & Creator Ecosystem. Additive metadata/workflow only.
-- This migration does not update learner progress, SRS, mastery, auth credentials or CloudSync payloads.

create table if not exists public.education_teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  bio text not null default '' check (char_length(bio) <= 1200),
  experience text not null default '' check (char_length(experience) <= 200),
  specialization text not null default '' check (char_length(specialization) <= 200),
  languages text[] not null default '{}'::text[],
  certification text not null default '' check (char_length(certification) <= 300),
  updated_at timestamptz not null default now()
);

alter table public.education_teacher_profiles enable row level security;
drop policy if exists "authenticated read teacher profiles" on public.education_teacher_profiles;
create policy "authenticated read teacher profiles" on public.education_teacher_profiles for select to authenticated using (true);
drop policy if exists "teachers manage own profile" on public.education_teacher_profiles;
create policy "teachers manage own profile" on public.education_teacher_profiles for all to authenticated
  using (user_id = auth.uid() and public.has_any_role(array['teacher','content_creator','content_editor','admin','super_admin']))
  with check (user_id = auth.uid() and public.has_any_role(array['teacher','content_creator','content_editor','admin','super_admin']));

alter table public.education_creator_submissions
  drop constraint if exists education_creator_submissions_content_type_check;
alter table public.education_creator_submissions
  add constraint education_creator_submissions_content_type_check
  check (content_type in ('lesson','vocabulary','grammar','exercise','listening','reading','speaking','writing','culture'));
alter table public.education_creator_submissions
  drop constraint if exists education_creator_submissions_status_check;
alter table public.education_creator_submissions
  add constraint education_creator_submissions_status_check
  check (status in ('draft','ai_checked','automated_check','human_review','pending_review','approved','published','changes_requested','rejected'));
alter table public.education_creator_submissions
  add column if not exists level text not null default 'TOPIK 1' check (char_length(level) <= 60),
  add column if not exists skill text not null default 'vocabulary' check (char_length(skill) <= 60),
  add column if not exists learning_objective text not null default '' check (char_length(learning_objective) <= 800),
  add column if not exists explanation text not null default '' check (char_length(explanation) <= 5000),
  add column if not exists example_text text not null default '' check (char_length(example_text) <= 2000),
  add column if not exists exercise_payload jsonb not null default '{}'::jsonb,
  add column if not exists audio_url text not null default '' check (char_length(audio_url) <= 500),
  add column if not exists automated_checks jsonb,
  add column if not exists monetization_tier text not null default 'free' check (monetization_tier in ('free','premium')),
  add column if not exists subscription_eligible boolean not null default false,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

-- Replace P69 transition policies with the expanded P76 statuses. Ownership and role checks stay server-side.
drop policy if exists "creators create drafts" on public.education_creator_submissions;
create policy "creators create drafts" on public.education_creator_submissions for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['teacher','content_creator','content_editor','admin','super_admin']) and status = 'draft' and reviewer_id is null);
drop policy if exists "creators edit non-approved work" on public.education_creator_submissions;
create policy "creators edit non-approved work" on public.education_creator_submissions for update to authenticated
  using (creator_id = auth.uid() and status in ('draft','ai_checked','automated_check','changes_requested','rejected'))
  with check (creator_id = auth.uid() and status in ('draft','ai_checked','automated_check','human_review','pending_review') and reviewer_id is null);
drop policy if exists "human reviewers approve content" on public.education_creator_submissions;
create policy "human reviewers approve content" on public.education_creator_submissions for update to authenticated
  using (public.has_any_role(array['reviewer','admin','super_admin']) and creator_id <> auth.uid() and status in ('human_review','pending_review'))
  with check (reviewer_id = auth.uid() and creator_id <> auth.uid() and status in ('approved','changes_requested','rejected'));

create or replace function public.guard_p76_creator_workflow()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.creator_id <> old.creator_id then
    raise exception 'creator ownership is immutable';
  end if;
  if new.status in ('approved','rejected','changes_requested') then
    if new.creator_id = auth.uid() or new.reviewer_id <> auth.uid()
      or not public.has_any_role(array['reviewer','admin','super_admin']) then
      raise exception 'human reviewer must be different from creator';
    end if;
    if new.human_review is null then raise exception 'human review evidence required'; end if;
  end if;
  if new.status = 'published' then
    if old.status <> 'approved' or old.reviewer_id is null
      or not public.has_any_role(array['admin','super_admin']) then
      raise exception 'admin may publish approved content only';
    end if;
    new.published_by := auth.uid();
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists guard_p76_creator_workflow on public.education_creator_submissions;
create trigger guard_p76_creator_workflow before update on public.education_creator_submissions
  for each row execute function public.guard_p76_creator_workflow();

create table if not exists public.education_creator_courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 1500),
  level text not null check (char_length(level) between 1 and 60),
  goal text not null check (char_length(goal) between 1 and 800),
  thumbnail_url text not null default '' check (char_length(thumbnail_url) <= 500),
  category text not null check (char_length(category) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.education_creator_course_nodes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.education_creator_courses(id) on delete cascade,
  parent_id uuid references public.education_creator_course_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('chapter','lesson','exercise','assessment')),
  title text not null check (char_length(title) between 1 and 180),
  content_id uuid references public.education_creator_submissions(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

alter table public.education_creator_courses enable row level security;
alter table public.education_creator_course_nodes enable row level security;
drop policy if exists "course owners and reviewers read creator courses" on public.education_creator_courses;
create policy "course owners and reviewers read creator courses" on public.education_creator_courses for select to authenticated
  using (owner_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']));
drop policy if exists "creators create own courses" on public.education_creator_courses;
create policy "creators create own courses" on public.education_creator_courses for insert to authenticated
  with check (owner_id = auth.uid() and public.has_any_role(array['teacher','content_creator','content_editor','admin','super_admin']) and status = 'draft');
drop policy if exists "creators edit own draft courses" on public.education_creator_courses;
create policy "creators edit own draft courses" on public.education_creator_courses for update to authenticated
  using (owner_id = auth.uid() and status in ('draft','rejected'))
  with check (owner_id = auth.uid() and status = 'draft');
drop policy if exists "course readers read nodes" on public.education_creator_course_nodes;
create policy "course readers read nodes" on public.education_creator_course_nodes for select to authenticated
  using (exists (select 1 from public.education_creator_courses course where course.id = course_id and (course.owner_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']))));
drop policy if exists "course owners manage nodes" on public.education_creator_course_nodes;
create policy "course owners manage nodes" on public.education_creator_course_nodes for all to authenticated
  using (exists (select 1 from public.education_creator_courses course where course.id = course_id and course.owner_id = auth.uid() and course.status in ('draft','rejected')))
  with check (exists (select 1 from public.education_creator_courses course where course.id = course_id and course.owner_id = auth.uid() and course.status in ('draft','rejected')));

create table if not exists public.education_creator_feedback (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.education_creator_submissions(id) on delete cascade,
  learner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  issue_type text not null default '' check (char_length(issue_type) <= 60),
  message text not null default '' check (char_length(message) <= 1200),
  status text not null default 'open' check (status in ('open','triaged','resolved','closed')),
  created_at timestamptz not null default now()
);
alter table public.education_creator_feedback enable row level security;
drop policy if exists "learners create own creator feedback" on public.education_creator_feedback;
create policy "learners create own creator feedback" on public.education_creator_feedback for insert to authenticated
  with check (learner_id = auth.uid() and exists (select 1 from public.education_creator_submissions content where content.id = content_id and content.status = 'published'));
drop policy if exists "learners read own creator feedback" on public.education_creator_feedback;
create policy "learners read own creator feedback" on public.education_creator_feedback for select to authenticated
  using (learner_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']));

create table if not exists public.education_creator_analytics_daily (
  content_id uuid not null references public.education_creator_submissions(id) on delete cascade,
  metric_date date not null,
  views integer not null default 0 check (views >= 0),
  learners integer not null default 0 check (learners >= 0),
  starts integer not null default 0 check (starts >= 0),
  completions integer not null default 0 check (completions >= 0),
  drop_offs integer not null default 0 check (drop_offs >= 0),
  average_score numeric(5,2) check (average_score between 0 and 100),
  learning_improvement numeric(5,2) check (learning_improvement between 0 and 100),
  common_errors jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (content_id, metric_date)
);
alter table public.education_creator_analytics_daily enable row level security;
drop policy if exists "creator owners read aggregate analytics" on public.education_creator_analytics_daily;
create policy "creator owners read aggregate analytics" on public.education_creator_analytics_daily for select to authenticated
  using (exists (select 1 from public.education_creator_submissions content where content.id = content_id and (content.creator_id = auth.uid() or public.has_any_role(array['admin','super_admin']))));

create table if not exists public.education_creator_quality_snapshots (
  id bigint generated by default as identity primary key,
  creator_id uuid not null references auth.users(id) on delete cascade,
  content_quality smallint check (content_quality between 0 and 100),
  student_completion smallint check (student_completion between 0 and 100),
  learning_improvement smallint check (learning_improvement between 0 and 100),
  review_history smallint check (review_history between 0 and 100),
  quality_score smallint check (quality_score between 0 and 100),
  evidence_coverage smallint not null default 0 check (evidence_coverage between 0 and 100),
  calculated_at timestamptz not null default now()
);
alter table public.education_creator_quality_snapshots enable row level security;
drop policy if exists "creators read own quality score" on public.education_creator_quality_snapshots;
create policy "creators read own quality score" on public.education_creator_quality_snapshots for select to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['admin','super_admin']));

create or replace function public.creator_feedback_summary(target_content uuid)
returns table(total bigint, average_rating numeric, open_issues bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.education_creator_submissions content
    where content.id = target_content and (content.creator_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']))
  ) then raise exception 'not authorized'; end if;
  return query select count(*), round(avg(feedback.rating), 2), count(*) filter (where feedback.status = 'open')
    from public.education_creator_feedback feedback where feedback.content_id = target_content;
end;
$$;
revoke all on function public.creator_feedback_summary(uuid) from public;
grant execute on function public.creator_feedback_summary(uuid) to authenticated;

-- Attribute legacy/system content without changing IDs, learning records or quality history.
alter table public.learning_content
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists owner_label text not null default 'TamHoanq' check (char_length(owner_label) <= 120),
  add column if not exists owner_status text not null default 'verified' check (owner_status in ('unverified','verified'));
update public.learning_content set owner_label = 'TamHoanq', owner_status = 'verified'
where owner_id is null and (owner_label is null or owner_label = '' or owner_label = 'TamHoanq');

create index if not exists education_creator_owner_status_idx on public.education_creator_submissions(creator_id, status, updated_at desc);
create index if not exists education_creator_course_owner_idx on public.education_creator_courses(owner_id, status, updated_at desc);
create index if not exists education_creator_feedback_content_idx on public.education_creator_feedback(content_id, status, created_at desc);
create index if not exists education_creator_analytics_content_idx on public.education_creator_analytics_daily(content_id, metric_date desc);

comment on table public.education_teacher_profiles is 'Public professional profile fields only; credentials and private learner data are forbidden.';
comment on table public.education_creator_analytics_daily is 'Aggregate content metrics only; learner identities are not stored.';
comment on function public.creator_feedback_summary(uuid) is 'Returns aggregate feedback to the owner without exposing learner identity.';
