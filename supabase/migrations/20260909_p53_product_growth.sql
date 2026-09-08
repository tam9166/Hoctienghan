-- P53 Product Growth: privacy-safe referral attribution and aggregate analytics.
-- No recipient contact, private learning content or raw telemetry is stored here.

create table if not exists public.product_growth_referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^TH[A-Z0-9]{8,16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.product_growth_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null references public.product_growth_referral_codes(code),
  status text not null default 'attributed' check (status in ('attributed','qualified','rejected')),
  attributed_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_user_id)
);

create table if not exists public.product_growth_invites (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  invite_type text not null check (invite_type in ('friend','study_partner')),
  channel text not null check (channel in ('copy','web_share')),
  status text not null default 'created' check (status in ('created','shared')),
  created_at timestamptz not null default now()
);

create table if not exists public.product_growth_daily_metrics (
  metric_date date not null,
  source text not null default 'direct',
  visitors integer not null default 0 check (visitors >= 0),
  registrations integer not null default 0 check (registrations >= 0),
  activated_users integer not null default 0 check (activated_users >= 0),
  day_1_retention numeric(5,2),
  day_7_retention numeric(5,2),
  day_30_retention numeric(5,2),
  reengaged_users integer not null default 0 check (reengaged_users >= 0),
  churned_users integer not null default 0 check (churned_users >= 0),
  generated_at timestamptz not null default now(),
  primary key (metric_date, source),
  check (day_1_retention between 0 and 100),
  check (day_7_retention between 0 and 100),
  check (day_30_retention between 0 and 100)
);

create table if not exists public.product_growth_experiment_metrics (
  experiment_id text not null,
  variant text not null,
  metric_date date not null,
  exposures integer not null default 0 check (exposures >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  generated_at timestamptz not null default now(),
  primary key (experiment_id, variant, metric_date)
);

alter table public.product_growth_referral_codes enable row level security;
alter table public.product_growth_referrals enable row level security;
alter table public.product_growth_invites enable row level security;
alter table public.product_growth_daily_metrics enable row level security;
alter table public.product_growth_experiment_metrics enable row level security;

drop policy if exists "users read own growth code" on public.product_growth_referral_codes;
create policy "users read own growth code" on public.product_growth_referral_codes for select to authenticated using (auth.uid() = user_id);

drop policy if exists "participants read own referral" on public.product_growth_referrals;
create policy "participants read own referral" on public.product_growth_referrals for select to authenticated using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

drop policy if exists "users read own growth invites" on public.product_growth_invites;
create policy "users read own growth invites" on public.product_growth_invites for select to authenticated using (auth.uid() = referrer_id);

drop policy if exists "admins read growth metrics" on public.product_growth_daily_metrics;
create policy "admins read growth metrics" on public.product_growth_daily_metrics for select to authenticated using (public.has_any_role(array['admin']));

drop policy if exists "admins read growth experiment metrics" on public.product_growth_experiment_metrics;
create policy "admins read growth experiment metrics" on public.product_growth_experiment_metrics for select to authenticated using (public.has_any_role(array['admin']));

create or replace function public.ensure_growth_referral_code()
returns text language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select code into result from public.product_growth_referral_codes where user_id = current_user_id;
  if result is null then
    result := 'TH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    insert into public.product_growth_referral_codes(user_id, code) values (current_user_id, result)
      on conflict (user_id) do update set user_id = excluded.user_id
      returning code into result;
  end if;
  return result;
end;
$$;

create or replace function public.create_growth_invite(p_invite_type text, p_channel text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result public.product_growth_invites;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if p_invite_type not in ('friend','study_partner') or p_channel not in ('copy','web_share') then raise exception 'invalid invite'; end if;
  perform public.ensure_growth_referral_code();
  insert into public.product_growth_invites(referrer_id, invite_type, channel)
    values (current_user_id, p_invite_type, p_channel) returning * into result;
  return jsonb_build_object('id', result.id, 'status', result.status, 'createdAt', result.created_at);
end;
$$;

create or replace function public.attribute_growth_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owner_id uuid;
  normalized_code text := upper(trim(coalesce(p_code, '')));
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select user_id into owner_id from public.product_growth_referral_codes where code = normalized_code;
  if owner_id is null then return jsonb_build_object('ok', false, 'status', 'invalid-code'); end if;
  if owner_id = current_user_id then return jsonb_build_object('ok', false, 'status', 'self-referral'); end if;
  insert into public.product_growth_referrals(referrer_id, referred_user_id, referral_code)
    values (owner_id, current_user_id, normalized_code)
    on conflict (referred_user_id) do nothing;
  return jsonb_build_object('ok', true, 'status', 'attributed', 'rewardGranted', false);
end;
$$;

revoke all on function public.ensure_growth_referral_code() from public;
revoke all on function public.create_growth_invite(text, text) from public;
revoke all on function public.attribute_growth_referral(text) from public;
grant execute on function public.ensure_growth_referral_code() to authenticated;
grant execute on function public.create_growth_invite(text, text) to authenticated;
grant execute on function public.attribute_growth_referral(text) to authenticated;

create index if not exists product_growth_referrals_referrer_idx on public.product_growth_referrals(referrer_id, status);
create index if not exists product_growth_invites_referrer_idx on public.product_growth_invites(referrer_id, created_at desc);
create index if not exists product_growth_metrics_date_idx on public.product_growth_daily_metrics(metric_date desc);
