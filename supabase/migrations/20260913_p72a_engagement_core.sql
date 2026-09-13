-- P72A: engagement-only XP, evidence-gated quests and bounded streak protection.
-- Additive only: SRS, mastery, TOPIK scores and existing progress are not modified.

create table if not exists public.learning_xp_events (
  event_id text not null check (char_length(event_id) between 8 and 220),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('lesson_completed','vocabulary_practice','srs_review','listening_practice','speaking_practice','writing_practice','grammar_practice','topik_practice','quick_practice','mission_completed','challenge_completed','quest_completed')),
  reference_id text not null check (char_length(reference_id) between 1 and 160),
  xp integer not null check (xp between 0 and 40),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, event_id)
);

create table if not exists public.engagement_quest_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id text not null check (char_length(quest_id) between 8 and 100),
  quest_type text not null check (quest_type in ('daily','weekly','monthly','special')),
  period_key text not null check (char_length(period_key) between 7 and 10),
  reward_type text not null check (reward_type in ('xp','badge','cosmetic','streak_freeze')),
  reward_amount integer not null check (reward_amount between 1 and 100),
  claimed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, quest_id)
);

create table if not exists public.streak_protection_events (
  event_id text not null check (char_length(event_id) between 8 and 220),
  user_id uuid not null references auth.users(id) on delete cascade,
  protected_date date not null,
  protection_type text not null check (protection_type in ('freeze','repair')),
  source_quest_id text check (source_quest_id is null or char_length(source_quest_id) <= 100),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, event_id),
  unique (user_id, protected_date)
);

alter table public.learning_xp_events enable row level security;
alter table public.engagement_quest_claims enable row level security;
alter table public.streak_protection_events enable row level security;

create policy "users read own learning xp" on public.learning_xp_events for select to authenticated using (user_id = auth.uid());
create policy "users read own quest claims" on public.engagement_quest_claims for select to authenticated using (user_id = auth.uid());
create policy "users read own streak protections" on public.streak_protection_events for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.learning_xp_events from anon, authenticated;
revoke insert, update, delete on public.engagement_quest_claims from anon, authenticated;
revoke insert, update, delete on public.streak_protection_events from anon, authenticated;

create or replace function public.record_learning_xp(p_event_id text, p_activity_type text, p_reference_id text)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  clean_event text := btrim(coalesce(p_event_id, ''));
  clean_activity text := btrim(coalesce(p_activity_type, ''));
  clean_reference text := btrim(coalesce(p_reference_id, ''));
  base_award integer;
  reference_limit integer;
  repeat_count integer;
  today_total integer;
  award integer;
  existing_award integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(clean_event) not between 8 and 220 or char_length(clean_reference) not between 1 and 160 then raise exception 'invalid engagement identity' using errcode = '22023'; end if;
  if clean_event !~ '^[A-Za-z0-9:_.-]+$' or clean_reference !~ '^[A-Za-z0-9:_.-]+$' then raise exception 'invalid engagement characters' using errcode = '22023'; end if;

  select rule.base_xp, rule.ref_limit into base_award, reference_limit from (values
    ('lesson_completed',10,1,'^completed_lesson:'), ('vocabulary_practice',8,3,'^practice_completed:'),
    ('srs_review',2,2,'^srs_updated:'), ('listening_practice',12,3,'^(listening_completed:|practice_completed:)'),
    ('speaking_practice',15,3,'^(speaking_completed:|practice_completed:)'), ('writing_practice',15,3,'^(writing_completed:|practice_completed:)'),
    ('grammar_practice',10,3,'^practice_completed:'), ('topik_practice',20,3,'^(topik_completed:|practice_completed:)'),
    ('quick_practice',6,3,'^practice_completed:'), ('mission_completed',20,1,'^mission:'),
    ('challenge_completed',40,1,'^challenge:'), ('quest_completed',10,1,'^quest-xp:')
  ) as rule(activity, base_xp, ref_limit, event_pattern)
  where rule.activity = clean_activity and clean_event ~ rule.event_pattern;
  if base_award is null then raise exception 'unrecognized or mismatched learning event' using errcode = '22023'; end if;
  if clean_activity = 'quest_completed' and not exists (select 1 from public.engagement_quest_claims where user_id = actor and quest_id = clean_reference and reward_type = 'xp') then raise exception 'quest reward is not claimable' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || current_date::text, 72));
  select xp into existing_award from public.learning_xp_events where user_id = actor and event_id = clean_event;
  if found then return existing_award; end if;
  if clean_activity in ('lesson_completed','mission_completed','challenge_completed','quest_completed') and exists (select 1 from public.learning_xp_events where user_id = actor and activity_type = clean_activity and reference_id = clean_reference) then return 0; end if;

  select count(*)::integer into repeat_count from public.learning_xp_events where user_id = actor and activity_type = clean_activity and reference_id = clean_reference and created_at >= date_trunc('day', timezone('utc', now())) and created_at < date_trunc('day', timezone('utc', now())) + interval '1 day';
  if repeat_count >= reference_limit then return 0; end if;
  select coalesce(sum(xp),0)::integer into today_total from public.learning_xp_events where user_id = actor and created_at >= date_trunc('day', timezone('utc', now())) and created_at < date_trunc('day', timezone('utc', now())) + interval '1 day';
  if today_total >= 300 then return 0; end if;

  award := greatest(1, least(case repeat_count when 0 then base_award when 1 then round(base_award * .5) else round(base_award * .25) end, 300 - today_total));
  insert into public.learning_xp_events(event_id,user_id,activity_type,reference_id,xp) values(clean_event,actor,clean_activity,clean_reference,award) on conflict (user_id,event_id) do nothing;
  select xp into existing_award from public.learning_xp_events where user_id = actor and event_id = clean_event;
  return coalesce(existing_award,0);
end;
$$;

create or replace function public.record_engagement_quest_claim(p_quest_id text, p_quest_type text, p_period_key text, p_reward_type text, p_reward_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  evidence_count integer := 0;
  expected_reward text;
  expected_amount integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_quest_type not in ('daily','weekly','monthly','special') or p_quest_id <> p_quest_type || '-' || p_period_key then raise exception 'invalid quest identity' using errcode = '22023'; end if;
  if p_quest_type = 'daily' then expected_reward := 'xp'; expected_amount := 10; select count(*)::integer into evidence_count from public.learning_xp_events where user_id=actor and created_at::date=p_period_key::date and activity_type not in ('quest_completed','challenge_completed');
  elsif p_quest_type = 'weekly' then expected_reward := 'streak_freeze'; expected_amount := 1; select count(distinct created_at::date)::integer into evidence_count from public.learning_xp_events where user_id=actor and created_at::date>=p_period_key::date and created_at::date<p_period_key::date+7 and activity_type not in ('quest_completed','challenge_completed','mission_completed'); evidence_count := case when evidence_count >= 5 then 1 else 0 end;
  elsif p_quest_type = 'monthly' then expected_reward := 'badge'; expected_amount := 1; select count(*)::integer into evidence_count from public.learning_xp_events where user_id=actor and to_char(created_at at time zone 'utc','YYYY-MM')=p_period_key and activity_type not in ('srs_review','quest_completed','challenge_completed','mission_completed'); evidence_count := case when evidence_count >= 20 then 1 else 0 end;
  else expected_reward := 'xp'; expected_amount := 40; select count(distinct activity_type)::integer into evidence_count from public.learning_xp_events where user_id=actor and to_char(created_at at time zone 'utc','YYYY-MM')=p_period_key and activity_type in ('vocabulary_practice','grammar_practice','listening_practice','speaking_practice','writing_practice','topik_practice','quick_practice'); evidence_count := case when evidence_count >= 5 then 1 else 0 end;
  end if;
  if evidence_count < 1 or p_reward_type <> expected_reward or p_reward_amount <> expected_amount then raise exception 'quest evidence or reward mismatch' using errcode = '42501'; end if;
  insert into public.engagement_quest_claims(user_id,quest_id,quest_type,period_key,reward_type,reward_amount) values(actor,p_quest_id,p_quest_type,p_period_key,p_reward_type,p_reward_amount) on conflict (user_id,quest_id) do nothing;
  return true;
end;
$$;

create or replace function public.record_streak_protection(p_event_id text, p_protected_date date, p_protection_type text, p_source_quest_id text default null)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  freeze_earned integer;
  freeze_used integer;
begin
  if actor is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_protection_type not in ('freeze','repair') or p_protected_date <> current_date - 1 or p_event_id <> 'streak-' || p_protection_type || ':' || p_protected_date::text then raise exception 'invalid streak protection' using errcode = '22023'; end if;
  if not exists (select 1 from public.learning_xp_events where user_id=actor and created_at::date=p_protected_date-1 and activity_type not in ('quest_completed','challenge_completed','mission_completed')) or exists (select 1 from public.learning_xp_events where user_id=actor and created_at::date=p_protected_date and activity_type not in ('quest_completed','challenge_completed','mission_completed')) then raise exception 'streak gap is not eligible' using errcode = '42501'; end if;
  if p_protection_type = 'freeze' then
    select coalesce(sum(reward_amount),0)::integer into freeze_earned from public.engagement_quest_claims where user_id=actor and reward_type='streak_freeze';
    select count(*)::integer into freeze_used from public.streak_protection_events where user_id=actor and protection_type='freeze';
    if freeze_earned <= freeze_used then raise exception 'no streak freeze available' using errcode = '42501'; end if;
  else
    if not exists (select 1 from public.learning_xp_events where user_id=actor and created_at::date=current_date and activity_type not in ('quest_completed','challenge_completed','mission_completed')) then raise exception 'repair task required' using errcode = '42501'; end if;
    if exists (select 1 from public.streak_protection_events where user_id=actor and protection_type='repair' and created_at>=timezone('utc',now())-interval '30 days') then raise exception 'repair cooldown active' using errcode = '42501'; end if;
  end if;
  insert into public.streak_protection_events(event_id,user_id,protected_date,protection_type,source_quest_id) values(p_event_id,actor,p_protected_date,p_protection_type,nullif(btrim(coalesce(p_source_quest_id,'')),'')) on conflict (user_id,event_id) do nothing;
  return true;
end;
$$;

revoke all on function public.record_learning_xp(text,text,text) from public, anon;
revoke all on function public.record_engagement_quest_claim(text,text,text,text,integer) from public, anon;
revoke all on function public.record_streak_protection(text,date,text,text) from public, anon;
grant execute on function public.record_learning_xp(text,text,text) to authenticated;
grant execute on function public.record_engagement_quest_claim(text,text,text,text,integer) to authenticated;
grant execute on function public.record_streak_protection(text,date,text,text) to authenticated;

create index if not exists learning_xp_user_time_idx on public.learning_xp_events(user_id,created_at desc);
create index if not exists learning_xp_reference_idx on public.learning_xp_events(user_id,activity_type,reference_id,created_at desc);
create index if not exists streak_protection_user_time_idx on public.streak_protection_events(user_id,created_at desc);

comment on table public.learning_xp_events is 'Engagement-only XP; never a mastery, proficiency or TOPIK score.';
comment on table public.engagement_quest_claims is 'Idempotent evidence-gated daily, weekly, monthly and special quest rewards.';
comment on table public.streak_protection_events is 'Bounded freeze and repair events; does not rewrite learning history.';
