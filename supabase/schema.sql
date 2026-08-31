-- Authenticated, local-first cloud sync schema for Tiếng Hàn - TamHoanq.
create table if not exists public.learning_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.learning_sync enable row level security;
drop policy if exists "users read own learning sync" on public.learning_sync;
create policy "users read own learning sync" on public.learning_sync for select using (auth.uid() = user_id);
drop policy if exists "users insert own learning sync" on public.learning_sync;
create policy "users insert own learning sync" on public.learning_sync for insert with check (auth.uid() = user_id);
drop policy if exists "users update own learning sync" on public.learning_sync;
create policy "users update own learning sync" on public.learning_sync for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Normalized tables can be introduced incrementally when Supabase Auth is enabled.
-- Keep every user-owned table behind auth.uid() = user_id and never expose a service role key.
