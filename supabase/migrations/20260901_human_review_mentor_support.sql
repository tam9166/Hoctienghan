-- Release 4: human content review and least-privilege mentor support.
-- Run manually in the Supabase SQL editor after reviewing your project policies.
-- No service_role key or client-side role assignment is used by this migration.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','teacher','reviewer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

create or replace function public.has_any_role(required_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = any(required_roles)); $$;
revoke all on function public.has_any_role(text[]) from public;
grant execute on function public.has_any_role(text[]) to authenticated;
drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role" on public.user_roles for select using (auth.uid() = user_id);

create table if not exists public.content_reviews (
  content_id text not null,
  content_type text not null,
  status text not null check (status in ('draft','in_review','reviewed','needs_revision','published')),
  author_id uuid references auth.users(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  review_notes text not null default '',
  primary key (content_id, content_type)
);
alter table public.content_reviews enable row level security;
drop policy if exists "users read published content reviews" on public.content_reviews;
create policy "users read published content reviews" on public.content_reviews for select to authenticated using (status in ('reviewed','published') or public.has_any_role(array['reviewer','admin']));
drop policy if exists "reviewers manage content reviews" on public.content_reviews;
create policy "reviewers manage content reviews" on public.content_reviews for all to authenticated using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lesson','question','writing','speaking','grammar','error_notebook','general')),
  source_id text not null default '',
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'open' check (status in ('open','assigned','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_teacher_id uuid references auth.users(id) on delete set null
);
alter table public.support_requests enable row level security;
drop policy if exists "students read own support requests" on public.support_requests;
create policy "students read own support requests" on public.support_requests for select to authenticated using (auth.uid() = user_id or (assigned_teacher_id = auth.uid() and public.has_any_role(array['teacher','reviewer','admin'])) or public.has_any_role(array['reviewer','admin']));
drop policy if exists "students create own support requests" on public.support_requests;
create policy "students create own support requests" on public.support_requests for insert to authenticated with check (auth.uid() = user_id and not public.has_any_role(array['teacher','reviewer','admin']));
drop policy if exists "assigned staff update support requests" on public.support_requests;
create policy "assigned staff update support requests" on public.support_requests for update to authenticated using ((assigned_teacher_id = auth.uid() and public.has_any_role(array['teacher','reviewer','admin'])) or public.has_any_role(array['reviewer','admin'])) with check ((assigned_teacher_id = auth.uid() and public.has_any_role(array['teacher','reviewer','admin'])) or public.has_any_role(array['reviewer','admin']));

create table if not exists public.support_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  responder_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 4000),
  linked_content_id text,
  created_at timestamptz not null default now()
);
alter table public.support_responses enable row level security;
drop policy if exists "support participants read responses" on public.support_responses;
create policy "support participants read responses" on public.support_responses for select to authenticated using (exists (select 1 from public.support_requests r where r.id = request_id and (r.user_id = auth.uid() or r.assigned_teacher_id = auth.uid() or public.has_any_role(array['reviewer','admin']))));
drop policy if exists "staff create support responses" on public.support_responses;
create policy "staff create support responses" on public.support_responses for insert to authenticated with check (responder_id = auth.uid() and public.has_any_role(array['teacher','reviewer','admin']) and exists (select 1 from public.support_requests r where r.id = request_id and (r.assigned_teacher_id = auth.uid() or public.has_any_role(array['reviewer','admin']))));

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,
  content_type text not null,
  report_type text not null check (report_type in ('typo','meaning','audio','answer','other')),
  message text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.content_reports enable row level security;
drop policy if exists "users manage own content reports" on public.content_reports;
create policy "users manage own content reports" on public.content_reports for select using (auth.uid() = user_id);
create policy "users create own content reports" on public.content_reports for insert with check (auth.uid() = user_id);
drop policy if exists "reviewers read content reports" on public.content_reports;
create policy "reviewers read content reports" on public.content_reports for select to authenticated using (public.has_any_role(array['reviewer','admin']));
drop policy if exists "reviewers manage content reports" on public.content_reports;
create policy "reviewers manage content reports" on public.content_reports for update using (public.has_any_role(array['reviewer','admin'])) with check (public.has_any_role(array['reviewer','admin']));
