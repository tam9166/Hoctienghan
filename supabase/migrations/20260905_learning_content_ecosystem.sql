-- P2: scalable curriculum content and audio storage.
-- Apply after 20260901_human_review_mentor_support.sql.

create table if not exists public.learning_content (
  id text primary key,
  type text not null check (type in ('lesson','vocabulary','grammar','audio','quiz','exercise')),
  title text not null check (char_length(title) between 1 and 160),
  verified boolean not null default false,
  difficulty text not null check (difficulty in ('TOPIK_0','TOPIK_1','TOPIK_2','TOPIK_3','TOPIK_4','TOPIK_5','TOPIK_6')),
  source text not null default 'curriculum' check (char_length(source) between 1 and 120),
  review_status text not null default 'draft' check (review_status in ('draft','approved','deprecated')),
  version integer not null default 1 check (version > 0),
  body jsonb not null default '{}'::jsonb,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_content_is_verified check (review_status <> 'approved' or verified)
);

create index if not exists learning_content_catalog_idx
  on public.learning_content (difficulty, type, review_status, updated_at desc);

alter table public.learning_content enable row level security;

drop policy if exists "learners read approved learning content" on public.learning_content;
create policy "learners read approved learning content"
  on public.learning_content for select to anon, authenticated
  using (review_status = 'approved' and verified = true);

drop policy if exists "admins read all learning content" on public.learning_content;
create policy "admins read all learning content"
  on public.learning_content for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists "admins create learning content" on public.learning_content;
create policy "admins create learning content"
  on public.learning_content for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists "admins update learning content" on public.learning_content;
create policy "admins update learning content"
  on public.learning_content for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learning-audio', 'learning-audio', true, 15728640, array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads approved learning audio" on storage.objects;
create policy "public reads approved learning audio"
  on storage.objects for select to public
  using (bucket_id = 'learning-audio');

drop policy if exists "admins upload learning audio" on storage.objects;
create policy "admins upload learning audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'learning-audio'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );
drop policy if exists "admins update learning audio" on storage.objects;
create policy "admins update learning audio"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'learning-audio'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  with check (
    bucket_id = 'learning-audio'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );
