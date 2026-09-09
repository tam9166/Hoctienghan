-- P56: mobile installation and notification preferences. Learning data remains in learning_sync.
create table if not exists public.mobile_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null check (char_length(installation_id) between 8 and 120),
  platform text not null check (platform in ('android', 'ios')),
  push_token text not null check (char_length(push_token) between 8 and 4096),
  locale text not null default 'vi' check (char_length(locale) <= 16),
  timezone text not null default 'UTC' check (char_length(timezone) <= 80),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

create index if not exists mobile_push_devices_active_idx
  on public.mobile_push_devices (user_id, last_seen_at desc)
  where revoked_at is null;

alter table public.mobile_push_devices enable row level security;
drop policy if exists mobile_push_devices_owner_select on public.mobile_push_devices;
create policy mobile_push_devices_owner_select on public.mobile_push_devices for select to authenticated using (auth.uid() = user_id);
drop policy if exists mobile_push_devices_owner_insert on public.mobile_push_devices;
create policy mobile_push_devices_owner_insert on public.mobile_push_devices for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists mobile_push_devices_owner_update on public.mobile_push_devices;
create policy mobile_push_devices_owner_update on public.mobile_push_devices for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists mobile_push_devices_owner_delete on public.mobile_push_devices;
create policy mobile_push_devices_owner_delete on public.mobile_push_devices for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.mobile_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  review_due boolean not null default true,
  daily_mission boolean not null default true,
  goal_reminder boolean not null default true,
  quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
  quiet_end smallint not null default 7 check (quiet_end between 0 and 23),
  maximum_per_day smallint not null default 2 check (maximum_per_day between 0 and 3),
  updated_at timestamptz not null default now()
);

alter table public.mobile_notification_preferences enable row level security;
drop policy if exists mobile_notification_preferences_owner_all on public.mobile_notification_preferences;
create policy mobile_notification_preferences_owner_all on public.mobile_notification_preferences
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Server/Edge Functions may write delivery metadata with a service role. Browser clients receive no policy.
create table if not exists public.mobile_notification_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text not null,
  notification_type text not null check (notification_type in ('review-due', 'daily-mission', 'goal-reminder')),
  status text not null check (status in ('queued', 'sent', 'failed', 'opened', 'expired')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_notification_deliveries_user_created_idx
  on public.mobile_notification_deliveries (user_id, created_at desc);
alter table public.mobile_notification_deliveries enable row level security;
revoke all on public.mobile_notification_deliveries from anon, authenticated;

comment on table public.mobile_push_devices is 'Native push registration only; never part of learning_sync or client analytics.';
comment on table public.mobile_notification_deliveries is 'Server-only metadata. Notification bodies and private learning content are not stored.';
