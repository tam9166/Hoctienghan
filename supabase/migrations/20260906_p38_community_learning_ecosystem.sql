-- P38 Community Learning Ecosystem.
-- Extends P21 with opt-in language exchange and auditable moderation.

create table if not exists public.community_language_exchange_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  native_language text not null check (native_language in ('vi','ko','en','zh')),
  learning_language text not null check (learning_language in ('vi','ko','en','zh')),
  korean_level text not null default 'Beginner' check (char_length(korean_level) <= 30),
  topics text[] not null default '{}',
  practice_formats text[] not null default '{}',
  availability text not null default 'evening' check (availability in ('morning','afternoon','evening','weekend')),
  discovery_enabled boolean not null default false,
  accepts_requests boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (native_language <> learning_language),
  check (accepts_requests = false or discovery_enabled = true),
  check (cardinality(topics) between 1 and 3),
  check (cardinality(practice_formats) between 1 and 2),
  check (topics <@ array['greeting','daily-life','travel','topik','work','culture']::text[]),
  check (practice_formats <@ array['text-prompts','voice-scenario','shadowing']::text[])
);

create table if not exists public.community_exchange_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic in ('greeting','daily-life','travel','topik','work','culture')),
  practice_format text not null check (practice_format in ('text-prompts','voice-scenario','shadowing')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create unique index if not exists community_exchange_active_request_idx
  on public.community_exchange_requests(sender_id, recipient_id)
  where status in ('pending','accepted');
create index if not exists community_exchange_recipient_idx
  on public.community_exchange_requests(recipient_id, status, updated_at desc);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('report','question','answer','profile')),
  target_id text not null check (char_length(target_id) between 1 and 100),
  decision text not null check (decision in ('reviewing','resolved','dismissed','approved','removed')),
  notes text not null default '' check (char_length(notes) <= 500),
  hard_delete boolean not null default false check (hard_delete = false),
  created_at timestamptz not null default now()
);

drop trigger if exists community_language_exchange_profiles_touch on public.community_language_exchange_profiles;
create trigger community_language_exchange_profiles_touch before update on public.community_language_exchange_profiles
  for each row execute function public.community_touch_updated_at();
drop trigger if exists community_exchange_requests_touch on public.community_exchange_requests;
create trigger community_exchange_requests_touch before update on public.community_exchange_requests
  for each row execute function public.community_touch_updated_at();

create or replace function public.guard_community_exchange_request_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sender_id <> old.sender_id or new.recipient_id <> old.recipient_id or new.topic <> old.topic or new.practice_format <> old.practice_format then
    raise exception 'Exchange request participants and learning scope are immutable';
  end if;
  if new.status <> old.status then
    if auth.uid() = old.sender_id and new.status = 'cancelled' then null;
    elsif auth.uid() = old.recipient_id and old.status = 'pending' and new.status in ('accepted', 'declined') then null;
    else raise exception 'Invalid exchange request transition';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_community_exchange_request_transition on public.community_exchange_requests;
create trigger guard_community_exchange_request_transition before update on public.community_exchange_requests
  for each row execute function public.guard_community_exchange_request_transition();

alter table public.community_language_exchange_profiles enable row level security;
alter table public.community_exchange_requests enable row level security;
alter table public.community_moderation_actions enable row level security;

drop policy if exists "users read safe discoverable exchange profiles" on public.community_language_exchange_profiles;
create policy "users read safe discoverable exchange profiles" on public.community_language_exchange_profiles
  for select to authenticated using (
    user_id = auth.uid() or (
      discovery_enabled = true
      and not public.community_is_blocked(auth.uid(), user_id)
    )
  );
drop policy if exists "users create own exchange profile" on public.community_language_exchange_profiles;
create policy "users create own exchange profile" on public.community_language_exchange_profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own exchange profile" on public.community_language_exchange_profiles;
create policy "users update own exchange profile" on public.community_language_exchange_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own exchange profile" on public.community_language_exchange_profiles;
create policy "users delete own exchange profile" on public.community_language_exchange_profiles
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "participants read exchange requests" on public.community_exchange_requests;
create policy "participants read exchange requests" on public.community_exchange_requests
  for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "users send allowed exchange requests" on public.community_exchange_requests;
create policy "users send allowed exchange requests" on public.community_exchange_requests
  for insert to authenticated with check (
    sender_id = auth.uid()
    and status = 'pending'
    and not public.community_is_blocked(sender_id, recipient_id)
    and exists (
      select 1 from public.community_language_exchange_profiles recipient
      where recipient.user_id = recipient_id
        and recipient.discovery_enabled = true
        and recipient.accepts_requests = true
    )
  );
drop policy if exists "participants update exchange requests" on public.community_exchange_requests;
create policy "participants update exchange requests" on public.community_exchange_requests
  for update to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "admins read moderation actions" on public.community_moderation_actions;
create policy "admins read moderation actions" on public.community_moderation_actions
  for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins create moderation actions" on public.community_moderation_actions;
create policy "admins create moderation actions" on public.community_moderation_actions
  for insert to authenticated with check (
    moderator_id = auth.uid()
    and public.has_any_role(array['admin'])
    and hard_delete = false
  );

drop policy if exists "admins read pending community questions" on public.community_questions;
create policy "admins read pending community questions" on public.community_questions
  for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins moderate community questions" on public.community_questions;
drop policy if exists "admins read pending community answers" on public.community_answers;
create policy "admins read pending community answers" on public.community_answers
  for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins moderate community answers" on public.community_answers;
drop policy if exists "admins update community reports" on public.community_reports;

create or replace function public.moderate_community_item(target_kind text, target_identifier uuid, moderation_decision text, moderation_notes text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare action_id uuid := gen_random_uuid();
begin
  if not public.has_any_role(array['admin']) then raise exception 'Admin role required'; end if;
  if char_length(coalesce(moderation_notes, '')) > 500 then raise exception 'Moderation notes too long'; end if;
  if target_kind = 'report' and moderation_decision in ('reviewing','resolved','dismissed') then
    update public.community_reports set status = moderation_decision where id = target_identifier;
  elsif target_kind = 'question' and moderation_decision in ('approved','removed') then
    update public.community_questions set status = moderation_decision where id = target_identifier;
  elsif target_kind = 'answer' and moderation_decision in ('approved','removed') then
    update public.community_answers set status = moderation_decision where id = target_identifier;
  else raise exception 'Invalid moderation decision';
  end if;
  if not found then raise exception 'Moderation target not found'; end if;
  insert into public.community_moderation_actions(id, moderator_id, target_type, target_id, decision, notes, hard_delete)
    values(action_id, auth.uid(), target_kind, target_identifier::text, moderation_decision, coalesce(moderation_notes, ''), false);
  return action_id;
end;
$$;
revoke all on function public.moderate_community_item(text, uuid, text, text) from public;
grant execute on function public.moderate_community_item(text, uuid, text, text) to authenticated;

comment on table public.community_language_exchange_profiles is 'Opt-in matching fields only; no email, phone, precise location or private learning history.';
comment on table public.community_exchange_requests is 'Structured learning invitations only. Direct messaging and contact fields are intentionally absent.';
comment on table public.community_moderation_actions is 'Immutable admin audit trail; moderation changes status and never hard-deletes content.';
