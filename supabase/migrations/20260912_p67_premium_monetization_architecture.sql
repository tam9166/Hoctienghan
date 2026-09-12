-- P67: ethical Free/Premium/Pro subscriptions and server-authoritative entitlements.
-- This migration never deletes or rewrites learning progress, SRS, mastery,
-- offline packs, journals, lesson history or CloudSync snapshots.

alter table public.commercial_subscriptions drop constraint if exists commercial_subscriptions_tier_check;
alter table public.commercial_subscriptions drop constraint if exists commercial_subscriptions_status_check;
alter table public.commercial_plan_entitlements drop constraint if exists commercial_plan_entitlements_plan_check;

update public.commercial_subscriptions set status = case status
  when 'trialing' then 'trial'
  when 'canceled' then 'cancelled'
  when 'past_due' then 'expired'
  when 'inactive' then 'expired'
  else status end;

alter table public.commercial_subscriptions
  add constraint commercial_subscriptions_tier_check check (tier in ('free','premium','pro')),
  add constraint commercial_subscriptions_status_check check (status in ('trial','active','expired','cancelled')),
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists payment_provider text
    check (payment_provider is null or payment_provider in ('stripe','google_play','apple_store','local_payment','admin_grant')),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists status_reason text not null default '' check (char_length(status_reason) <= 500);

update public.commercial_subscriptions
set start_date = coalesce(start_date, created_at),
    end_date = coalesce(end_date, current_period_end),
    payment_provider = coalesce(payment_provider,
      case when provider in ('stripe','google_play','apple_store','local_payment') then provider else null end);

alter table public.commercial_plan_entitlements
  add constraint commercial_plan_entitlements_plan_check check (plan in ('free','premium','pro'));

insert into public.commercial_plan_entitlements (plan, feature_key, enabled, limits) values
  ('free','hangul_foundation',true,'{}'),
  ('free','basic_lessons',true,'{}'),
  ('free','basic_vocabulary',true,'{}'),
  ('free','basic_srs',true,'{}'),
  ('free','progress_tracking',true,'{}'),
  ('free','ai_assistance',true,'{"daily_requests":5}'),
  ('premium','hangul_foundation',true,'{}'),
  ('premium','basic_lessons',true,'{}'),
  ('premium','basic_vocabulary',true,'{}'),
  ('premium','basic_srs',true,'{}'),
  ('premium','progress_tracking',true,'{}'),
  ('premium','full_topik_roadmap',true,'{}'),
  ('premium','advanced_analytics',true,'{}'),
  ('premium','ai_assistance',true,'{"daily_requests":50}'),
  ('premium','advanced_speaking_feedback',true,'{}'),
  ('premium','personalized_learning_plan',true,'{}'),
  ('pro','hangul_foundation',true,'{}'),
  ('pro','basic_lessons',true,'{}'),
  ('pro','basic_vocabulary',true,'{}'),
  ('pro','basic_srs',true,'{}'),
  ('pro','progress_tracking',true,'{}'),
  ('pro','full_topik_roadmap',true,'{}'),
  ('pro','advanced_analytics',true,'{}'),
  ('pro','ai_assistance',true,'{"daily_requests":200,"fair_use":true}'),
  ('pro','advanced_speaking_feedback',true,'{}'),
  ('pro','personalized_learning_plan',true,'{}'),
  ('pro','career_korean',true,'{}'),
  ('pro','interview_practice',true,'{}'),
  ('pro','business_korean',true,'{}'),
  ('pro','professional_writing',true,'{}')
on conflict (plan, feature_key) do update
set enabled = excluded.enabled, limits = excluded.limits, updated_at = now();

-- Capability-family audit: every core family remains available on every plan;
-- Premium families flow through to Pro without weakening the free foundation.
insert into public.commercial_plan_entitlements (plan, feature_key, enabled, limits)
select plans.plan, features.feature_key, true, '{}'::jsonb
from (values ('free'),('premium'),('pro')) as plans(plan)
cross join (values
  ('beginner_path'),('basic_grammar'),('basic_listening'),('basic_speaking'),('basic_writing'),
  ('dictionary_translation'),('handwriting_pronunciation'),('offline_core'),('daily_learning'),
  ('mastery_error_notebook'),('journal_achievements'),('community_foundation')
) as features(feature_key)
on conflict (plan, feature_key) do update set enabled = true, limits = '{}'::jsonb, updated_at = now();

insert into public.commercial_plan_entitlements (plan, feature_key, enabled, limits)
select plans.plan, features.feature_key, true, '{}'::jsonb
from (values ('premium'),('pro')) as plans(plan)
cross join (values
  ('topik_mock_exams'),('conversation_simulator'),('reading_dictation_labs'),('immersion_scenarios'),
  ('advanced_voice_analysis'),('learning_outcome_reports'),('real_world_assistant')
) as features(feature_key)
on conflict (plan, feature_key) do update set enabled = true, limits = '{}'::jsonb, updated_at = now();

insert into public.commercial_plan_entitlements (plan, feature_key, enabled, limits) values
  ('pro','teacher_feedback',true,'{}')
on conflict (plan, feature_key) do update set enabled = true, limits = '{}'::jsonb, updated_at = now();

create table if not exists public.commercial_subscription_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'premium' check (plan = 'premium'),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  payment_method_collected boolean not null default false,
  auto_charge boolean not null default false,
  check (ends_at > started_at),
  check (payment_method_collected = false and auto_charge = false)
);

create table if not exists public.commercial_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_plan text not null check (subscription_plan in ('premium','pro')),
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'requested' check (status in ('requested','provider_pending','confirmed','rejected')),
  preserve_learning_progress boolean not null default true check (preserve_learning_progress = true),
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.commercial_subscription_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('trial_started','plan_granted','plan_revoked','status_changed','cancellation_requested','provider_webhook')),
  from_plan text check (from_plan is null or from_plan in ('free','premium','pro')),
  to_plan text check (to_plan is null or to_plan in ('free','premium','pro')),
  from_status text,
  to_status text,
  reason text not null default '' check (char_length(reason) <= 500),
  source text not null check (source in ('server_rpc','admin_rpc','provider_webhook','server_api')),
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  token_count bigint not null default 0 check (token_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.commercial_pricing_research (
  id uuid primary key default gen_random_uuid(),
  segment text not null,
  learner_value_score integer check (learner_value_score between 0 and 100),
  operating_cost_band text check (operating_cost_band in ('low','medium','high')),
  affordability_notes text not null default '' check (char_length(affordability_notes) <= 1000),
  price_amount numeric(12,2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  status text not null default 'research' check (status in ('research','review','approved','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or (price_amount is not null and currency is not null))
);

alter table public.commercial_subscription_trials enable row level security;
alter table public.commercial_cancellation_requests enable row level security;
alter table public.commercial_subscription_audit enable row level security;
alter table public.commercial_ai_usage_daily enable row level security;
alter table public.commercial_pricing_research enable row level security;

drop policy if exists "users read own trial" on public.commercial_subscription_trials;
create policy "users read own trial" on public.commercial_subscription_trials for select to authenticated using (user_id = auth.uid());
drop policy if exists "users request own cancellation" on public.commercial_cancellation_requests;
create policy "users request own cancellation" on public.commercial_cancellation_requests for insert to authenticated with check (user_id = auth.uid() and preserve_learning_progress);
drop policy if exists "users read own cancellation" on public.commercial_cancellation_requests;
create policy "users read own cancellation" on public.commercial_cancellation_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins manage cancellation" on public.commercial_cancellation_requests;
create policy "admins manage cancellation" on public.commercial_cancellation_requests for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
drop policy if exists "admins read subscription audit" on public.commercial_subscription_audit;
create policy "admins read subscription audit" on public.commercial_subscription_audit for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "users read own ai usage" on public.commercial_ai_usage_daily;
create policy "users read own ai usage" on public.commercial_ai_usage_daily for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins manage pricing research" on public.commercial_pricing_research;
create policy "admins manage pricing research" on public.commercial_pricing_research for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

create or replace function public.commercial_current_tier()
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select subscription.tier
    from public.commercial_subscriptions subscription
    where subscription.user_id = auth.uid()
      and subscription.tier in ('premium','pro')
      and (
        subscription.status in ('active','trial')
        or (subscription.status = 'cancelled' and subscription.end_date > now())
      )
      and (subscription.end_date is null or subscription.end_date > now())
    limit 1
  ), 'free');
$$;

create or replace function public.commercial_has_entitlement(target_feature text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null and exists (
    select 1 from public.commercial_plan_entitlements entitlement
    where entitlement.plan = public.commercial_current_tier()
      and entitlement.feature_key = target_feature
      and entitlement.enabled
  );
$$;

drop function if exists public.commercial_current_subscription();
create function public.commercial_current_subscription()
returns table (
  plan text, status text, start_date timestamptz, end_date timestamptz,
  payment_provider text, entitlements jsonb, ai_daily_limit integer, server_time timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  with current_subscription as (
    select subscription.* from public.commercial_subscriptions subscription
    where subscription.user_id = auth.uid() limit 1
  ), effective as (
    select public.commercial_current_tier() as plan
  )
  select
    effective.plan,
    case when effective.plan = 'free' then 'active' else current_subscription.status end,
    current_subscription.start_date,
    current_subscription.end_date,
    current_subscription.payment_provider,
    coalesce((select jsonb_object_agg(feature_key, jsonb_build_object('enabled', enabled, 'limits', limits)) from public.commercial_plan_entitlements where commercial_plan_entitlements.plan = effective.plan and enabled), '{}'::jsonb),
    coalesce((select (limits ->> 'daily_requests')::integer from public.commercial_plan_entitlements where commercial_plan_entitlements.plan = effective.plan and feature_key = 'ai_assistance' and enabled), 0),
    now()
  from effective left join current_subscription on true;
$$;

create or replace function public.commercial_start_trial(accepted_no_auto_charge boolean)
returns table (plan text, status text, start_date timestamptz, end_date timestamptz)
language plpgsql security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid();
  trial_end timestamptz := now() + interval '7 days';
begin
  if actor is null or accepted_no_auto_charge is not true then raise exception 'Explicit no-auto-charge confirmation required'; end if;
  if exists (select 1 from public.commercial_subscription_trials where user_id = actor) then raise exception 'Trial already used'; end if;
  if public.commercial_current_tier() <> 'free' then raise exception 'Paid entitlement already active'; end if;

  insert into public.commercial_subscription_trials (user_id, plan, ends_at) values (actor, 'premium', trial_end);
  insert into public.commercial_subscriptions (user_id, tier, status, start_date, end_date, payment_provider, current_period_end, status_reason)
    values (actor, 'premium', 'trial', now(), trial_end, null, trial_end, 'seven_day_no_auto_charge_trial')
  on conflict (user_id) do update set tier = 'premium', status = 'trial', start_date = now(), end_date = trial_end,
    current_period_end = trial_end, payment_provider = null, provider = null, provider_customer_ref = null,
    provider_subscription_ref = null, cancel_at_period_end = false, status_reason = 'seven_day_no_auto_charge_trial', updated_at = now();
  insert into public.commercial_subscription_audit (user_id, actor_id, action, from_plan, to_plan, to_status, reason, source)
    values (actor, actor, 'trial_started', 'free', 'premium', 'trial', 'no payment method; no auto charge', 'server_rpc');
  return query select 'premium'::text, 'trial'::text, now(), trial_end;
end;
$$;

create or replace function public.commercial_claim_ai_usage(request_tokens integer default 0)
returns table (allowed boolean, plan text, used integer, daily_limit integer, remaining integer)
language plpgsql security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid();
  active_plan text;
  max_requests integer;
  current_used integer;
  next_used integer;
begin
  if actor is null then return query select false, 'free'::text, 0, 0, 0; return; end if;
  active_plan := public.commercial_current_tier();
  select coalesce((limits ->> 'daily_requests')::integer, 0) into max_requests
    from public.commercial_plan_entitlements where commercial_plan_entitlements.plan = active_plan and feature_key = 'ai_assistance' and enabled;
  insert into public.commercial_ai_usage_daily (user_id, usage_date, request_count, token_count)
    values (actor, current_date, 0, 0)
  on conflict (user_id, usage_date) do nothing;
  select request_count into current_used from public.commercial_ai_usage_daily
    where user_id = actor and usage_date = current_date for update;
  if current_used >= max_requests then
    return query select false, active_plan, current_used, max_requests, 0;
    return;
  end if;
  update public.commercial_ai_usage_daily
    set request_count = request_count + 1,
        token_count = token_count + greatest(0, request_tokens), updated_at = now()
    where user_id = actor and usage_date = current_date
    returning request_count into next_used;
  return query select true, active_plan, next_used, max_requests, greatest(0, max_requests - next_used);
end;
$$;

create or replace function public.commercial_admin_set_subscription(target_user_id uuid, target_plan text, target_status text, target_end_date timestamptz, change_reason text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid(); previous public.commercial_subscriptions%rowtype;
begin
  if not public.has_any_role(array['admin']) then raise exception 'Admin role required'; end if;
  if target_plan not in ('free','premium','pro') or target_status not in ('trial','active','expired','cancelled') then raise exception 'Invalid subscription state'; end if;
  if char_length(coalesce(change_reason,'')) < 3 then raise exception 'Audit reason required'; end if;
  select * into previous from public.commercial_subscriptions where user_id = target_user_id;
  insert into public.commercial_subscriptions (user_id, tier, status, start_date, end_date, payment_provider, current_period_end, status_reason)
    values (target_user_id, target_plan, target_status, now(), target_end_date, 'admin_grant', target_end_date, left(change_reason,500))
  on conflict (user_id) do update set tier = excluded.tier, status = excluded.status, end_date = excluded.end_date,
    current_period_end = excluded.current_period_end, payment_provider = excluded.payment_provider,
    status_reason = excluded.status_reason, updated_at = now();
  insert into public.commercial_subscription_audit (user_id, actor_id, action, from_plan, to_plan, from_status, to_status, reason, source)
    values (target_user_id, actor, case when target_plan = 'free' or target_status in ('expired','cancelled') then 'plan_revoked' else 'plan_granted' end,
      previous.tier, target_plan, previous.status, target_status, left(change_reason,500), 'admin_rpc');
  return jsonb_build_object('user_id',target_user_id,'plan',target_plan,'status',target_status,'end_date',target_end_date,'audited',true);
end;
$$;

revoke all on function public.commercial_current_subscription() from public;
revoke all on function public.commercial_current_tier() from public;
revoke all on function public.commercial_has_entitlement(text) from public;
revoke all on function public.commercial_start_trial(boolean) from public;
revoke all on function public.commercial_claim_ai_usage(integer) from public;
revoke all on function public.commercial_admin_set_subscription(uuid,text,text,timestamptz,text) from public;
grant execute on function public.commercial_current_subscription() to authenticated;
grant execute on function public.commercial_current_tier() to authenticated;
grant execute on function public.commercial_has_entitlement(text) to authenticated;
grant execute on function public.commercial_start_trial(boolean) to authenticated;
grant execute on function public.commercial_claim_ai_usage(integer) to authenticated;
grant execute on function public.commercial_admin_set_subscription(uuid,text,text,timestamptz,text) to authenticated;

create index if not exists commercial_subscription_status_idx on public.commercial_subscriptions(tier, status, end_date);
create index if not exists commercial_cancellation_user_idx on public.commercial_cancellation_requests(user_id, requested_at desc);
create index if not exists commercial_subscription_audit_user_idx on public.commercial_subscription_audit(user_id, created_at desc);
create index if not exists commercial_ai_usage_date_idx on public.commercial_ai_usage_daily(usage_date desc, request_count);

comment on table public.commercial_subscription_trials is 'One no-payment, no-auto-charge Premium trial per user.';
comment on table public.commercial_subscription_audit is 'Server/admin/webhook subscription changes. Learning data is explicitly outside this ledger.';
comment on table public.commercial_pricing_research is 'Pricing framework; no price is live until separately reviewed and approved.';
