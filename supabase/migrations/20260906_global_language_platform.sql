-- P27: language-independent learner profiles. Content packs remain governed by their own review status.
create table if not exists public.language_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_language text not null default 'ko' check (active_language in ('ko','ja','zh','en')),
  profiles jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.language_profiles enable row level security;
drop policy if exists "users read own language profiles" on public.language_profiles;
create policy "users read own language profiles"
  on public.language_profiles for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "users insert own language profiles" on public.language_profiles;
create policy "users insert own language profiles"
  on public.language_profiles for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "users update own language profiles" on public.language_profiles;
create policy "users update own language profiles"
  on public.language_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.language_profiles is
  'One profile per learner with language-scoped goals and levels; no course content or credentials are stored here.';
