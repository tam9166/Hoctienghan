-- P80 TOPIK exam repository. Official schedules are metadata-only until content rights
-- and an answer key have been independently verified.

create table if not exists public.topik_exam_sources (
  id text primary key,
  source_name text not null,
  source_url text not null,
  source_type text not null check (source_type in ('project-original-content','official-schedule','official-release','licensed-content','official-tutorial-link')),
  copyright_note text not null,
  license_or_permission text not null,
  answer_source_url text,
  published_at date,
  retrieved_at date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.topik_exams (
  id text primary key,
  source_id text not null references public.topik_exam_sources(id) on delete restrict,
  title text not null,
  level text not null check (level in ('TOPIK I','TOPIK II','TOPIK I/II')),
  format text not null check (format in ('PBT','IBT')),
  exam_number text not null,
  exam_date date,
  result_date date,
  status text not null check (status in ('practice','past','upcoming')),
  content_status text not null check (content_status in ('metadata-only','available','withdrawn')),
  answer_verification text not null check (answer_verification in ('not-available','unverified','verified-original','verified-official')),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  question_count integer check (question_count is null or question_count >= 0),
  audio_available boolean not null default false,
  explanation_available boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topik_publish_requires_rights check (
    not is_published or content_status = 'metadata-only' or answer_verification in ('verified-original','verified-official')
  )
);

create table if not exists public.topik_exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id text not null references public.topik_exams(id) on delete cascade,
  section text not null check (section in ('listening','reading','writing')),
  position integer not null check (position > 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  unique (exam_id, section)
);

create table if not exists public.topik_exam_questions (
  id text primary key,
  exam_id text not null references public.topik_exams(id) on delete cascade,
  section_id uuid references public.topik_exam_sections(id) on delete cascade,
  question_number integer not null check (question_number > 0),
  skill text not null,
  question_type text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  prompt text not null,
  audio_url text,
  audio_transcript text,
  answer_verification text not null check (answer_verification in ('unverified','verified-original','verified-official')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (exam_id, question_number)
);

create table if not exists public.topik_exam_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.topik_exam_questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  position integer not null check (position > 0),
  unique (question_id, option_key),
  unique (question_id, position)
);

create table if not exists public.topik_exam_answers (
  question_id text primary key references public.topik_exam_questions(id) on delete cascade,
  answer_value text not null,
  verification_status text not null check (verification_status in ('verified-original','verified-official')),
  answer_source_url text,
  verified_at timestamptz not null,
  verified_by uuid references auth.users(id) on delete set null,
  constraint official_answer_requires_source check (verification_status <> 'verified-official' or answer_source_url is not null)
);

create table if not exists public.topik_exam_explanations (
  question_id text primary key references public.topik_exam_questions(id) on delete cascade,
  explanation text not null,
  strategy text,
  vocabulary jsonb not null default '[]'::jsonb,
  grammar jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.topik_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text references public.topik_exams(id) on delete set null,
  client_attempt_id text not null,
  mode text not null,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','time_expired')),
  started_at timestamptz not null,
  deadline_at timestamptz,
  completed_at timestamptz,
  percentage numeric(5,2) check (percentage is null or percentage between 0 and 100),
  scaled_score integer,
  max_score integer,
  score_type text check (score_type is null or score_type in ('practice-estimate','official-key-based','unscored')),
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_attempt_id)
);

create table if not exists public.topik_exam_user_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.topik_exam_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text references public.topik_exam_questions(id) on delete set null,
  client_question_id text not null,
  selected_answer text,
  is_marked boolean not null default false,
  is_correct boolean,
  score numeric(5,2),
  gradable boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, client_question_id)
);

create index if not exists topik_exams_filter_idx on public.topik_exams(level, format, status, exam_date);
create index if not exists topik_questions_exam_idx on public.topik_exam_questions(exam_id, question_number);
create index if not exists topik_attempts_user_idx on public.topik_exam_attempts(user_id, started_at desc);
create index if not exists topik_user_answers_attempt_idx on public.topik_exam_user_answers(attempt_id);

alter table public.topik_exam_sources enable row level security;
alter table public.topik_exams enable row level security;
alter table public.topik_exam_sections enable row level security;
alter table public.topik_exam_questions enable row level security;
alter table public.topik_exam_options enable row level security;
alter table public.topik_exam_answers enable row level security;
alter table public.topik_exam_explanations enable row level security;
alter table public.topik_exam_attempts enable row level security;
alter table public.topik_exam_user_answers enable row level security;

drop policy if exists "published topik sources are readable" on public.topik_exam_sources;
create policy "published topik sources are readable" on public.topik_exam_sources for select to authenticated using (
  exists (select 1 from public.topik_exams exam where exam.source_id = topik_exam_sources.id and exam.is_published)
  or public.has_any_role(array['reviewer','admin'])
);
drop policy if exists "content staff manage topik sources" on public.topik_exam_sources;
create policy "content staff manage topik sources" on public.topik_exam_sources for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "published topik exams are readable" on public.topik_exams;
create policy "published topik exams are readable" on public.topik_exams for select to authenticated using (is_published or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik exams" on public.topik_exams;
create policy "content staff manage topik exams" on public.topik_exams for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "published topik sections are readable" on public.topik_exam_sections;
create policy "published topik sections are readable" on public.topik_exam_sections for select to authenticated using (exists (select 1 from public.topik_exams exam where exam.id = exam_id and exam.is_published) or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik sections" on public.topik_exam_sections;
create policy "content staff manage topik sections" on public.topik_exam_sections for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "published topik questions are readable" on public.topik_exam_questions;
create policy "published topik questions are readable" on public.topik_exam_questions for select to authenticated using (is_published and exists (select 1 from public.topik_exams exam where exam.id = exam_id and exam.is_published and exam.content_status = 'available') or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik questions" on public.topik_exam_questions;
create policy "content staff manage topik questions" on public.topik_exam_questions for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "published topik options are readable" on public.topik_exam_options;
create policy "published topik options are readable" on public.topik_exam_options for select to authenticated using (exists (select 1 from public.topik_exam_questions question join public.topik_exams exam on exam.id = question.exam_id where question.id = question_id and question.is_published and exam.is_published and exam.content_status = 'available') or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik options" on public.topik_exam_options;
create policy "content staff manage topik options" on public.topik_exam_options for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "verified topik answers are readable" on public.topik_exam_answers;
create policy "verified topik answers are readable" on public.topik_exam_answers for select to authenticated using (exists (select 1 from public.topik_exam_questions question join public.topik_exams exam on exam.id = question.exam_id where question.id = question_id and question.is_published and exam.is_published and exam.content_status = 'available' and question.answer_verification in ('verified-original','verified-official')) or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik answers" on public.topik_exam_answers;
create policy "content staff manage topik answers" on public.topik_exam_answers for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "published topik explanations are readable" on public.topik_exam_explanations;
create policy "published topik explanations are readable" on public.topik_exam_explanations for select to authenticated using (exists (select 1 from public.topik_exam_questions question join public.topik_exams exam on exam.id = question.exam_id where question.id = question_id and question.is_published and exam.is_published and exam.content_status = 'available') or public.has_any_role(array['reviewer','admin']));
drop policy if exists "content staff manage topik explanations" on public.topik_exam_explanations;
create policy "content staff manage topik explanations" on public.topik_exam_explanations for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

drop policy if exists "users read own topik attempts" on public.topik_exam_attempts;
create policy "users read own topik attempts" on public.topik_exam_attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists "users create own topik attempts" on public.topik_exam_attempts;
create policy "users create own topik attempts" on public.topik_exam_attempts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own topik attempts" on public.topik_exam_attempts;
create policy "users update own topik attempts" on public.topik_exam_attempts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own topik attempts" on public.topik_exam_attempts;
create policy "users delete own topik attempts" on public.topik_exam_attempts for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users read own topik answers" on public.topik_exam_user_answers;
create policy "users read own topik answers" on public.topik_exam_user_answers for select to authenticated using (user_id = auth.uid() and exists (select 1 from public.topik_exam_attempts attempt where attempt.id = attempt_id and attempt.user_id = auth.uid()));
drop policy if exists "users create own topik answers" on public.topik_exam_user_answers;
create policy "users create own topik answers" on public.topik_exam_user_answers for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.topik_exam_attempts attempt where attempt.id = attempt_id and attempt.user_id = auth.uid()));
drop policy if exists "users update own topik answers" on public.topik_exam_user_answers;
create policy "users update own topik answers" on public.topik_exam_user_answers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.topik_exam_attempts attempt where attempt.id = attempt_id and attempt.user_id = auth.uid()));
drop policy if exists "users delete own topik answers" on public.topik_exam_user_answers;
create policy "users delete own topik answers" on public.topik_exam_user_answers for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.topik_exam_sources, public.topik_exams, public.topik_exam_sections, public.topik_exam_questions, public.topik_exam_options, public.topik_exam_answers, public.topik_exam_explanations to authenticated;
grant select, insert, update, delete on public.topik_exam_attempts, public.topik_exam_user_answers to authenticated;
