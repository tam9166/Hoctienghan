-- P70: additive multi-language profiles, universal review state and lazy content registry.
-- Korean progress/SRS/mastery and the P69 education ecosystem are not rewritten.

create table if not exists public.language_learning_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  native_language text not null default 'vi' check (native_language in ('vi','en','ko','ja','zh')),
  current_level text,
  goal text not null default '' check (char_length(goal) <= 180),
  progress jsonb not null default '{"overall":0,"skills":{}}'::jsonb,
  weak_skills text[] not null default '{}'::text[],
  status text not null default 'learning' check (status in ('planned','learning','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, language_id),
  check (native_language <> language_id),
  check (jsonb_typeof(progress) = 'object')
);

create table if not exists public.language_learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  item_type text not null check (item_type in ('vocabulary','grammar','character','kanji','sentence')),
  content_id text not null check (char_length(content_id) between 1 and 160),
  strength integer not null default 0 check (strength between 0 and 100),
  review_count integer not null default 0 check (review_count >= 0),
  mastery jsonb not null default '{}'::jsonb,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, language_id, item_type, content_id),
  check (jsonb_typeof(mastery) = 'object')
);

create table if not exists public.language_writing_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  script_id text not null check (char_length(script_id) between 1 and 60),
  practice_mode text not null check (practice_mode in ('stroke_order','stroke','practice')),
  score integer not null default 0 check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.global_language_pack_catalog (
  pack_id text primary key,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  version integer not null default 1 check (version > 0),
  status text not null check (status in ('foundation','active','deprecated')),
  review_status text not null check (review_status in ('draft','review','approved','deprecated')),
  asset_path text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (status <> 'active' or review_status = 'approved')
);

create table if not exists public.language_content_registry (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete set null,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  content_type text not null check (content_type in ('lesson','vocabulary','grammar','listening','speaking','culture','exercise')),
  source_id text not null check (char_length(source_id) between 1 and 160),
  level text not null,
  skill text not null,
  topic text not null,
  status text not null default 'draft' check (status in ('draft','review','approved','published','deprecated')),
  review_status text not null default 'draft' check (review_status in ('draft','ai_checked','human_review','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, content_type, source_id),
  check (status not in ('approved','published') or review_status = 'approved')
);

insert into public.global_language_pack_catalog (pack_id,language_id,status,review_status,asset_path,metadata) values
  ('ko-core','ko','active','approved','content/language-packs/ko-core.json','{"contentEmbedded":false}'::jsonb),
  ('ja-foundation','ja','foundation','draft',null,'{}'::jsonb),
  ('zh-foundation','zh','foundation','draft',null,'{}'::jsonb),
  ('en-foundation','en','foundation','draft',null,'{}'::jsonb)
on conflict (pack_id) do update set version = global_language_pack_catalog.version + 1, status = excluded.status, review_status = excluded.review_status, asset_path = excluded.asset_path, metadata = excluded.metadata, updated_at = now();

alter table public.language_learning_profiles enable row level security;
alter table public.language_learning_items enable row level security;
alter table public.language_writing_attempts enable row level security;
alter table public.global_language_pack_catalog enable row level security;
alter table public.language_content_registry enable row level security;

create policy "users manage own language learning profiles" on public.language_learning_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own language review items" on public.language_learning_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own language writing attempts" on public.language_writing_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "learners read approved active language packs" on public.global_language_pack_catalog for select to authenticated
  using ((status = 'active' and review_status = 'approved') or public.has_any_role(array['reviewer','admin','super_admin']));
create policy "admins manage language pack registry" on public.global_language_pack_catalog for all to authenticated
  using (public.has_any_role(array['admin','super_admin'])) with check (public.has_any_role(array['admin','super_admin']));
create policy "learners read approved language content" on public.language_content_registry for select to authenticated
  using ((status = 'published' and review_status = 'approved') or creator_id = auth.uid() or public.has_any_role(array['reviewer','admin','super_admin']));
create policy "creators submit language content drafts" on public.language_content_registry for insert to authenticated
  with check (creator_id = auth.uid() and public.has_any_role(array['content_creator','content_editor']) and status = 'draft' and review_status = 'draft');
create policy "creators update own unapproved language content" on public.language_content_registry for update to authenticated
  using (creator_id = auth.uid() and status in ('draft','review'))
  with check (creator_id = auth.uid() and status in ('draft','review') and review_status in ('draft','ai_checked','human_review'));
create policy "reviewers approve language content" on public.language_content_registry for update to authenticated
  using (public.has_any_role(array['reviewer','admin','super_admin']) and creator_id is distinct from auth.uid())
  with check (public.has_any_role(array['reviewer','admin','super_admin']) and status in ('approved','deprecated') and review_status = 'approved');
create policy "super admins publish language content" on public.language_content_registry for update to authenticated
  using (public.has_any_role(array['admin','super_admin']) and status = 'approved' and review_status = 'approved')
  with check (public.has_any_role(array['admin','super_admin']) and status = 'published' and review_status = 'approved');

create or replace function public.set_active_language_profile(target_language text)
returns public.language_profiles language plpgsql security definer set search_path = public
as $$
declare result public.language_profiles;
begin
  if target_language not in ('ko','ja','zh','en') then raise exception 'unsupported language'; end if;
  if not exists (select 1 from public.language_learning_profiles profile where profile.user_id = auth.uid() and profile.language_id = target_language) then raise exception 'language profile required'; end if;
  insert into public.language_profiles (user_id,active_language,profiles,schema_version,updated_at)
  values (auth.uid(),target_language,'{}'::jsonb,2,now())
  on conflict (user_id) do update set active_language = excluded.active_language, schema_version = greatest(language_profiles.schema_version,2), updated_at = now()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.set_active_language_profile(text) from public;
grant execute on function public.set_active_language_profile(text) to authenticated;

create index if not exists language_learning_profiles_user_status_idx on public.language_learning_profiles(user_id,status,updated_at desc);
create index if not exists language_learning_items_due_idx on public.language_learning_items(user_id,language_id,next_review_at);
create index if not exists language_writing_attempts_user_language_idx on public.language_writing_attempts(user_id,language_id,created_at desc);
create index if not exists global_language_pack_status_idx on public.global_language_pack_catalog(language_id,status,review_status);
create index if not exists language_content_lookup_idx on public.language_content_registry(language_id,content_type,level,skill,topic,status);

comment on table public.language_learning_profiles is 'Owner-only level, goal and progress per target language. No credentials or chat content.';
comment on table public.language_learning_items is 'Universal SRS/mastery rows isolated by user and language.';
comment on table public.global_language_pack_catalog is 'Lazy pack metadata only; a catalog row does not imply released curriculum.';
