-- P77: Premium & Monetization Platform.
-- Additive migration: never deletes or rewrites learning progress, SRS, mastery,
-- adaptive state, achievements, CloudSync payloads, auth credentials or content ownership.

alter table public.commercial_subscriptions drop constraint if exists commercial_subscriptions_tier_check;
alter table public.commercial_subscriptions drop constraint if exists commercial_subscriptions_status_check;
alter table public.commercial_subscriptions drop constraint if exists commercial_subscriptions_payment_provider_check;
alter table public.commercial_plan_entitlements drop constraint if exists commercial_plan_entitlements_plan_check;

alter table public.commercial_subscriptions
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists auto_renew boolean not null default false,
  add constraint commercial_subscriptions_id_key unique (id),
  add constraint commercial_subscriptions_tier_check check (tier in ('free','premium','pro','teacher_pro')),
  add constraint commercial_subscriptions_status_check check (status in ('trial','active','expired','cancelled','pending')),
  add constraint commercial_subscriptions_payment_provider_check check (
    payment_provider is null or payment_provider in ('mock','stripe','google_play','apple_store','local_payment','vietnam_gateway','admin_grant')
  );

alter table public.commercial_plan_entitlements
  add constraint commercial_plan_entitlements_plan_check check (plan in ('free','premium','pro','teacher_pro'));

-- Every existing account receives an explicit FREE record without changing auth or learning data.
insert into public.commercial_subscriptions
  (user_id, tier, status, start_date, end_date, payment_provider, auto_renew, status_reason)
select id, 'free', 'active', created_at, null, null, false, 'p77_existing_user_default'
from auth.users
on conflict (user_id) do nothing;

insert into public.commercial_plan_entitlements (plan, feature_key, enabled, limits) values
  ('free','beginner_foundation',true,'{}'),
  ('free','topik_1_basic',true,'{}'),
  ('free','basic_srs',true,'{}'),
  ('free','learning_journey',true,'{}'),
  ('free','basic_report',true,'{}'),
  ('premium','beginner_foundation',true,'{}'),
  ('premium','topik_1_basic',true,'{}'),
  ('premium','basic_srs',true,'{}'),
  ('premium','learning_journey',true,'{}'),
  ('premium','basic_report',true,'{}'),
  ('premium','advanced_topik',true,'{}'),
  ('premium','advanced_ai_speaking',true,'{}'),
  ('premium','advanced_learning_report',true,'{}'),
  ('premium','extended_offline_pack',true,'{}'),
  ('premium','career_korean',true,'{}'),
  ('premium','premium_courses',true,'{}'),
  ('teacher_pro','beginner_foundation',true,'{}'),
  ('teacher_pro','topik_1_basic',true,'{}'),
  ('teacher_pro','basic_srs',true,'{}'),
  ('teacher_pro','learning_journey',true,'{}'),
  ('teacher_pro','basic_report',true,'{}'),
  ('teacher_pro','advanced_creator_studio',true,'{}'),
  ('teacher_pro','classroom',true,'{}'),
  ('teacher_pro','student_analytics',true,'{}'),
  ('teacher_pro','course_management',true,'{}')
on conflict (plan, feature_key) do update
set enabled = excluded.enabled, limits = excluded.limits, updated_at = now();

create table if not exists public.commercial_resource_entitlements (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('lesson','course','dashboard','feature','offline_pack')),
  resource_key text not null,
  resource_id uuid,
  access_level text not null default 'free' check (access_level in ('free','premium','teacher_pro')),
  subscription_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_type, resource_key)
);

insert into public.commercial_resource_entitlements
  (resource_type, resource_key, access_level, subscription_eligible) values
  ('lesson','beginner_lesson','free',true),
  ('course','topik_5_course','premium',true),
  ('dashboard','teacher_analytics','teacher_pro',true)
on conflict (resource_type, resource_key) do update
set access_level = excluded.access_level, subscription_eligible = excluded.subscription_eligible, updated_at = now();

alter table public.education_creator_courses
  add column if not exists access_level text not null default 'free' check (access_level in ('free','premium')),
  add column if not exists price numeric(12,2) not null default 0 check (price >= 0),
  add column if not exists currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists revenue_share numeric(5,2) not null default 70 check (revenue_share between 0 and 100),
  add column if not exists subscription_eligible boolean not null default false,
  add column if not exists landing_slug text,
  add column if not exists preview_lesson_id uuid references public.education_creator_course_nodes(id) on delete set null,
  add column if not exists sales_count bigint not null default 0 check (sales_count >= 0),
  add column if not exists gross_revenue numeric(16,2) not null default 0 check (gross_revenue >= 0),
  add constraint education_creator_courses_landing_slug_key unique (landing_slug),
  add constraint education_creator_courses_free_price_check check (access_level <> 'free' or price = 0);

create table if not exists public.commercial_creator_balances (
  creator_id uuid primary key references auth.users(id) on delete restrict,
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  gross_revenue numeric(16,2) not null default 0 check (gross_revenue >= 0),
  creator_balance numeric(16,2) not null default 0 check (creator_balance >= 0),
  platform_revenue numeric(16,2) not null default 0 check (platform_revenue >= 0),
  sales_count bigint not null default 0 check (sales_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  course_id uuid not null references public.education_creator_courses(id) on delete restrict,
  creator_id uuid not null references auth.users(id) on delete restrict,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  revenue_share numeric(5,2) not null check (revenue_share between 0 and 100),
  creator_amount numeric(16,2) not null check (creator_amount >= 0),
  platform_amount numeric(16,2) not null check (platform_amount >= 0),
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded','cancelled')),
  provider text not null check (provider in ('mock','stripe','google_play','apple_store','vietnam_gateway')),
  payment_id text not null unique check (char_length(payment_id) between 8 and 200),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id),
  unique (user_id, idempotency_key)
);

create table if not exists public.commercial_course_learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.education_creator_courses(id) on delete cascade,
  progress smallint not null default 0 check (progress between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id),
  check ((progress = 100 and completed_at is not null) or progress < 100)
);

create table if not exists public.commercial_mock_payment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  purpose text not null check (purpose in ('course_purchase','subscription')),
  target_id uuid,
  plan text check (plan is null or plan in ('premium','teacher_pro')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  provider_transaction_id text not null unique,
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.commercial_trial_integrity (
  integrity_hash text primary key check (char_length(integrity_hash) between 32 and 128),
  first_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_trial_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('trial_started','trial_completed','trial_expired','converted')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, event_type)
);

create table if not exists public.commercial_conversion_daily (
  metric_date date primary key,
  free_to_trial integer not null default 0 check (free_to_trial >= 0),
  trial_to_premium integer not null default 0 check (trial_to_premium >= 0),
  premium_retained integer not null default 0 check (premium_retained >= 0),
  premium_churned integer not null default 0 check (premium_churned >= 0),
  generated_at timestamptz not null default now(),
  source text not null default 'server-aggregate'
);

alter table public.commercial_resource_entitlements enable row level security;
alter table public.commercial_creator_balances enable row level security;
alter table public.commercial_course_purchases enable row level security;
alter table public.commercial_course_learning_progress enable row level security;
alter table public.commercial_mock_payment_sessions enable row level security;
alter table public.commercial_trial_integrity enable row level security;
alter table public.commercial_trial_events enable row level security;
alter table public.commercial_conversion_daily enable row level security;

drop policy if exists "published resource access metadata is readable" on public.commercial_resource_entitlements;
create policy "published resource access metadata is readable" on public.commercial_resource_entitlements
  for select to authenticated using (true);
drop policy if exists "admins manage resource access metadata" on public.commercial_resource_entitlements;
create policy "admins manage resource access metadata" on public.commercial_resource_entitlements
  for all to authenticated using (public.has_any_role(array['admin','super_admin']))
  with check (public.has_any_role(array['admin','super_admin']));
drop policy if exists "creators read own balance" on public.commercial_creator_balances;
create policy "creators read own balance" on public.commercial_creator_balances
  for select to authenticated using (creator_id = auth.uid() or public.has_any_role(array['admin','super_admin']));
drop policy if exists "users read own purchases" on public.commercial_course_purchases;
create policy "users read own purchases" on public.commercial_course_purchases
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "learners manage own course progress" on public.commercial_course_learning_progress;
create policy "learners manage own course progress" on public.commercial_course_learning_progress
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.education_creator_courses course
    where course.id = course_id and (
      course.access_level = 'free'
      or course.subscription_eligible and public.commercial_current_tier() in ('premium','pro')
      or exists (select 1 from public.commercial_course_purchases purchase where purchase.user_id = auth.uid() and purchase.course_id = course_id and purchase.status = 'completed')
    )
  ));
drop policy if exists "users read own mock sessions" on public.commercial_mock_payment_sessions;
create policy "users read own mock sessions" on public.commercial_mock_payment_sessions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users read own trial events" on public.commercial_trial_events;
create policy "users read own trial events" on public.commercial_trial_events
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins read conversion aggregates" on public.commercial_conversion_daily;
create policy "admins read conversion aggregates" on public.commercial_conversion_daily
  for select to authenticated using (public.has_any_role(array['admin','super_admin']));

-- Learners may discover only published courses; ownership and reviewer policies remain in force.
drop policy if exists "learners read published creator courses" on public.education_creator_courses;
create policy "learners read published creator courses" on public.education_creator_courses
  for select to authenticated using (status = 'published');

create or replace function public.commercial_current_tier()
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select subscription.tier
    from public.commercial_subscriptions subscription
    where subscription.user_id = auth.uid()
      and subscription.tier in ('premium','pro','teacher_pro')
      and (subscription.status in ('active','trial') or (subscription.status = 'cancelled' and subscription.end_date > now()))
      and (subscription.end_date is null or subscription.end_date > now())
    limit 1
  ), 'free');
$$;

create or replace function public.p77_check_resource_access(
  target_resource_type text,
  target_resource_id uuid,
  target_access_level text
)
returns table (allowed boolean, reason text, effective_plan text, server_verified boolean)
language plpgsql stable security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid(); active_plan text := public.commercial_current_tier(); purchased boolean := false;
begin
  if actor is null then return query select false, 'authentication_required'::text, 'free'::text, true; return; end if;
  if target_access_level = 'free' then return query select true, 'free_resource'::text, active_plan, true; return; end if;
  if target_resource_type = 'course' and target_resource_id is not null then
    select exists (
      select 1 from public.commercial_course_purchases purchase
      where purchase.user_id = actor and purchase.course_id = target_resource_id and purchase.status = 'completed'
    ) into purchased;
    if purchased then return query select true, 'course_purchase'::text, active_plan, true; return; end if;
  end if;
  if target_access_level = 'premium' and active_plan in ('premium','pro') then
    return query select true, 'active_subscription'::text, active_plan, true; return;
  end if;
  if target_access_level = 'teacher_pro' and active_plan = 'teacher_pro' then
    return query select true, 'active_subscription'::text, active_plan, true; return;
  end if;
  return query select false, 'entitlement_required'::text, active_plan, true;
end;
$$;

create or replace function public.p77_create_mock_course_purchase(target_course_id uuid, request_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  actor uuid := auth.uid(); course public.education_creator_courses%rowtype;
  purchase public.commercial_course_purchases%rowtype; transaction_id text;
  creator_cut numeric(16,2); platform_cut numeric(16,2);
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if request_idempotency_key !~ '^purchase-[A-Za-z0-9-]{4,80}$' then raise exception 'Invalid idempotency key'; end if;
  select * into course from public.education_creator_courses where id = target_course_id and status = 'published' for update;
  if course.id is null or course.access_level <> 'premium' or course.price <= 0 then raise exception 'Purchasable premium course not found'; end if;
  if course.owner_id = actor then raise exception 'Creator cannot purchase own course'; end if;
  select * into purchase from public.commercial_course_purchases
    where user_id = actor and (course_id = target_course_id or idempotency_key = request_idempotency_key) limit 1;
  if purchase.id is not null then
    return jsonb_build_object('id',purchase.id,'course_id',purchase.course_id,'status',purchase.status,'payment_id',purchase.payment_id,'idempotent',true);
  end if;
  transaction_id := 'mock_' || replace(gen_random_uuid()::text,'-','');
  creator_cut := round(course.price * course.revenue_share / 100, 2);
  platform_cut := course.price - creator_cut;
  insert into public.commercial_mock_payment_sessions
    (user_id, purpose, target_id, amount, currency, provider_transaction_id, status, completed_at)
    values (actor, 'course_purchase', course.id, course.price, course.currency, transaction_id, 'completed', now());
  insert into public.commercial_course_purchases
    (user_id, course_id, creator_id, price, currency, revenue_share, creator_amount, platform_amount, status, provider, payment_id, idempotency_key)
    values (actor, course.id, course.owner_id, course.price, course.currency, course.revenue_share, creator_cut, platform_cut, 'completed', 'mock', transaction_id, request_idempotency_key)
    returning * into purchase;
  update public.education_creator_courses set sales_count = sales_count + 1, gross_revenue = gross_revenue + course.price, updated_at = now() where id = course.id;
  insert into public.commercial_creator_balances
    (creator_id, currency, gross_revenue, creator_balance, platform_revenue, sales_count)
    values (course.owner_id, course.currency, course.price, creator_cut, platform_cut, 1)
  on conflict (creator_id) do update set
    gross_revenue = commercial_creator_balances.gross_revenue + excluded.gross_revenue,
    creator_balance = commercial_creator_balances.creator_balance + excluded.creator_balance,
    platform_revenue = commercial_creator_balances.platform_revenue + excluded.platform_revenue,
    sales_count = commercial_creator_balances.sales_count + 1, updated_at = now();
  return jsonb_build_object('id',purchase.id,'course_id',purchase.course_id,'price',purchase.price,'currency',purchase.currency,'status',purchase.status,'provider','mock','payment_id',purchase.payment_id,'unlocked',true,'idempotent',false);
end;
$$;

create or replace function public.p77_start_trial(accepted_no_auto_charge boolean, integrity_key_hash text)
returns table (plan text, status text, start_date timestamptz, end_date timestamptz, auto_renew boolean)
language plpgsql security definer set search_path = public, auth as $$
declare actor uuid := auth.uid(); trial_end timestamptz := now() + interval '7 days'; joined_at timestamptz;
begin
  if actor is null or accepted_no_auto_charge is not true then raise exception 'Explicit no-auto-charge confirmation required'; end if;
  if char_length(coalesce(integrity_key_hash,'')) < 32 then raise exception 'Trial integrity proof required'; end if;
  select created_at into joined_at from auth.users where id = actor;
  if joined_at < now() - interval '30 days' then raise exception 'Trial is available to new accounts only'; end if;
  if exists (select 1 from public.commercial_subscription_trials where user_id = actor) then raise exception 'Trial already used'; end if;
  if exists (select 1 from public.commercial_trial_integrity where integrity_hash = integrity_key_hash and first_user_id <> actor) then raise exception 'Trial already used on this installation'; end if;
  if public.commercial_current_tier() <> 'free' then raise exception 'Paid entitlement already active'; end if;
  insert into public.commercial_trial_integrity (integrity_hash, first_user_id) values (integrity_key_hash, actor) on conflict do nothing;
  insert into public.commercial_subscription_trials (user_id, plan, ends_at) values (actor, 'premium', trial_end);
  insert into public.commercial_subscriptions (user_id, tier, status, start_date, end_date, payment_provider, current_period_end, auto_renew, status_reason)
    values (actor, 'premium', 'trial', now(), trial_end, null, trial_end, false, 'p77_seven_day_trial')
  on conflict (user_id) do update set tier='premium', status='trial', start_date=now(), end_date=trial_end,
    current_period_end=trial_end, payment_provider=null, auto_renew=false, status_reason='p77_seven_day_trial', updated_at=now();
  insert into public.commercial_trial_events (user_id, event_type) values (actor, 'trial_started') on conflict do nothing;
  insert into public.commercial_subscription_audit (user_id, actor_id, action, from_plan, to_plan, to_status, reason, source)
    values (actor, actor, 'trial_started', 'free', 'premium', 'trial', 'P77 no payment method and no auto renew', 'server_rpc');
  return query select 'premium'::text, 'trial'::text, now(), trial_end, false;
end;
$$;

create or replace function public.p77_track_trial_lifecycle()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if old.status = 'trial' and new.status is distinct from old.status then
    insert into public.commercial_trial_events (user_id, event_type, metadata)
      values (new.user_id, 'trial_completed', jsonb_build_object('result',new.status)) on conflict do nothing;
    if new.status = 'active' and new.tier in ('premium','pro') then
      insert into public.commercial_trial_events (user_id, event_type, metadata)
        values (new.user_id, 'converted', jsonb_build_object('plan',new.tier)) on conflict do nothing;
    elsif new.status in ('expired','cancelled') then
      insert into public.commercial_trial_events (user_id, event_type, metadata)
        values (new.user_id, 'trial_expired', jsonb_build_object('status',new.status)) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists p77_trial_lifecycle on public.commercial_subscriptions;
create trigger p77_trial_lifecycle after update on public.commercial_subscriptions
  for each row execute function public.p77_track_trial_lifecycle();

create or replace function public.p77_admin_business_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare result jsonb;
begin
  if not public.has_any_role(array['admin','super_admin']) then raise exception 'Admin role required'; end if;
  select jsonb_build_object(
    'totalUsers',(select count(*) from auth.users),
    'premiumUsers',(select count(*) from public.commercial_subscriptions where tier in ('premium','pro','teacher_pro') and status in ('trial','active') and (end_date is null or end_date > now())),
    'revenue',(select coalesce(sum(price),0) from public.commercial_course_purchases where status='completed'),
    'subscriptions',(select coalesce(jsonb_object_agg(status,total),'{}'::jsonb) from (select status,count(*) total from public.commercial_subscriptions group by status) grouped),
    'popularCourses',(select coalesce(jsonb_agg(row_to_json(popular)),'[]'::jsonb) from (select id,title,sales_count,gross_revenue from public.education_creator_courses where status='published' order by sales_count desc limit 10) popular),
    'creatorPerformance',(select coalesce(jsonb_agg(row_to_json(performance)),'[]'::jsonb) from (select creator_id,sales_count,gross_revenue,creator_balance from public.commercial_creator_balances order by gross_revenue desc limit 10) performance)
  ) into result;
  return result;
end;
$$;

create or replace function public.p77_teacher_business_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare actor uuid := auth.uid(); result jsonb; student_total bigint; progress_starts bigint; progress_completions bigint;
begin
  if actor is null or not public.has_any_role(array['teacher','content_creator','admin','super_admin']) then raise exception 'Teacher or creator role required'; end if;
  select count(distinct enrollment.student_id) into student_total
    from public.education_classes classroom join public.education_class_students enrollment on enrollment.class_id = classroom.id
    where classroom.teacher_id = actor and enrollment.status = 'active';
  select count(*), count(*) filter (where progress.progress = 100) into progress_starts, progress_completions
    from public.commercial_course_learning_progress progress
    join public.education_creator_courses course on course.id = progress.course_id
    where course.owner_id = actor;
  select jsonb_build_object(
    'students',coalesce(student_total,0),
    'courseCount',count(*),
    'salesCount',coalesce(sum(sales_count),0),
    'starts',coalesce(progress_starts,0),
    'completions',coalesce(progress_completions,0),
    'completionRate',case when coalesce(progress_starts,0) = 0 then null else round(progress_completions::numeric * 100 / progress_starts, 1) end,
    'revenueEstimate',coalesce(sum(gross_revenue * revenue_share / 100),0),
    'courses',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'salesCount',sales_count,'grossRevenue',gross_revenue,'revenueShare',revenue_share)),'[]'::jsonb)
  ) into result from public.education_creator_courses where owner_id = actor;
  return result || jsonb_build_object('privacy','aggregate_only_no_learner_identity');
end;
$$;

revoke all on function public.p77_check_resource_access(text,uuid,text) from public;
revoke all on function public.p77_create_mock_course_purchase(uuid,text) from public;
revoke all on function public.p77_start_trial(boolean,text) from public;
revoke all on function public.p77_admin_business_dashboard() from public;
revoke all on function public.p77_teacher_business_dashboard() from public;
grant execute on function public.p77_check_resource_access(text,uuid,text) to authenticated;
grant execute on function public.p77_create_mock_course_purchase(uuid,text) to authenticated;
grant execute on function public.p77_start_trial(boolean,text) to authenticated;
grant execute on function public.p77_admin_business_dashboard() to authenticated;
grant execute on function public.p77_teacher_business_dashboard() to authenticated;

create index if not exists p77_subscription_plan_status_idx on public.commercial_subscriptions(tier,status,end_date);
create index if not exists p77_course_marketplace_idx on public.education_creator_courses(status,access_level,sales_count desc);
create index if not exists p77_purchase_user_idx on public.commercial_course_purchases(user_id,purchased_at desc);
create index if not exists p77_purchase_creator_idx on public.commercial_course_purchases(creator_id,purchased_at desc);
create index if not exists p77_course_progress_course_idx on public.commercial_course_learning_progress(course_id,progress,updated_at desc);
create index if not exists p77_trial_event_date_idx on public.commercial_trial_events(event_type,occurred_at desc);

comment on table public.commercial_course_purchases is 'Purchase history stores provider transaction IDs only; never card numbers, CVCs or payment secrets.';
comment on table public.commercial_creator_balances is 'Estimated creator revenue ledger. P77 does not execute real payouts.';
comment on table public.commercial_conversion_daily is 'Anonymous aggregate conversion/retention metrics; no sensitive personal data.';
