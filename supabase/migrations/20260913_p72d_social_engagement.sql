-- P72D: privacy-first leagues and small-group engagement.
-- Rankings are derived only from server-recorded P72A learning_xp_events.

alter table public.community_profiles add column if not exists leaderboard_visible boolean not null default false;

create table if not exists public.community_mutes (
  muter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create table if not exists public.social_friend_quests (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template_id text not null check (template_id in ('friend-500','friend-speaking')),
  title text not null check (char_length(title) between 1 and 120),
  target_xp integer not null check (target_xp between 100 and 2000),
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','completed','expired','cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at and ends_at <= starts_at + interval '14 days')
);

create table if not exists public.social_friend_quest_members (
  quest_id uuid not null references public.social_friend_quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited','accepted','declined','left')),
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (quest_id, user_id)
);

create table if not exists public.social_monthly_challenge_entries (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  challenge_id text not null check (challenge_id in ('monthly-learning-days','monthly-valid-xp')),
  month_key text not null check (month_key ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, challenge_id, month_key)
);

create table if not exists public.social_side_quest_claims (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid not null,
  quest_id text not null check (quest_id in ('side-listen','side-speak','side-remember','side-repair')),
  evidence_event_ids text[] not null check (cardinality(evidence_event_ids) between 1 and 10),
  reward_type text not null check (reward_type in ('xp','badge','cosmetic')),
  reward_amount integer not null check (reward_amount between 1 and 10),
  ranking_eligible boolean not null default false check (ranking_eligible = false),
  claimed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, run_id)
);

create table if not exists public.social_engagement_actions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action_id text not null check (char_length(action_id) between 8 and 100),
  action_type text not null check (action_type in ('privacy','friend-quest-create','monthly-join','side-quest-claim','mute','unmute')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, action_id)
);

alter table public.community_mutes enable row level security;
alter table public.social_friend_quests enable row level security;
alter table public.social_friend_quest_members enable row level security;
alter table public.social_monthly_challenge_entries enable row level security;
alter table public.social_side_quest_claims enable row level security;
alter table public.social_engagement_actions enable row level security;

create policy "users manage own mutes" on public.community_mutes for all to authenticated using (muter_id = auth.uid()) with check (muter_id = auth.uid());
create policy "quest members read friend quests" on public.social_friend_quests for select to authenticated using (exists (select 1 from public.social_friend_quest_members member where member.quest_id=id and member.user_id=auth.uid() and member.status in ('invited','accepted')));
create policy "users read own friend quest membership" on public.social_friend_quest_members for select to authenticated using (user_id=auth.uid());
create policy "users read own monthly entries" on public.social_monthly_challenge_entries for select to authenticated using (user_id = auth.uid());
create policy "users read own side claims" on public.social_side_quest_claims for select to authenticated using (user_id = auth.uid());
create policy "users read own social actions" on public.social_engagement_actions for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.social_friend_quests from anon, authenticated;
revoke insert, update, delete on public.social_friend_quest_members from anon, authenticated;
revoke insert, update, delete on public.social_monthly_challenge_entries from anon, authenticated;
revoke insert, update, delete on public.social_side_quest_claims from anon, authenticated;
revoke insert, update, delete on public.social_engagement_actions from anon, authenticated;

create or replace function public.get_korean_learning_leaderboard(p_week_start date default null, p_limit integer default 100)
returns table(user_id text, nickname text, valid_weekly_xp integer, event_count integer, tier text, server_verified boolean)
language sql stable security definer set search_path = public, auth, pg_temp
as $$
  with bounds as (
    select coalesce(p_week_start, (current_date - ((extract(isodow from current_date)::integer) - 1))) as week_start
  ), ranked as (
    select event.user_id,
      sum(event.xp)::integer as valid_weekly_xp,
      count(*)::integer as event_count
    from public.learning_xp_events event
    cross join bounds
    join public.community_profiles profile on profile.user_id=event.user_id
    where auth.uid() is not null
      and profile.leaderboard_visible = true
      and event.created_at >= bounds.week_start
      and event.created_at < bounds.week_start + interval '7 days'
      and event.activity_type in ('lesson_completed','vocabulary_practice','srs_review','listening_practice','speaking_practice','writing_practice','grammar_practice','topik_practice','quick_practice')
      and not public.community_is_blocked(auth.uid(), event.user_id)
      and not exists (select 1 from public.community_mutes mute where mute.muter_id=auth.uid() and mute.muted_id=event.user_id)
    group by event.user_id
  )
  select ranked.user_id::text,
    profile.display_name,
    ranked.valid_weekly_xp,
    ranked.event_count,
    case when ranked.valid_weekly_xp >= 1400 then 'Master' when ranked.valid_weekly_xp >= 900 then 'Platinum' when ranked.valid_weekly_xp >= 500 then 'Gold' when ranked.valid_weekly_xp >= 250 then 'Silver' else 'Bronze' end,
    true
  from ranked join public.community_profiles profile on profile.user_id=ranked.user_id
  order by ranked.valid_weekly_xp desc, profile.display_name asc
  limit least(greatest(coalesce(p_limit,100),1),100);
$$;

create or replace function public.get_friend_quest_progress(p_quest_id uuid)
returns table(user_id text, nickname text, valid_xp integer, server_verified boolean)
language sql stable security definer set search_path = public, auth, pg_temp
as $$
  select member.user_id::text,
    coalesce(profile.display_name,'Học viên'),
    coalesce(sum(event.xp),0)::integer,
    true
  from public.social_friend_quests quest
  join public.social_friend_quest_members viewer on viewer.quest_id=quest.id and viewer.user_id=auth.uid() and viewer.status='accepted'
  join public.social_friend_quest_members member on member.quest_id=quest.id and member.status='accepted'
  left join public.community_profiles profile on profile.user_id=member.user_id
  left join public.learning_xp_events event on event.user_id=member.user_id and event.created_at>=quest.starts_at and event.created_at<quest.ends_at and event.activity_type in ('lesson_completed','vocabulary_practice','srs_review','listening_practice','speaking_practice','writing_practice','grammar_practice','topik_practice','quick_practice')
  where quest.id=p_quest_id and not public.community_is_blocked(auth.uid(), member.user_id)
  group by member.user_id,profile.display_name;
$$;

create or replace function public.sync_social_engagement_action(p_action_id text, p_action_type text, p_payload jsonb)
returns boolean
language plpgsql security definer set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  quest_uuid uuid;
  target_uuid uuid;
  template text;
  challenge text;
  month_value text;
  side_quest text;
  side_run uuid;
  evidence text[];
  evidence_count integer;
  reward_type text;
  reward_amount integer;
  member_value text;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_action_id,''))) not between 8 and 100 or p_action_type not in ('privacy','friend-quest-create','monthly-join','side-quest-claim','mute','unmute') then raise exception 'invalid social action' using errcode='22023'; end if;
  if exists(select 1 from public.social_engagement_actions where user_id=actor and action_id=p_action_id) then return true; end if;

  if p_action_type='privacy' then
    if char_length(btrim(coalesce(p_payload->>'nickname',''))) not between 1 and 40 then raise exception 'invalid nickname' using errcode='22023'; end if;
    insert into public.community_profiles(user_id,display_name,visibility,leaderboard_visible)
      values(actor,btrim(p_payload->>'nickname'),case when coalesce((p_payload->>'profileVisible')::boolean,false) then 'public' else 'private' end,coalesce((p_payload->>'leaderboardVisible')::boolean,false))
      on conflict(user_id) do update set display_name=excluded.display_name,visibility=excluded.visibility,leaderboard_visible=excluded.leaderboard_visible,updated_at=timezone('utc',now());
  elsif p_action_type in ('mute','unmute') then
    target_uuid := (p_payload->>'targetId')::uuid;
    if target_uuid=actor then raise exception 'cannot mute self' using errcode='22023'; end if;
    if p_action_type='mute' then insert into public.community_mutes(muter_id,muted_id) values(actor,target_uuid) on conflict do nothing;
    else delete from public.community_mutes where muter_id=actor and muted_id=target_uuid; end if;
  elsif p_action_type='friend-quest-create' then
    quest_uuid := (p_payload->>'questId')::uuid; template := p_payload->>'templateId';
    if template not in ('friend-500','friend-speaking') then raise exception 'invalid friend quest template' using errcode='22023'; end if;
    insert into public.social_friend_quests(id,owner_id,template_id,title,target_xp,ends_at)
      values(quest_uuid,actor,template,case when template='friend-500' then 'Cùng nhau đạt 500 XP' else 'Tuần luyện nói' end,case when template='friend-500' then 500 else 300 end,timezone('utc',now())+interval '7 days');
    insert into public.social_friend_quest_members(quest_id,user_id,status,joined_at) values(quest_uuid,actor,'accepted',timezone('utc',now()));
    for member_value in select value from jsonb_array_elements_text(coalesce(p_payload->'participantIds','[]'::jsonb)) limit 3 loop
      target_uuid := member_value::uuid;
      if target_uuid<>actor and not public.community_is_blocked(actor,target_uuid) and exists(select 1 from public.community_learning_friends friend where (friend.follower_id=actor and friend.followed_id=target_uuid) or (friend.follower_id=target_uuid and friend.followed_id=actor)) then
        insert into public.social_friend_quest_members(quest_id,user_id,status) values(quest_uuid,target_uuid,'invited') on conflict do nothing;
      end if;
    end loop;
  elsif p_action_type='monthly-join' then
    challenge := p_payload->>'challengeId'; month_value := p_payload->>'month';
    if challenge not in ('monthly-learning-days','monthly-valid-xp') or month_value<>to_char(timezone('utc',now()),'YYYY-MM') then raise exception 'invalid monthly challenge' using errcode='22023'; end if;
    insert into public.social_monthly_challenge_entries(user_id,challenge_id,month_key) values(actor,challenge,month_value) on conflict do nothing;
  else
    side_run := (p_payload->>'runId')::uuid; side_quest := p_payload->>'questId';
    if side_quest='side-listen' then evidence_count:=1; reward_type:='xp'; reward_amount:=5;
    elsif side_quest='side-speak' then evidence_count:=3; reward_type:='badge'; reward_amount:=1;
    elsif side_quest='side-remember' then evidence_count:=10; reward_type:='cosmetic'; reward_amount:=1;
    elsif side_quest='side-repair' then evidence_count:=1; reward_type:='xp'; reward_amount:=5;
    else raise exception 'invalid side quest' using errcode='22023'; end if;
    select array_agg(event_id order by created_at desc) into evidence from (select event_id,created_at from public.learning_xp_events where user_id=actor and created_at>=date_trunc('day',timezone('utc',now())) and case when side_quest='side-listen' then activity_type='listening_practice' when side_quest='side-speak' then activity_type='speaking_practice' when side_quest='side-remember' then activity_type='srs_review' else activity_type in ('grammar_practice','quick_practice') end order by created_at desc limit evidence_count) valid;
    if coalesce(cardinality(evidence),0)<evidence_count then raise exception 'side quest evidence missing' using errcode='42501'; end if;
    insert into public.social_side_quest_claims(user_id,run_id,quest_id,evidence_event_ids,reward_type,reward_amount,ranking_eligible) values(actor,side_run,side_quest,evidence,reward_type,reward_amount,false) on conflict do nothing;
  end if;
  insert into public.social_engagement_actions(user_id,action_id,action_type) values(actor,p_action_id,p_action_type);
  return true;
end;
$$;

revoke all on function public.get_korean_learning_leaderboard(date,integer) from public,anon;
revoke all on function public.get_friend_quest_progress(uuid) from public,anon;
revoke all on function public.sync_social_engagement_action(text,text,jsonb) from public,anon;
grant execute on function public.get_korean_learning_leaderboard(date,integer) to authenticated;
grant execute on function public.get_friend_quest_progress(uuid) to authenticated;
grant execute on function public.sync_social_engagement_action(text,text,jsonb) to authenticated;

create index if not exists learning_xp_weekly_rank_idx on public.learning_xp_events(created_at desc,user_id) where activity_type in ('lesson_completed','vocabulary_practice','srs_review','listening_practice','speaking_practice','writing_practice','grammar_practice','topik_practice','quick_practice');
create index if not exists friend_quest_member_user_idx on public.social_friend_quest_members(user_id,status,quest_id);
create index if not exists social_action_user_time_idx on public.social_engagement_actions(user_id,created_at desc);

comment on function public.get_korean_learning_leaderboard(date,integer) is 'Returns opt-in nickname rankings from server-canonical weekly learning XP only; never exposes email.';
comment on table public.social_side_quest_claims is 'Evidence-backed side rewards; ranking_eligible is always false to prevent reward loops.';
