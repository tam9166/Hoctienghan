-- Authenticated, local-first cloud sync schema for Tiếng Hàn - TamHoanq.
create table if not exists public.learning_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.learning_sync enable row level security;
drop policy if exists "users read own learning sync" on public.learning_sync;
create policy "users read own learning sync" on public.learning_sync for select using (auth.uid() = user_id);
drop policy if exists "users insert own learning sync" on public.learning_sync;
drop policy if exists "users update own learning sync" on public.learning_sync;
revoke insert, update, delete on public.learning_sync from anon, authenticated;

-- Normalized tables can be introduced incrementally when Supabase Auth is enabled.
-- Keep every user-owned table behind auth.uid() = user_id and never expose a service role key.
create table if not exists public.user_learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  device_id text not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  primary key (user_id, domain, record_id),
  constraint user_learning_records_domain_length check (char_length(domain) between 1 and 120),
  constraint user_learning_records_record_id_length check (char_length(record_id) between 1 and 180),
  constraint user_learning_records_device_id_length check (char_length(device_id) between 8 and 120),
  constraint user_learning_records_version_positive check (version >= 1),
  constraint user_learning_records_payload_object check (jsonb_typeof(payload) = 'object')
);
alter table public.user_learning_records enable row level security;
drop policy if exists "users read own learning records" on public.user_learning_records;
create policy "users read own learning records" on public.user_learning_records for select using (auth.uid() = user_id);
revoke all on public.user_learning_records from anon;
revoke insert, update, delete on public.user_learning_records from anon, authenticated;
grant select on public.user_learning_records to authenticated;

-- Conflict-safe writes and idempotency are installed by
-- migrations/20260922_learning_record_sync.sql through apply_learning_record_batch().
