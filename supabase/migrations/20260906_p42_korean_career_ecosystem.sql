-- P42 Korean Professional Career Ecosystem
create table if not exists public.career_learning_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_path text not null default 'business' check (selected_path in ('it','business','tourism','translation','manufacturing','study-abroad')),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_activity_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null check (path_id in ('it','business','tourism','translation','manufacturing','study-abroad')),
  activity_type text not null check (activity_type in ('vocabulary','scenario','interview','resume','email','presentation')),
  source_id text not null,
  score smallint not null default 0 check (score between 0 and 100),
  metrics jsonb not null default '{}'::jsonb,
  raw_draft_stored boolean not null default false check (raw_draft_stored = false),
  completed_at timestamptz not null default now()
);

create table if not exists public.career_resume_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  path_id text not null check (path_id in ('it','business','tourism','translation','manufacturing','study-abroad')),
  headline text not null default '' check (char_length(headline) <= 100),
  summary text not null default '' check (char_length(summary) <= 600),
  experience text not null default '' check (char_length(experience) <= 1800),
  skills text not null default '' check (char_length(skills) <= 600),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern_id text not null,
  subject text not null default '' check (char_length(subject) <= 160),
  body text not null default '' check (char_length(body) <= 2400),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_presentation_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  path_id text not null check (path_id in ('it','business','tourism','translation','manufacturing','study-abroad')),
  opening text not null default '' check (char_length(opening) <= 1000),
  structure text not null default '' check (char_length(structure) <= 1000),
  closing text not null default '' check (char_length(closing) <= 1000),
  updated_at timestamptz not null default now()
);

create index if not exists career_activity_user_created_idx on public.career_activity_summaries(user_id, completed_at desc);
create index if not exists career_activity_path_type_idx on public.career_activity_summaries(user_id, path_id, activity_type);
create index if not exists career_email_user_updated_idx on public.career_email_drafts(user_id, updated_at desc);

alter table public.career_learning_profiles enable row level security;
alter table public.career_activity_summaries enable row level security;
alter table public.career_resume_drafts enable row level security;
alter table public.career_email_drafts enable row level security;
alter table public.career_presentation_drafts enable row level security;

create policy "career profiles are private" on public.career_learning_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "career activity is private" on public.career_activity_summaries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "career resumes are private" on public.career_resume_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "career emails are private" on public.career_email_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "career presentations are private" on public.career_presentation_drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.career_activity_summaries is 'Derived career-learning metrics only; CV, email and presentation draft text is excluded from analytics.';
comment on table public.career_resume_drafts is 'Private user-authored Korean resume. Never available to another learner.';
