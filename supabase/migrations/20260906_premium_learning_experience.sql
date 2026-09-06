-- P31: premium learning architecture and private family ownership.
-- Billing/entitlements remain server-managed by the P22 commercial tables.

create table if not exists public.premium_family_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused','closed')),
  max_learners integer not null default 4 check (max_learners between 2 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.premium_family_accounts(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'learner' check (role in ('owner','learner')),
  status text not null default 'pending' check (status in ('pending','active','removed')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (family_id, learner_id)
);

insert into public.commercial_plan_entitlements (plan, feature_key, enabled)
values ('premium', 'family_account', true)
on conflict (plan, feature_key) do update set enabled = true, updated_at = now();

alter table public.premium_family_accounts enable row level security;
alter table public.premium_family_members enable row level security;

drop policy if exists "family owners read own account" on public.premium_family_accounts;
create policy "family owners read own account" on public.premium_family_accounts for select to authenticated using (owner_id = auth.uid());
drop policy if exists "family owners create own account" on public.premium_family_accounts;
create policy "family owners create own account" on public.premium_family_accounts for insert to authenticated with check (owner_id = auth.uid() and public.commercial_has_entitlement('family_account'));
drop policy if exists "family owners update own account" on public.premium_family_accounts;
create policy "family owners update own account" on public.premium_family_accounts for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "family participants read membership" on public.premium_family_members;
create policy "family participants read membership" on public.premium_family_members for select to authenticated using (learner_id = auth.uid() or exists (select 1 from public.premium_family_accounts family where family.id = family_id and family.owner_id = auth.uid()));
drop policy if exists "family owners manage membership" on public.premium_family_members;
create policy "family owners manage membership" on public.premium_family_members for all to authenticated using (exists (select 1 from public.premium_family_accounts family where family.id = family_id and family.owner_id = auth.uid() and public.commercial_has_entitlement('family_account'))) with check (exists (select 1 from public.premium_family_accounts family where family.id = family_id and family.owner_id = auth.uid() and public.commercial_has_entitlement('family_account')));

create index if not exists premium_family_members_learner_idx on public.premium_family_members(learner_id, status);

comment on table public.premium_family_accounts is 'P31 family account foundation; invitations and billing are server-managed and never fabricated in the browser.';
comment on table public.premium_family_members is 'P31 learner membership with owner/member RLS; no password, token or private progress is shared by default.';
