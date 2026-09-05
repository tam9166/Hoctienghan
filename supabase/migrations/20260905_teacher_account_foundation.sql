-- Teacher account foundation with least-privilege, relationship-based access.
-- Apply after 20260901_human_review_mentor_support.sql and the base learning_sync schema.
-- Journals remain inside each user's learning_sync row and are never exposed here.

create table if not exists public.teacher_student_links (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, student_id)
);
alter table public.teacher_student_links enable row level security;

drop policy if exists "participants read teacher links" on public.teacher_student_links;
create policy "participants read teacher links" on public.teacher_student_links
  for select to authenticated
  using (auth.uid() = teacher_id or auth.uid() = student_id);

drop policy if exists "teachers create own student links" on public.teacher_student_links;
create policy "teachers create own student links" on public.teacher_student_links
  for insert to authenticated
  with check (auth.uid() = teacher_id and public.has_any_role(array['teacher','admin']));

drop policy if exists "teachers revoke own student links" on public.teacher_student_links;
create policy "teachers revoke own student links" on public.teacher_student_links
  for update to authenticated
  using (auth.uid() = teacher_id and public.has_any_role(array['teacher','admin']))
  with check (auth.uid() = teacher_id and status in ('pending','revoked'));

create or replace function public.respond_to_teacher_link(link_id uuid, decision text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if decision not in ('accepted','rejected') then raise exception 'invalid decision'; end if;
  update public.teacher_student_links
     set status = decision, updated_at = now()
   where id = link_id and student_id = auth.uid() and status = 'pending';
  if not found then raise exception 'link unavailable'; end if;
end;
$$;
revoke all on function public.respond_to_teacher_link(uuid,text) from public;
grant execute on function public.respond_to_teacher_link(uuid,text) to authenticated;

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  source_type text not null default 'custom' check (source_type in ('custom','lesson','practice','vocabulary','grammar','sentence')),
  source_id text not null default '',
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teacher_assignments enable row level security;

drop policy if exists "participants read assignments" on public.teacher_assignments;
create policy "participants read assignments" on public.teacher_assignments
  for select to authenticated
  using (auth.uid() = student_id or auth.uid() = teacher_id);

drop policy if exists "linked teachers create assignments" on public.teacher_assignments;
create policy "linked teachers create assignments" on public.teacher_assignments
  for insert to authenticated
  with check (
    auth.uid() = teacher_id
    and public.has_any_role(array['teacher','admin'])
    and exists (
      select 1 from public.teacher_student_links link
      where link.teacher_id = auth.uid() and link.student_id = teacher_assignments.student_id and link.status = 'accepted'
    )
  );

drop policy if exists "linked teachers update assignments" on public.teacher_assignments;
create policy "linked teachers update assignments" on public.teacher_assignments
  for update to authenticated
  using (auth.uid() = teacher_id and public.has_any_role(array['teacher','admin']))
  with check (auth.uid() = teacher_id and public.has_any_role(array['teacher','admin']));

create or replace function public.update_own_assignment_status(assignment_id uuid, next_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if next_status not in ('in_progress','completed') then raise exception 'invalid status'; end if;
  update public.teacher_assignments
     set status = next_status, updated_at = now()
   where id = assignment_id and student_id = auth.uid();
  if not found then raise exception 'assignment unavailable'; end if;
end;
$$;
revoke all on function public.update_own_assignment_status(uuid,text) from public;
grant execute on function public.update_own_assignment_status(uuid,text) to authenticated;

create table if not exists public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.teacher_assignments(id) on delete set null,
  submission_type text not null check (submission_type in ('writing','speaking','sentence')),
  strengths text not null default '' check (char_length(strengths) <= 4000),
  improvements text not null default '' check (char_length(improvements) <= 4000),
  next_exercise text not null default '' check (char_length(next_exercise) <= 4000),
  created_at timestamptz not null default now()
);
alter table public.teacher_feedback enable row level security;

drop policy if exists "participants read teacher feedback" on public.teacher_feedback;
create policy "participants read teacher feedback" on public.teacher_feedback
  for select to authenticated
  using (auth.uid() = student_id or auth.uid() = teacher_id);

drop policy if exists "linked teachers create feedback" on public.teacher_feedback;
create policy "linked teachers create feedback" on public.teacher_feedback
  for insert to authenticated
  with check (
    auth.uid() = teacher_id
    and public.has_any_role(array['teacher','admin'])
    and exists (
      select 1 from public.teacher_student_links link
      where link.teacher_id = auth.uid() and link.student_id = teacher_feedback.student_id and link.status = 'accepted'
    )
  );

create or replace function public.teacher_student_progress(target_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.has_any_role(array['teacher','admin']) or not exists (
    select 1 from public.teacher_student_links
    where teacher_id = auth.uid() and student_id = target_student and status = 'accepted'
  ) then raise exception 'student progress unavailable'; end if;

  select jsonb_build_object(
    'stats', coalesce(payload #> '{data,klearn_progress,stats}', '{}'::jsonb),
    'skills', coalesce(payload #> '{data,klearn_progress,skills}', '{}'::jsonb),
    'lessonCount', jsonb_object_length(coalesce(payload #> '{data,klearn_progress,lessonProgress}', '{}'::jsonb)),
    'updatedAt', updated_at
  ) into result
  from public.learning_sync where user_id = target_student;
  return coalesce(result, jsonb_build_object('stats','{}'::jsonb,'skills','{}'::jsonb,'lessonCount',0));
end;
$$;
revoke all on function public.teacher_student_progress(uuid) from public;
grant execute on function public.teacher_student_progress(uuid) to authenticated;
