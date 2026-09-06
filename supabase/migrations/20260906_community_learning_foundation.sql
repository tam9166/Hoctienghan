-- P21 Community Learning Foundation.
-- Apply after the existing Auth/role migrations. Profiles are private by default.

create table if not exists public.community_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  level text not null default 'Beginner' check (char_length(level) <= 30),
  interests text[] not null default '{}',
  goal text not null default '' check (char_length(goal) <= 160),
  visibility text not null default 'private' check (visibility in ('private','groups','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(interests) <= 4)
);

create table if not exists public.community_groups (
  id text primary key check (char_length(id) between 3 and 80),
  title text not null check (char_length(title) between 1 and 120),
  track text not null check (track in ('topik','conversation','business')),
  level text not null check (char_length(level) <= 30),
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_group_members (
  group_id text not null references public.community_groups(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','left','removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.community_challenges (
  id text primary key check (char_length(id) between 3 and 80),
  title text not null check (char_length(title) between 1 and 120),
  duration_days integer not null check (duration_days between 1 and 365),
  status text not null default 'active' check (status in ('draft','active','closed')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.community_challenge_participants (
  challenge_id text not null references public.community_challenges(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  check_in_days date[] not null default '{}',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.community_questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  group_id text references public.community_groups(id) on delete set null,
  category text not null check (category in ('grammar','vocabulary')),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 800),
  status text not null default 'pending_review' check (status in ('pending_review','approved','answered','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.community_questions(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  status text not null default 'pending_review' check (status in ('pending_review','approved','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_answer_ratings (
  answer_id uuid not null references public.community_answers(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating text not null default 'useful' check (rating = 'useful'),
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create table if not exists public.community_learning_friends (
  follower_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists public.community_peer_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  topic text not null default 'conversation' check (char_length(topic) between 1 and 80),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.community_achievement_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  milestone_id text not null check (char_length(milestone_id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 160),
  reached_at timestamptz,
  visibility text not null default 'groups' check (visibility in ('private','groups')),
  created_at timestamptz not null default now(),
  unique (user_id, milestone_id)
);

create table if not exists public.community_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile','question','answer')),
  target_id text not null check (char_length(target_id) between 1 and 100),
  reason text not null check (reason in ('spam','harassment','unsafe_content','personal_information','misinformation')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'received' check (status in ('received','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.community_is_blocked(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null or (auth.uid() <> first_user and auth.uid() <> second_user) then true
    else exists (
      select 1 from public.community_blocks block
      where (block.blocker_id = first_user and block.blocked_id = second_user)
         or (block.blocker_id = second_user and block.blocked_id = first_user)
    )
  end;
$$;

create or replace function public.community_share_group(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null or (auth.uid() <> first_user and auth.uid() <> second_user) then false
    else exists (
      select 1 from public.community_group_members first_member
      join public.community_group_members second_member on second_member.group_id = first_member.group_id
      where first_member.user_id = first_user and second_member.user_id = second_user
        and first_member.status = 'active' and second_member.status = 'active'
    )
  end;
$$;

create or replace function public.community_can_read_question(target_question uuid, viewer uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null or auth.uid() <> viewer then false
    else exists (
      select 1 from public.community_questions question
      where question.id = target_question and (
        question.author_id = viewer or (
          question.status in ('approved','answered') and
          not public.community_is_blocked(viewer, question.author_id) and
          (question.group_id is null or exists (
            select 1 from public.community_group_members member
            where member.group_id = question.group_id and member.user_id = viewer and member.status = 'active'
          ))
        )
      )
    )
  end;
$$;

revoke all on function public.community_is_blocked(uuid, uuid) from public;
revoke all on function public.community_share_group(uuid, uuid) from public;
revoke all on function public.community_can_read_question(uuid, uuid) from public;
grant execute on function public.community_is_blocked(uuid, uuid) to authenticated;
grant execute on function public.community_share_group(uuid, uuid) to authenticated;
grant execute on function public.community_can_read_question(uuid, uuid) to authenticated;

create or replace function public.community_touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

do $$
declare table_name text;
begin
  foreach table_name in array array['community_profiles','community_groups','community_group_members','community_challenge_participants','community_questions','community_answers','community_peer_requests','community_reports']
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.community_touch_updated_at()', table_name || '_touch', table_name);
  end loop;
end $$;

alter table public.community_profiles enable row level security;
alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_challenges enable row level security;
alter table public.community_challenge_participants enable row level security;
alter table public.community_questions enable row level security;
alter table public.community_answers enable row level security;
alter table public.community_answer_ratings enable row level security;
alter table public.community_learning_friends enable row level security;
alter table public.community_peer_requests enable row level security;
alter table public.community_achievement_shares enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "community profile visibility" on public.community_profiles;
create policy "community profile visibility" on public.community_profiles for select to authenticated using (
  user_id = auth.uid() or (
    not public.community_is_blocked(auth.uid(), user_id) and
    (visibility = 'public' or (visibility = 'groups' and public.community_share_group(auth.uid(), user_id)))
  )
);
drop policy if exists "users create own community profile" on public.community_profiles;
create policy "users create own community profile" on public.community_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own community profile" on public.community_profiles;
create policy "users update own community profile" on public.community_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own community profile" on public.community_profiles;
create policy "users delete own community profile" on public.community_profiles for delete to authenticated using (user_id = auth.uid());

drop policy if exists "authenticated read active groups" on public.community_groups;
create policy "authenticated read active groups" on public.community_groups for select to authenticated using (status = 'active' or public.has_any_role(array['admin']));
drop policy if exists "admins manage community groups" on public.community_groups;
create policy "admins manage community groups" on public.community_groups for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

drop policy if exists "users read own group memberships" on public.community_group_members;
create policy "users read own group memberships" on public.community_group_members for select to authenticated using (user_id = auth.uid());
drop policy if exists "users join groups as self" on public.community_group_members;
create policy "users join groups as self" on public.community_group_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own group memberships" on public.community_group_members;
create policy "users update own group memberships" on public.community_group_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users leave own groups" on public.community_group_members;
create policy "users leave own groups" on public.community_group_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "authenticated read active challenges" on public.community_challenges;
create policy "authenticated read active challenges" on public.community_challenges for select to authenticated using (status = 'active' or public.has_any_role(array['admin']));
drop policy if exists "admins manage challenges" on public.community_challenges;
create policy "admins manage challenges" on public.community_challenges for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
drop policy if exists "users manage own challenge progress" on public.community_challenge_participants;
create policy "users manage own challenge progress" on public.community_challenge_participants for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read approved community questions" on public.community_questions;
create policy "read approved community questions" on public.community_questions for select to authenticated using (
  public.community_can_read_question(id, auth.uid())
);
drop policy if exists "users submit own questions" on public.community_questions;
create policy "users submit own questions" on public.community_questions for insert to authenticated with check (author_id = auth.uid() and status = 'pending_review');
drop policy if exists "users edit pending questions" on public.community_questions;
create policy "users edit pending questions" on public.community_questions for update to authenticated using (author_id = auth.uid() and status = 'pending_review') with check (author_id = auth.uid() and status = 'pending_review');

drop policy if exists "read approved community answers" on public.community_answers;
create policy "read approved community answers" on public.community_answers for select to authenticated using (author_id = auth.uid() or (status = 'approved' and not public.community_is_blocked(auth.uid(), author_id) and public.community_can_read_question(question_id, auth.uid())));
drop policy if exists "users submit own answers" on public.community_answers;
create policy "users submit own answers" on public.community_answers for insert to authenticated with check (author_id = auth.uid() and status = 'pending_review');
drop policy if exists "users rate answers once" on public.community_answer_ratings;
create policy "users rate answers once" on public.community_answer_ratings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users read own answer ratings" on public.community_answer_ratings;
create policy "users read own answer ratings" on public.community_answer_ratings for select to authenticated using (user_id = auth.uid());
drop policy if exists "users remove own answer ratings" on public.community_answer_ratings;
create policy "users remove own answer ratings" on public.community_answer_ratings for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users manage own learning friends" on public.community_learning_friends;
create policy "users manage own learning friends" on public.community_learning_friends for all to authenticated using (follower_id = auth.uid()) with check (follower_id = auth.uid() and not public.community_is_blocked(follower_id, followed_id));
drop policy if exists "participants read peer requests" on public.community_peer_requests;
create policy "participants read peer requests" on public.community_peer_requests for select to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "users send peer requests" on public.community_peer_requests;
create policy "users send peer requests" on public.community_peer_requests for insert to authenticated with check (sender_id = auth.uid() and status = 'pending' and not public.community_is_blocked(sender_id, recipient_id));
drop policy if exists "participants update peer requests" on public.community_peer_requests;
create policy "participants update peer requests" on public.community_peer_requests for update to authenticated using (sender_id = auth.uid() or recipient_id = auth.uid()) with check (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "milestone share visibility" on public.community_achievement_shares;
create policy "milestone share visibility" on public.community_achievement_shares for select to authenticated using (user_id = auth.uid() or (visibility = 'groups' and not public.community_is_blocked(auth.uid(), user_id) and public.community_share_group(auth.uid(), user_id)));
drop policy if exists "users manage own milestone shares" on public.community_achievement_shares;
create policy "users manage own milestone shares" on public.community_achievement_shares for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users manage own blocks" on public.community_blocks;
create policy "users manage own blocks" on public.community_blocks for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
drop policy if exists "users submit and read own reports" on public.community_reports;
create policy "users submit and read own reports" on public.community_reports for all to authenticated using (reporter_id = auth.uid()) with check (reporter_id = auth.uid() and status = 'received');
drop policy if exists "admins review community reports" on public.community_reports;
create policy "admins review community reports" on public.community_reports for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins update community reports" on public.community_reports;
create policy "admins update community reports" on public.community_reports for update to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

insert into public.community_groups (id, title, track, level, status) values
  ('group-topik-1', 'Cùng học TOPIK 1', 'topik', 'TOPIK 1', 'active'),
  ('group-conversation', 'Hội thoại mỗi ngày', 'conversation', 'Mixed', 'active'),
  ('group-business', 'Business Korean', 'business', 'TOPIK 3+', 'active')
on conflict (id) do update set title = excluded.title, track = excluded.track, level = excluded.level, status = excluded.status, updated_at = now();

insert into public.community_challenges (id, title, duration_days, status) values
  ('challenge-hangul-30', '30 ngày Hangul', 30, 'active')
on conflict (id) do update set title = excluded.title, duration_days = excluded.duration_days, status = excluded.status;

-- No public leaderboard is created. Aggregate community statistics should be exposed only
-- through a privacy-reviewed RPC that never returns per-user learning records.
