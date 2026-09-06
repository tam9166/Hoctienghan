-- P39 Business Monetization System.
-- Extends P22 commercial_subscriptions and organization subscriptions.
-- Payment credentials, raw provider payloads and card data must remain in the payment provider/server only.

create table if not exists public.commercial_payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  provider_event_ref text not null unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  subscription_user_id uuid references auth.users(id) on delete set null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending','processed','ignored','failed')),
  payload_checksum text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_coupons (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  benefit_type text not null check (benefit_type in ('percentage','fixed_amount','trial_extension')),
  benefit_value numeric(12,2) not null check (benefit_value > 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused','expired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (benefit_type <> 'percentage' or benefit_value <= 100),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table if not exists public.commercial_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.commercial_coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','qualified','applied','reversed','rejected')),
  applied_amount numeric(14,2) not null default 0 check (applied_amount >= 0),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  provider_event_ref text,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, user_id)
);

create table if not exists public.commercial_referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null check (char_length(code_hint) between 2 and 8),
  status text not null default 'active' check (status in ('active','paused','revoked')),
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.commercial_referral_codes(id) on delete restrict,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'attributed' check (status in ('attributed','qualified','rewarded','rejected','reversed')),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_user_id)
);

create table if not exists public.commercial_organization_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  audience text not null check (audience in ('corporate','school')),
  name text not null,
  minimum_seats integer not null check (minimum_seats > 0),
  maximum_seats integer check (maximum_seats is null or maximum_seats >= minimum_seats),
  entitlements jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.education_organization_subscriptions
  add column if not exists package_id uuid references public.commercial_organization_packages(id) on delete set null,
  add column if not exists seats_used integer not null default 0 check (seats_used >= 0),
  add column if not exists license_status text not null default 'inactive' check (license_status in ('inactive','trialing','active','past_due','suspended','canceled'));

create table if not exists public.commercial_quote_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.education_organizations(id) on delete set null,
  package_slug text references public.commercial_organization_packages(slug) on delete set null,
  organization_name text not null check (char_length(organization_name) between 2 and 120),
  requested_seats integer not null check (requested_seats between 1 and 10000),
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'new' check (status in ('new','qualified','proposal','accepted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_revenue_daily (
  metric_date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gross_revenue numeric(16,2) not null default 0 check (gross_revenue >= 0),
  net_revenue numeric(16,2) not null default 0 check (net_revenue >= 0),
  refund_amount numeric(16,2) not null default 0 check (refund_amount >= 0),
  new_subscriptions integer not null default 0 check (new_subscriptions >= 0),
  canceled_subscriptions integer not null default 0 check (canceled_subscriptions >= 0),
  coupon_redemptions integer not null default 0 check (coupon_redemptions >= 0),
  referral_conversions integer not null default 0 check (referral_conversions >= 0),
  active_licenses integer not null default 0 check (active_licenses >= 0),
  generated_at timestamptz not null default now(),
  primary key (metric_date, currency)
);

create table if not exists public.commercial_crm_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.education_organizations(id) on delete set null,
  account_name text not null check (char_length(account_name) between 2 and 160),
  stage text not null default 'new' check (stage in ('new','qualified','proposal','customer','closed')),
  source text not null default 'direct' check (char_length(source) <= 80),
  owner_id uuid references auth.users(id) on delete set null,
  next_action_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the existing support queue for commercial cases instead of creating another inbox.
alter table public.support_requests drop constraint if exists support_requests_type_check;
alter table public.support_requests add constraint support_requests_type_check check (type in ('lesson','question','writing','speaking','grammar','error_notebook','general','subscription','billing','coupon','referral','organization'));

-- The browser can only read its safe subscription projection. It cannot change tier/status.
create or replace function public.commercial_current_subscription()
returns table (tier text, status text, current_period_end timestamptz)
language sql stable security definer set search_path = public, auth
as $$
  select subscription.tier, subscription.status, subscription.current_period_end
  from public.commercial_subscriptions subscription
  where subscription.user_id = auth.uid()
  limit 1;
$$;
revoke all on function public.commercial_current_subscription() from public;
grant execute on function public.commercial_current_subscription() to authenticated;

-- Replace P22's direct row access with the safe projection above so provider references stay private.
drop policy if exists "users read own subscription" on public.commercial_subscriptions;

alter table public.commercial_payment_events enable row level security;
alter table public.commercial_coupons enable row level security;
alter table public.commercial_coupon_redemptions enable row level security;
alter table public.commercial_referral_codes enable row level security;
alter table public.commercial_referrals enable row level security;
alter table public.commercial_organization_packages enable row level security;
alter table public.commercial_quote_requests enable row level security;
alter table public.commercial_revenue_daily enable row level security;
alter table public.commercial_crm_accounts enable row level security;

-- Payment events, coupon definitions, coupon redemptions, referral identities and code hashes intentionally have no browser policy.
-- Checkout, validation, webhook handling and reward grants run in trusted server code only.
drop policy if exists "authenticated read active organization packages" on public.commercial_organization_packages;
create policy "authenticated read active organization packages" on public.commercial_organization_packages for select to authenticated using (status = 'active');
drop policy if exists "users create own commercial quote" on public.commercial_quote_requests;
create policy "users create own commercial quote" on public.commercial_quote_requests for insert to authenticated with check (requester_id = auth.uid() and (organization_id is null or public.education_is_org_member(organization_id)));
drop policy if exists "users read own commercial quotes" on public.commercial_quote_requests;
create policy "users read own commercial quotes" on public.commercial_quote_requests for select to authenticated using (requester_id = auth.uid() or public.has_any_role(array['admin']));
drop policy if exists "admins read revenue aggregates" on public.commercial_revenue_daily;
create policy "admins read revenue aggregates" on public.commercial_revenue_daily for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "admins manage crm accounts" on public.commercial_crm_accounts;
create policy "admins manage crm accounts" on public.commercial_crm_accounts for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

create index if not exists commercial_payment_events_created_idx on public.commercial_payment_events(created_at desc, status);
create index if not exists commercial_coupon_redemptions_user_idx on public.commercial_coupon_redemptions(user_id, redeemed_at desc);
create index if not exists commercial_referrals_referrer_idx on public.commercial_referrals(referrer_id, status);
create index if not exists commercial_quote_requests_requester_idx on public.commercial_quote_requests(requester_id, created_at desc);
create index if not exists commercial_crm_stage_idx on public.commercial_crm_accounts(stage, updated_at desc);

comment on table public.commercial_payment_events is 'Server-only sanitized payment event ledger; raw provider payloads and card data are prohibited.';
comment on table public.commercial_revenue_daily is 'Admin-only aggregate revenue metrics without individual payment records or PII.';
comment on table public.commercial_crm_accounts is 'Minimal B2B lifecycle data. Learning journals, chat, recordings and payment instruments are prohibited.';
