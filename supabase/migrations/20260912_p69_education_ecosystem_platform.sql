-- P69: additive B2C/B2B education ecosystem, consent-based progress sharing and role-scoped RLS.
-- Learning sync, SRS, mastery, auth credentials, journals, chat and recordings are not mutated.

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('student','teacher','reviewer','content_editor','content_creator','center_admin','admin','super_admin'));

create or replace function public.has_any_role(required_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = auth.uid() and (
      role_row.role = any(required_roles)
      or (role_row.role = 'super_admin' and ('admin' = any(required_roles) or 'super_admin' = any(required_roles)))
      or (role_row.role = 'content_creator' and ('content_editor' = any(required_roles) or 'content_creator' = any(required_roles)))
    )
  );
$$;
revoke all on function public.has_any_role(text[]) from public;
grant execute on function public.has_any_role(text[]) to authenticated;

alter table public.education_organization_members drop constraint if exists education_organization_members_role_check;
alter table public.education_organization_members add constraint education_organization_members_role_check
  check (role in ('owner','admin','center_admin','teacher','content_creator','student'));

create or replace function public.education_is_org_staff(target_organization uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_any_role(array['super_admin']) or exists (
    select 1 from public.education_organization_members member
    where member.organization_id = target_organization and member.user_id = auth.uid()
      and member.status = 'active' and member.role in ('owner','admin','center_admin','teacher')
  );
$$;

create or replace function public.education_can_manage_organization(target_organization uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_any_role(array['super_admin']) or exists (
    select 1 from public.education_organization_members member
    where member.organization_id = target_organization and member.user_id = auth.uid()
      and member.status = 'active' and member.role in ('owner','admin','center_admin')
  );
$$;

create or replace function public.education_can_manage_class(target_class uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.education_classes classroom
    where classroom.id = target_class and (
      classroom.teacher_id = auth.uid()
      or public.education_can_manage_organization(classroom.organization_id)
    )
  );
$$;

create table if not exists public.education_class_courses (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.education_classes(id) on delete cascade,
  course_id uuid not null references public.education_courses(id) on delete restrict,
  assigned_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, course_id)
);

create table if not exists public.education_progress_consents (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.education_classes(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scopes text[] not null default array['progress','skills','attendance']::text[],
  status text not null default 'active' check (status in ('active','revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (class_id, student_id),
  check (scopes <@ array['progress','skills','attendance','weakness','topik_readiness']::text[])
);

create table if not exists public.education_assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.education_classes(id) on delete cascade,
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 180),
  assessment_type text not null check (assessment_type in ('vocabulary','grammar','listening','reading')),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- answer_key is never selectable by students. Safe question delivery uses the RPC below.
create table if not exists public.education_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.education_assessments(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  skill text not null check (skill in ('vocabulary','grammar','listening','reading')),
  prompt text not null check (char_length(prompt) between 1 and 1000),
  options jsonb not null default '[]'::jsonb,
  answer_key jsonb not null,
  explanation text not null default '' check (char_length(explanation) <= 2000),
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);

create table if not exists public.education_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.education_assessments(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null check (score between 0 and 100),
  skill_breakdown jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table if not exists public.education_creator_submissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  organization_id uuid references public.education_organizations(id) on delete cascade,
  content_type text not null check (content_type in ('lesson','vocabulary','grammar','exercise','listening')),
  source_id text not null default '' check (char_length(source_id) <= 160),
  title text not null check (char_length(title) between 1 and 180),
  difficulty text not null default 'TOPIK 1',
  status text not null default 'draft' check (status in ('draft','ai_checked','human_review','approved','published','changes_requested')),
  ai_check jsonb,
  reviewer_id uuid references auth.users(id) on delete set null,
  human_review jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved','published') or reviewer_id is not null),
  check (reviewer_id is null or reviewer_id <> creator_id)
);

create table if not exists public.education_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  organization_id uuid not null references public.education_organizations(id) on delete restrict,
  class_id uuid references public.education_classes(id) on delete set null,
  course_id uuid references public.education_courses(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  evidence_type text not null check (evidence_type in ('course_completion','achievement','verified_level')),
  evidence_ref text not null check (char_length(evidence_ref) between 1 and 160),
  issued_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  status text not null default 'valid' check (status in ('valid','revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.education_teacher_ai_requests (
  id bigint generated always as identity primary key,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.education_classes(id) on delete cascade,
  task text not null check (task in ('quiz_draft','assignment_suggestion','class_error_summary')),
  aggregate_student_count integer not null default 0 check (aggregate_student_count >= 0),
  status text not null check (status in ('requested','completed','rejected','fallback')),
  human_approval_required boolean not null default true check (human_approval_required),
  created_at timestamptz not null default now()
);

create table if not exists public.education_access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.education_organizations(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.education_plan_catalog (
  plan_key text primary key check (plan_key in ('student','teacher','center')),
  entitlement_source text not null,
  scope text not null,
  price_metadata jsonb,
  status text not null default 'architecture' check (status in ('architecture','active','deprecated')),
  updated_at timestamptz not null default now()
);
insert into public.education_plan_catalog (plan_key, entitlement_source, scope, price_metadata) values
  ('student','commercial_user_subscriptions','individual',null),
  ('teacher','education_organization_subscriptions','assigned_classes',null),
  ('center','education_organization_subscriptions','organization_seats',null)
on conflict (plan_key) do update set entitlement_source = excluded.entitlement_source, scope = excluded.scope, updated_at = now();

alter table public.education_class_courses enable row level security;
alter table public.education_progress_consents enable row level security;
alter table public.education_assessments enable row level security;
alter table public.education_assessment_questions enable row level security;
alter table public.education_assessment_attempts enable row level security;
alter table public.education_creator_submissions enable row level security;
alter table public.education_certificates enable row level security;
alter table public.education_teacher_ai_requests enable row level security;
alter table public.education_access_audit enable row level security;
alter table public.education_plan_catalog enable row level security;

create policy "participants read class courses" on public.education_class_courses for select to authenticated
  using (public.education_can_manage_class(class_id) or public.education_is_active_student(class_id));
create policy "class managers assign courses" on public.education_class_courses for all to authenticated
  using (public.education_can_manage_class(class_id)) with check (assigned_by = auth.uid() and public.education_can_manage_class(class_id));

create policy "students control own progress consent" on public.education_progress_consents for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and public.education_is_active_student(class_id));
create policy "class managers read progress consent" on public.education_progress_consents for select to authenticated
  using (public.education_can_manage_class(class_id));

create policy "assessment participants read metadata" on public.education_assessments for select to authenticated
  using (public.education_can_manage_class(class_id) or public.education_is_active_student(class_id));
create policy "class managers create assessments" on public.education_assessments for insert to authenticated
  with check (creator_id = auth.uid() and public.education_can_manage_class(class_id));
create policy "class managers update assessments" on public.education_assessments for update to authenticated
  using (creator_id = auth.uid() and public.education_can_manage_class(class_id))
  with check (creator_id = auth.uid() and public.education_can_manage_class(class_id));
create policy "class managers manage answer keys" on public.education_assessment_questions for all to authenticated
  using (exists (select 1 from public.education_assessments assessment where assessment.id = assessment_id and public.education_can_manage_class(assessment.class_id)))
  with check (exists (select 1 from public.education_assessments assessment where assessment.id = assessment_id and public.education_can_manage_class(assessment.class_id)));
create policy "students read own assessment attempts" on public.education_assessment_attempts for select to authenticated
  using (student_id = auth.uid() or exists (select 1 from public.education_assessments assessment where assessment.id = assessment_id and public.education_can_manage_class(assessment.class_id)));

create policy "creators read own submissions" on public.education_creator_submissions for select to authenticated
  using (creator_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']));
create policy "creators create drafts" on public.education_creator_submissions for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['content_creator','content_editor']) and status = 'draft' and reviewer_id is null);
create policy "creators edit non-approved work" on public.education_creator_submissions for update to authenticated
  using (creator_id = auth.uid() and status in ('draft','ai_checked','changes_requested'))
  with check (creator_id = auth.uid() and status in ('draft','ai_checked','human_review') and reviewer_id is null);
create policy "human reviewers approve content" on public.education_creator_submissions for update to authenticated
  using (public.has_any_role(array['reviewer','admin','super_admin']) and creator_id <> auth.uid())
  with check (reviewer_id = auth.uid() and status in ('approved','changes_requested'));
create policy "super admins publish content" on public.education_creator_submissions for update to authenticated
  using (public.has_any_role(array['admin','super_admin']) and status = 'approved')
  with check (public.has_any_role(array['admin','super_admin']) and status = 'published' and reviewer_id is not null);

create policy "students read own education certificates" on public.education_certificates for select to authenticated
  using (student_id = auth.uid() or public.education_can_manage_organization(organization_id));
create policy "organization managers issue certificates" on public.education_certificates for insert to authenticated
  with check (
    issued_by = auth.uid() and (
      public.education_can_manage_organization(organization_id)
      or (
        education_certificates.class_id is not null and public.education_can_manage_class(education_certificates.class_id)
        and exists (select 1 from public.education_classes classroom where classroom.id = education_certificates.class_id and classroom.organization_id = education_certificates.organization_id)
      )
    )
  );
create policy "teachers create aggregate AI metadata" on public.education_teacher_ai_requests for insert to authenticated
  with check (teacher_id = auth.uid() and public.education_can_manage_class(class_id));
create policy "teachers read own aggregate AI metadata" on public.education_teacher_ai_requests for select to authenticated
  using (teacher_id = auth.uid() or public.education_can_manage_class(class_id));
create policy "organization managers read education audit" on public.education_access_audit for select to authenticated
  using (public.education_can_manage_organization(organization_id) or public.has_any_role(array['super_admin']));
create policy "actors create scoped education audit" on public.education_access_audit for insert to authenticated
  with check (actor_id = auth.uid() and (organization_id is null or public.education_is_org_member(organization_id)));
create policy "authenticated read education plan catalog" on public.education_plan_catalog for select to authenticated using (status <> 'deprecated');

create or replace function public.education_set_progress_consent(target_class uuid, enabled boolean, requested_scopes text[] default array['progress','skills','attendance']::text[])
returns public.education_progress_consents language plpgsql security definer set search_path = public
as $$
declare result public.education_progress_consents;
begin
  if not public.education_is_active_student(target_class) then raise exception 'active class membership required'; end if;
  if not requested_scopes <@ array['progress','skills','attendance','weakness','topik_readiness']::text[] then raise exception 'invalid consent scope'; end if;
  insert into public.education_progress_consents (class_id, student_id, scopes, status, granted_at, revoked_at, updated_at)
  values (target_class, auth.uid(), requested_scopes, case when enabled then 'active' else 'revoked' end, now(), case when enabled then null else now() end, now())
  on conflict (class_id, student_id) do update set scopes = excluded.scopes, status = excluded.status, granted_at = case when enabled then now() else education_progress_consents.granted_at end, revoked_at = excluded.revoked_at, updated_at = now()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.education_set_progress_consent(uuid,boolean,text[]) from public;
grant execute on function public.education_set_progress_consent(uuid,boolean,text[]) to authenticated;

create or replace function public.education_get_assessment(target_assessment uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not exists (select 1 from public.education_assessments assessment where assessment.id = target_assessment and assessment.status = 'published' and public.education_is_active_student(assessment.class_id)) then raise exception 'assessment unavailable'; end if;
  select jsonb_build_object('id',assessment.id,'title',assessment.title,'type',assessment.assessment_type,'instructions',assessment.instructions,'deadline',assessment.deadline,'questions',coalesce(jsonb_agg(jsonb_build_object('id',question.id,'position',question.position,'skill',question.skill,'prompt',question.prompt,'options',question.options) order by question.position),'[]'::jsonb)) into result
  from public.education_assessments assessment left join public.education_assessment_questions question on question.assessment_id = assessment.id where assessment.id = target_assessment group by assessment.id;
  return result;
end;
$$;
revoke all on function public.education_get_assessment(uuid) from public;
grant execute on function public.education_get_assessment(uuid) to authenticated;

create or replace function public.education_submit_assessment(target_assessment uuid, submitted_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare total_count integer; correct_count integer; result public.education_assessment_attempts;
begin
  if not exists (select 1 from public.education_assessments assessment where assessment.id = target_assessment and assessment.status = 'published' and public.education_is_active_student(assessment.class_id)) then raise exception 'assessment unavailable'; end if;
  select count(*), count(*) filter (where submitted_answers ->> (question.id::text) = question.answer_key ->> 'value') into total_count, correct_count from public.education_assessment_questions question where question.assessment_id = target_assessment;
  if total_count = 0 then raise exception 'assessment has no questions'; end if;
  insert into public.education_assessment_attempts (assessment_id, student_id, answers, score, skill_breakdown)
  values (target_assessment, auth.uid(), submitted_answers, round(correct_count::numeric / total_count * 100), jsonb_build_object('overall',round(correct_count::numeric / total_count * 100)))
  on conflict (assessment_id, student_id) do update set answers = excluded.answers, score = excluded.score, skill_breakdown = excluded.skill_breakdown, submitted_at = now()
  returning * into result;
  return jsonb_build_object('attemptId',result.id,'score',result.score,'skillBreakdown',result.skill_breakdown,'submittedAt',result.submitted_at);
end;
$$;
revoke all on function public.education_submit_assessment(uuid,jsonb) from public;
grant execute on function public.education_submit_assessment(uuid,jsonb) to authenticated;

create or replace function public.education_student_summary_v2(target_student uuid, target_class uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare learner_progress jsonb;
begin
  if not public.education_can_manage_class(target_class) then raise exception 'class access unavailable'; end if;
  if not exists (select 1 from public.education_class_students enrollment where enrollment.class_id = target_class and enrollment.student_id = target_student and enrollment.status = 'active') then raise exception 'student not active in class'; end if;
  if not exists (select 1 from public.education_progress_consents consent where consent.class_id = target_class and consent.student_id = target_student and consent.status = 'active' and 'progress' = any(consent.scopes)) then raise exception 'student progress consent required'; end if;
  select coalesce(payload #> '{data,klearn_progress}', '{}'::jsonb) into learner_progress from public.learning_sync where user_id = target_student;
  return jsonb_build_object(
    'progress',coalesce((learner_progress #>> '{stats,overallProgress}')::numeric,0),
    'studyMinutes',coalesce((learner_progress #>> '{stats,totalMinutes}')::numeric,0),
    'lessonCompletion',case when jsonb_typeof(learner_progress -> 'lessonProgress') = 'object' then jsonb_object_length(learner_progress -> 'lessonProgress') else 0 end,
    'skills',coalesce(learner_progress -> 'skills','{}'::jsonb),
    'topikReadiness',coalesce((learner_progress #>> '{stats,topikReadiness}')::numeric,0),
    'updatedAt',now(),
    'excluded',jsonb_build_array('password','email','journal','chat','recording','token')
  );
exception when invalid_text_representation then
  return jsonb_build_object('progress',0,'studyMinutes',0,'lessonCompletion',0,'skills','{}'::jsonb,'topikReadiness',0,'updatedAt',now());
end;
$$;
revoke all on function public.education_student_summary_v2(uuid,uuid) from public;
grant execute on function public.education_student_summary_v2(uuid,uuid) to authenticated;

-- P69 replaces the class-ambiguous legacy summary RPC. Leaving it executable would
-- bypass the student's per-class consent even though its payload was previously sanitized.
revoke execute on function public.education_student_summary(uuid) from authenticated;

create index if not exists education_class_courses_class_idx on public.education_class_courses(class_id,status);
create index if not exists education_progress_consents_student_idx on public.education_progress_consents(student_id,status);
create index if not exists education_assessments_class_idx on public.education_assessments(class_id,status,deadline);
create index if not exists education_attempts_student_idx on public.education_assessment_attempts(student_id,submitted_at desc);
create index if not exists education_creator_status_idx on public.education_creator_submissions(status,content_type,updated_at desc);
create index if not exists education_certificates_student_idx on public.education_certificates(student_id,issued_at desc);
create index if not exists education_access_audit_org_idx on public.education_access_audit(organization_id,created_at desc);

comment on table public.education_progress_consents is 'Student-controlled, revocable sharing consent scoped to one class.';
comment on table public.education_assessment_questions is 'Teacher-only answer keys; students receive prompts through a redacted security-definer RPC.';
comment on table public.education_teacher_ai_requests is 'Aggregate AI request metadata only. Raw student data, prompt and response are prohibited.';
comment on table public.education_plan_catalog is 'Architecture-only Student/Teacher/Center plan mapping; pricing is intentionally unset.';
