-- P22 Enterprise Education Platform foundation.
-- Apply after education_platform_foundation.sql. Payment processing and public partner API are intentionally not enabled.

create table if not exists public.commercial_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','premium')),
  status text not null default 'inactive' check (status in ('active','trialing','past_due','canceled','inactive')),
  provider text,
  provider_customer_ref text,
  provider_subscription_ref text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_plan_entitlements (
  plan text not null check (plan in ('free','premium')),
  feature_key text not null,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (plan, feature_key)
);

create table if not exists public.education_organization_subscriptions (
  organization_id uuid primary key references public.education_organizations(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  status text not null default 'inactive' check (status in ('active','trialing','past_due','canceled','inactive')),
  seat_limit integer not null default 30 check (seat_limit > 0),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_marketplace_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  provider_organization_id uuid references public.education_organizations(id) on delete set null,
  creator_id uuid not null references auth.users(id) on delete restrict,
  language_code text not null default 'ko',
  title text not null,
  description text not null default '',
  difficulty text not null,
  access_tier text not null default 'free' check (access_tier in ('free','premium')),
  status text not null default 'draft' check (status in ('draft','in_review','approved','deprecated')),
  verified boolean not null default false,
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or verified)
);

create table if not exists public.commercial_marketplace_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.commercial_marketplace_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','canceled')),
  progress integer not null default 0 check (progress between 0 and 100),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create table if not exists public.commercial_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.commercial_marketplace_courses(id) on delete restrict,
  enrollment_id uuid not null references public.commercial_marketplace_enrollments(id) on delete restrict,
  title text not null,
  status text not null default 'valid' check (status in ('valid','revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, course_id)
);

create table if not exists public.partner_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.education_organizations(id) on delete cascade,
  name text not null,
  client_public_id text not null unique,
  scopes text[] not null default '{}',
  status text not null default 'disabled' check (status in ('disabled','active','revoked')),
  created_by uuid not null references auth.users(id) on delete restrict,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Credential material is server-only. Never select or write this table from the browser.
create table if not exists public.partner_credentials (
  client_id uuid primary key references public.partner_clients(id) on delete cascade,
  secret_hash text not null,
  rotated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.partner_api_audit (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.partner_clients(id) on delete cascade,
  organization_id uuid not null references public.education_organizations(id) on delete cascade,
  route_key text not null,
  scope_used text not null,
  response_status integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_admin_daily_metrics (
  metric_date date primary key,
  active_users integer not null default 0 check (active_users >= 0),
  retained_users integer not null default 0 check (retained_users >= 0),
  learning_minutes bigint not null default 0 check (learning_minutes >= 0),
  active_subscriptions integer not null default 0 check (active_subscriptions >= 0),
  active_organizations integer not null default 0 check (active_organizations >= 0),
  generated_at timestamptz not null default now(),
  source text not null default 'server-aggregate'
);

create table if not exists public.product_languages (
  code text primary key,
  name text not null,
  native_name text not null,
  content_status text not null default 'foundation' check (content_status in ('foundation','active','deprecated')),
  interface_status text not null default 'planned' check (interface_status in ('planned','active','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.commercial_plan_entitlements (plan, feature_key) values
  ('free','core_learning'), ('free','standard_practice'), ('free','basic_progress'),
  ('premium','core_learning'), ('premium','standard_practice'), ('premium','basic_progress'),
  ('premium','advanced_analytics'), ('premium','premium_courses'), ('premium','extended_practice')
on conflict (plan, feature_key) do update set enabled = true, updated_at = now();

insert into public.product_languages (code, name, native_name, content_status, interface_status) values
  ('ko','Korean','한국어','active','active'),
  ('ja','Japanese','日本語','foundation','planned'),
  ('zh','Chinese','中文','foundation','planned')
on conflict (code) do update set name = excluded.name, native_name = excluded.native_name, content_status = excluded.content_status, interface_status = excluded.interface_status, updated_at = now();

create or replace function public.commercial_current_tier()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when exists (
      select 1 from public.commercial_subscriptions subscription
      where subscription.user_id = auth.uid()
        and subscription.tier = 'premium'
        and subscription.status in ('active','trialing')
        and (subscription.current_period_end is null or subscription.current_period_end > now())
    ) then 'premium'
    else 'free'
  end;
$$;

create or replace function public.commercial_has_entitlement(target_feature text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null and exists (
    select 1 from public.commercial_plan_entitlements entitlement
    where entitlement.plan = public.commercial_current_tier()
      and entitlement.feature_key = target_feature
      and entitlement.enabled
  );
$$;

revoke all on function public.commercial_current_tier() from public;
revoke all on function public.commercial_has_entitlement(text) from public;
grant execute on function public.commercial_current_tier() to authenticated;
grant execute on function public.commercial_has_entitlement(text) to authenticated;

alter table public.commercial_subscriptions enable row level security;
alter table public.commercial_plan_entitlements enable row level security;
alter table public.education_organization_subscriptions enable row level security;
alter table public.commercial_marketplace_courses enable row level security;
alter table public.commercial_marketplace_enrollments enable row level security;
alter table public.commercial_certificates enable row level security;
alter table public.partner_clients enable row level security;
alter table public.partner_credentials enable row level security;
alter table public.partner_api_audit enable row level security;
alter table public.commercial_admin_daily_metrics enable row level security;
alter table public.product_languages enable row level security;

drop policy if exists "users read own subscription" on public.commercial_subscriptions;
create policy "users read own subscription" on public.commercial_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins read subscriptions" on public.commercial_subscriptions;
create policy "admins read subscriptions" on public.commercial_subscriptions for select to authenticated using (public.has_any_role(array['admin']));

drop policy if exists "authenticated read plan entitlements" on public.commercial_plan_entitlements;
create policy "authenticated read plan entitlements" on public.commercial_plan_entitlements for select to authenticated using (enabled);

drop policy if exists "organization staff read organization subscription" on public.education_organization_subscriptions;
create policy "organization staff read organization subscription" on public.education_organization_subscriptions for select to authenticated using (public.education_is_org_staff(organization_id));

drop policy if exists "authenticated read approved marketplace courses" on public.commercial_marketplace_courses;
create policy "authenticated read approved marketplace courses" on public.commercial_marketplace_courses for select to authenticated using ((status = 'approved' and verified) or creator_id = auth.uid() or public.has_any_role(array['admin']));
drop policy if exists "authorized staff create marketplace courses" on public.commercial_marketplace_courses;
create policy "authorized staff create marketplace courses" on public.commercial_marketplace_courses for insert to authenticated with check (creator_id = auth.uid() and public.has_any_role(array['teacher','admin']) and (provider_organization_id is null or public.education_is_org_staff(provider_organization_id)) and status <> 'approved' and not verified);
drop policy if exists "authorized staff update marketplace courses" on public.commercial_marketplace_courses;
create policy "authorized staff update marketplace courses" on public.commercial_marketplace_courses for update to authenticated using (creator_id = auth.uid() or public.has_any_role(array['admin'])) with check ((creator_id = auth.uid() and status <> 'approved' and not verified) or public.has_any_role(array['admin']));

drop policy if exists "users read own marketplace enrollments" on public.commercial_marketplace_enrollments;
create policy "users read own marketplace enrollments" on public.commercial_marketplace_enrollments for select to authenticated using (user_id = auth.uid());
drop policy if exists "users enroll accessible marketplace courses" on public.commercial_marketplace_enrollments;
create policy "users enroll accessible marketplace courses" on public.commercial_marketplace_enrollments for insert to authenticated with check (
  user_id = auth.uid() and exists (
    select 1 from public.commercial_marketplace_courses course
    where course.id = course_id and course.status = 'approved' and course.verified
      and (course.access_tier = 'free' or public.commercial_has_entitlement('premium_courses'))
  )
);
drop policy if exists "users update own marketplace progress" on public.commercial_marketplace_enrollments;
create policy "users update own marketplace progress" on public.commercial_marketplace_enrollments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users read own certificates" on public.commercial_certificates;
create policy "users read own certificates" on public.commercial_certificates for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins manage certificates" on public.commercial_certificates;
create policy "admins manage certificates" on public.commercial_certificates for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

drop policy if exists "organization staff read partner clients" on public.partner_clients;
create policy "organization staff read partner clients" on public.partner_clients for select to authenticated using (public.education_is_org_staff(organization_id));
drop policy if exists "admins manage partner clients" on public.partner_clients;
create policy "admins manage partner clients" on public.partner_clients for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));
-- partner_credentials intentionally has no authenticated policy; only trusted server roles may access credential hashes.

drop policy if exists "organization staff read partner audit" on public.partner_api_audit;
create policy "organization staff read partner audit" on public.partner_api_audit for select to authenticated using (public.education_is_org_staff(organization_id));
drop policy if exists "admins read commercial metrics" on public.commercial_admin_daily_metrics;
create policy "admins read commercial metrics" on public.commercial_admin_daily_metrics for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "authenticated read product languages" on public.product_languages;
create policy "authenticated read product languages" on public.product_languages for select to authenticated using (content_status <> 'deprecated');

create index if not exists commercial_subscriptions_tier_idx on public.commercial_subscriptions(tier, status);
create index if not exists marketplace_courses_status_idx on public.commercial_marketplace_courses(status, verified, access_tier);
create index if not exists marketplace_enrollments_user_idx on public.commercial_marketplace_enrollments(user_id, status);
create index if not exists commercial_certificates_user_idx on public.commercial_certificates(user_id, issued_at desc);
create index if not exists partner_clients_org_idx on public.partner_clients(organization_id, status);
create index if not exists partner_api_audit_org_idx on public.partner_api_audit(organization_id, created_at desc);

comment on table public.commercial_subscriptions is 'Server-managed subscription status. Browser clients have read-only access to their own row.';
comment on table public.partner_credentials is 'Server-only credential hashes; never exposed to browser clients.';
comment on table public.commercial_admin_daily_metrics is 'Aggregate operational metrics without user-level PII.';
