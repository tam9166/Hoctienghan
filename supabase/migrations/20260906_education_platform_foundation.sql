-- Education platform foundation for schools and learning centers.
-- Apply after 20260905_teacher_account_foundation.sql.
-- Roles remain server-controlled in auth.users.raw_app_meta_data.

create table if not exists public.education_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  type text not null check (type in ('school','center')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.education_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.education_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','teacher','student')),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.education_add_owner_membership()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.education_organization_members (organization_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update set role = 'owner', status = 'active', updated_at = now();
  return new;
end;
$$;

drop trigger if exists education_organization_owner_membership on public.education_organizations;
create trigger education_organization_owner_membership
after insert on public.education_organizations
for each row execute function public.education_add_owner_membership();

create or replace function public.education_is_org_member(target_organization uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.education_organization_members member
    where member.organization_id = target_organization and member.user_id = auth.uid() and member.status = 'active'
  );
$$;

create or replace function public.education_is_org_staff(target_organization uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.education_organization_members member
    where member.organization_id = target_organization and member.user_id = auth.uid()
      and member.status = 'active' and member.role in ('owner','admin','teacher')
  );
$$;

create table if not exists public.education_classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.education_organizations(id) on delete cascade,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) check (char_length(code) between 3 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.education_class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.education_classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  status text not null default 'invited' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create or replace function public.education_is_class_teacher(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.education_classes classroom
    where classroom.id = target_class and classroom.teacher_id = auth.uid()
      and public.education_is_org_staff(classroom.organization_id)
  );
$$;

create or replace function public.education_is_active_student(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.education_class_students enrollment
    where enrollment.class_id = target_class and enrollment.student_id = auth.uid() and enrollment.status = 'active'
  );
$$;

create table if not exists public.education_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.education_organizations(id) on delete cascade,
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '' check (char_length(description) <= 4000),
  track text not null default 'custom' check (track in ('business','travel','topik','custom')),
  difficulty text not null default 'TOPIK 1' check (difficulty in ('Level 0','TOPIK 1','TOPIK 2','TOPIK 3','TOPIK 4','TOPIK 5','TOPIK 6')),
  status text not null default 'draft' check (status in ('draft','in_review','approved','deprecated')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or verified)
);

create table if not exists public.education_course_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.education_courses(id) on delete cascade,
  module_title text not null default 'Nội dung khóa học' check (char_length(module_title) <= 120),
  item_type text not null check (item_type in ('lesson','grammar','vocabulary','audio','test')),
  source_id text not null default '' check (char_length(source_id) <= 160),
  title text not null check (char_length(title) between 1 and 180),
  position integer not null default 0 check (position >= 0),
  verified boolean not null default false,
  difficulty text not null default 'TOPIK 1' check (difficulty in ('Level 0','TOPIK 1','TOPIK 2','TOPIK 3','TOPIK 4','TOPIK 5','TOPIK 6')),
  status text not null default 'draft' check (status in ('draft','in_review','approved','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or verified)
);

create table if not exists public.education_class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.education_classes(id) on delete cascade,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  student_id uuid references auth.users(id) on delete cascade,
  assignment_type text not null check (assignment_type in ('lesson','vocabulary','test')),
  source_id text not null default '' check (char_length(source_id) <= 160),
  title text not null check (char_length(title) between 1 and 180),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed','reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.education_organizations enable row level security;
alter table public.education_organization_members enable row level security;
alter table public.education_classes enable row level security;
alter table public.education_class_students enable row level security;
alter table public.education_courses enable row level security;
alter table public.education_course_items enable row level security;
alter table public.education_class_assignments enable row level security;

drop policy if exists "members read education organizations" on public.education_organizations;
create policy "members read education organizations" on public.education_organizations for select to authenticated
  using (owner_id = auth.uid() or public.education_is_org_member(id));
drop policy if exists "teachers create education organizations" on public.education_organizations;
create policy "teachers create education organizations" on public.education_organizations for insert to authenticated
  with check (owner_id = auth.uid() and public.has_any_role(array['teacher','admin']));
drop policy if exists "owners manage education organizations" on public.education_organizations;
create policy "owners manage education organizations" on public.education_organizations for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "members read organization membership" on public.education_organization_members;
create policy "members read organization membership" on public.education_organization_members for select to authenticated
  using (user_id = auth.uid() or public.education_is_org_staff(organization_id));
drop policy if exists "staff invite organization members" on public.education_organization_members;
create policy "staff invite organization members" on public.education_organization_members for insert to authenticated
  with check (public.education_is_org_staff(organization_id) and role <> 'owner');
drop policy if exists "staff manage organization members" on public.education_organization_members;
create policy "staff manage organization members" on public.education_organization_members for update to authenticated
  using (public.education_is_org_staff(organization_id))
  with check (public.education_is_org_staff(organization_id) and role <> 'owner');

drop policy if exists "members read education classes" on public.education_classes;
create policy "members read education classes" on public.education_classes for select to authenticated
  using (public.education_is_org_member(organization_id));
drop policy if exists "staff create education classes" on public.education_classes;
create policy "staff create education classes" on public.education_classes for insert to authenticated
  with check (teacher_id = auth.uid() and public.education_is_org_staff(organization_id) and public.has_any_role(array['teacher','admin']));
drop policy if exists "class teachers manage classes" on public.education_classes;
create policy "class teachers manage classes" on public.education_classes for update to authenticated
  using (teacher_id = auth.uid() and public.education_is_org_staff(organization_id))
  with check (teacher_id = auth.uid() and public.education_is_org_staff(organization_id));

drop policy if exists "participants read class enrollment" on public.education_class_students;
create policy "participants read class enrollment" on public.education_class_students for select to authenticated
  using (student_id = auth.uid() or public.education_is_class_teacher(class_id));
drop policy if exists "teachers invite class students" on public.education_class_students;
create policy "teachers invite class students" on public.education_class_students for insert to authenticated
  with check (public.education_is_class_teacher(class_id) and status = 'invited');
drop policy if exists "teachers manage class students" on public.education_class_students;
create policy "teachers manage class students" on public.education_class_students for update to authenticated
  using (public.education_is_class_teacher(class_id))
  with check (public.education_is_class_teacher(class_id) and status in ('invited','removed'));

create or replace function public.respond_to_class_invitation(enrollment_id uuid, decision text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if decision not in ('active','removed') then raise exception 'invalid decision'; end if;
  update public.education_class_students
     set status = decision, updated_at = now()
   where id = enrollment_id and student_id = auth.uid() and status = 'invited';
  if not found then raise exception 'invitation unavailable'; end if;
end;
$$;
revoke all on function public.respond_to_class_invitation(uuid,text) from public;
grant execute on function public.respond_to_class_invitation(uuid,text) to authenticated;

drop policy if exists "members read education courses" on public.education_courses;
create policy "members read education courses" on public.education_courses for select to authenticated
  using ((organization_id is null and status = 'approved') or public.education_is_org_member(organization_id));
drop policy if exists "staff create education courses" on public.education_courses;
create policy "staff create education courses" on public.education_courses for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['teacher','admin']) and (organization_id is null or public.education_is_org_staff(organization_id)));
drop policy if exists "creators edit draft education courses" on public.education_courses;
create policy "creators edit draft education courses" on public.education_courses for update to authenticated
  using (creator_id = auth.uid() and (organization_id is null or public.education_is_org_staff(organization_id)))
  with check (creator_id = auth.uid() and status in ('draft','in_review') and not verified);
drop policy if exists "admins review education courses" on public.education_courses;
create policy "admins review education courses" on public.education_courses for update to authenticated
  using (public.has_any_role(array['admin']) and (organization_id is null or public.education_is_org_staff(organization_id)))
  with check (public.has_any_role(array['admin']) and (status <> 'approved' or verified));

drop policy if exists "course readers read education items" on public.education_course_items;
create policy "course readers read education items" on public.education_course_items for select to authenticated
  using (exists (select 1 from public.education_courses course where course.id = course_id and ((course.organization_id is null and course.status = 'approved') or public.education_is_org_member(course.organization_id))));
drop policy if exists "course creators add education items" on public.education_course_items;
create policy "course creators add education items" on public.education_course_items for insert to authenticated
  with check (exists (select 1 from public.education_courses course where course.id = course_id and course.creator_id = auth.uid() and (course.organization_id is null or public.education_is_org_staff(course.organization_id))) and status in ('draft','in_review') and not verified);
drop policy if exists "course creators edit education items" on public.education_course_items;
create policy "course creators edit education items" on public.education_course_items for update to authenticated
  using (exists (select 1 from public.education_courses course where course.id = course_id and course.creator_id = auth.uid() and (course.organization_id is null or public.education_is_org_staff(course.organization_id))))
  with check (status in ('draft','in_review') and not verified);
drop policy if exists "admins review education items" on public.education_course_items;
create policy "admins review education items" on public.education_course_items for update to authenticated
  using (public.has_any_role(array['admin']) and exists (select 1 from public.education_courses course where course.id = course_id and (course.organization_id is null or public.education_is_org_staff(course.organization_id))))
  with check (public.has_any_role(array['admin']) and (status <> 'approved' or verified));

drop policy if exists "participants read class assignments" on public.education_class_assignments;
create policy "participants read class assignments" on public.education_class_assignments for select to authenticated
  using (teacher_id = auth.uid() or (public.education_is_active_student(class_id) and (student_id is null or student_id = auth.uid())));
drop policy if exists "class teachers create assignments" on public.education_class_assignments;
create policy "class teachers create assignments" on public.education_class_assignments for insert to authenticated
  with check (teacher_id = auth.uid() and public.education_is_class_teacher(class_id) and (student_id is null or exists (select 1 from public.education_class_students enrollment where enrollment.class_id = education_class_assignments.class_id and enrollment.student_id = education_class_assignments.student_id and enrollment.status = 'active')));
drop policy if exists "class teachers manage assignments" on public.education_class_assignments;
create policy "class teachers manage assignments" on public.education_class_assignments for update to authenticated
  using (teacher_id = auth.uid() and public.education_is_class_teacher(class_id))
  with check (teacher_id = auth.uid() and public.education_is_class_teacher(class_id));

create or replace function public.update_own_class_assignment_status(assignment_id uuid, next_status text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if next_status not in ('in_progress','completed') then raise exception 'invalid status'; end if;
  update public.education_class_assignments assignment
     set status = next_status, updated_at = now()
   where assignment.id = assignment_id
     and public.education_is_active_student(assignment.class_id)
     and (assignment.student_id is null or assignment.student_id = auth.uid());
  if not found then raise exception 'assignment unavailable'; end if;
end;
$$;
revoke all on function public.update_own_class_assignment_status(uuid,text) from public;
grant execute on function public.update_own_class_assignment_status(uuid,text) to authenticated;

-- Extend teacher feedback to active classroom relationships without exposing other students.
drop policy if exists "linked teachers create feedback" on public.teacher_feedback;
create policy "linked teachers create feedback" on public.teacher_feedback for insert to authenticated
  with check (
    auth.uid() = teacher_id and public.has_any_role(array['teacher','admin']) and (
      exists (select 1 from public.teacher_student_links link where link.teacher_id = auth.uid() and link.student_id = teacher_feedback.student_id and link.status = 'accepted')
      or exists (
        select 1 from public.education_class_students enrollment
        join public.education_classes classroom on classroom.id = enrollment.class_id
        where classroom.teacher_id = auth.uid() and enrollment.student_id = teacher_feedback.student_id and enrollment.status = 'active'
      )
    )
  );

create or replace function public.education_student_summary(target_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  learner_progress jsonb;
  learner_errors jsonb;
  safe_errors jsonb;
begin
  if not public.has_any_role(array['teacher','admin']) or not (
    exists (select 1 from public.teacher_student_links link where link.teacher_id = auth.uid() and link.student_id = target_student and link.status = 'accepted')
    or exists (
      select 1 from public.education_class_students enrollment
      join public.education_classes classroom on classroom.id = enrollment.class_id
      where classroom.teacher_id = auth.uid() and enrollment.student_id = target_student and enrollment.status = 'active'
    )
  ) then raise exception 'student summary unavailable'; end if;

  select coalesce(payload #> '{data,klearn_progress}', '{}'::jsonb),
         coalesce(payload #> '{data,klearn_errors}', '[]'::jsonb)
    into learner_progress, learner_errors
  from public.learning_sync where user_id = target_student;

  if jsonb_typeof(learner_errors) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', coalesce(entry ->> 'type', 'learning'),
      'title', coalesce(nullif(entry ->> 'question', ''), nullif(entry ->> 'mistake', ''), 'Lỗi học tập'),
      'count', greatest(1, coalesce((entry ->> 'count')::integer, 1)),
      'resolved', coalesce((entry ->> 'resolved')::boolean, false)
    )), '[]'::jsonb) into safe_errors
    from (select value as entry from jsonb_array_elements(learner_errors) limit 8) limited_errors;
  else
    safe_errors := '[]'::jsonb;
  end if;

  result := jsonb_build_object(
    'stats', coalesce(learner_progress -> 'stats', '{}'::jsonb),
    'skills', coalesce(learner_progress -> 'skills', '{}'::jsonb),
    'progress', coalesce((learner_progress #>> '{stats,overallProgress}')::numeric, 0),
    'studyMinutes', coalesce((learner_progress #>> '{stats,totalMinutes}')::numeric, (learner_progress #>> '{stats,weeklyStudyMinutes}')::numeric, 0),
    'lessonCount', jsonb_object_length(coalesce(learner_progress -> 'lessonProgress', '{}'::jsonb)),
    'mistakes', safe_errors,
    'updatedAt', now()
  );
  return result;
exception when invalid_text_representation then
  return jsonb_build_object('stats','{}'::jsonb,'skills','{}'::jsonb,'progress',0,'studyMinutes',0,'lessonCount',0,'mistakes','[]'::jsonb);
end;
$$;
revoke all on function public.education_student_summary(uuid) from public;
grant execute on function public.education_student_summary(uuid) to authenticated;

create index if not exists education_members_user_idx on public.education_organization_members(user_id, status);
create index if not exists education_classes_org_idx on public.education_classes(organization_id);
create index if not exists education_class_students_student_idx on public.education_class_students(student_id, status);
create index if not exists education_assignments_class_idx on public.education_class_assignments(class_id, due_date);
create index if not exists education_assignments_student_idx on public.education_class_assignments(student_id, status);
create index if not exists education_courses_org_idx on public.education_courses(organization_id, status);
create index if not exists education_course_items_course_idx on public.education_course_items(course_id, position);
