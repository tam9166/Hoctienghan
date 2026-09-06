-- P34: security/privacy foundation. All sensitive actions remain owner-scoped;
-- audit metadata is allowlisted and never contains passwords, tokens or payloads.
create table if not exists public.user_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cloud_sync_enabled boolean not null default true,
  ai_usage_enabled boolean not null default true,
  telemetry_enabled boolean not null default false,
  precise_location_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Browser',
  user_agent_hash text,
  location_hint text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table if not exists public.privacy_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','completed','rejected')),
  processed_at timestamptz,
  processor_note text
);
create table if not exists public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null default 'student',
  event text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_devices_user_seen_idx on public.user_devices(user_id, last_seen_at desc);
create index if not exists privacy_deletion_user_requested_idx on public.privacy_deletion_requests(user_id, requested_at desc);
create index if not exists security_audit_actor_created_idx on public.security_audit_logs(actor_id, created_at desc);
create index if not exists security_audit_event_created_idx on public.security_audit_logs(event, created_at desc);

alter table public.user_privacy_preferences enable row level security;
alter table public.user_devices enable row level security;
alter table public.privacy_deletion_requests enable row level security;
alter table public.security_audit_logs enable row level security;

drop policy if exists "users read own privacy preferences" on public.user_privacy_preferences;
create policy "users read own privacy preferences" on public.user_privacy_preferences for select to authenticated using (user_id = auth.uid());
drop policy if exists "users upsert own privacy preferences" on public.user_privacy_preferences;
create policy "users upsert own privacy preferences" on public.user_privacy_preferences for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update own privacy preferences" on public.user_privacy_preferences;
create policy "users update own privacy preferences" on public.user_privacy_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "users manage own devices" on public.user_devices;
create policy "users manage own devices" on public.user_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users read own deletion requests" on public.privacy_deletion_requests;
create policy "users read own deletion requests" on public.privacy_deletion_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "users request own deletion" on public.privacy_deletion_requests;
create policy "users request own deletion" on public.privacy_deletion_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admins read deletion requests" on public.privacy_deletion_requests;
create policy "admins read deletion requests" on public.privacy_deletion_requests for select to authenticated using (public.has_any_role(array['admin']));

drop policy if exists "admins read security audit logs" on public.security_audit_logs;
create policy "admins read security audit logs" on public.security_audit_logs for select to authenticated using (public.has_any_role(array['admin']));
drop policy if exists "users create own security audit logs" on public.security_audit_logs;
create policy "users create own security audit logs" on public.security_audit_logs for insert to authenticated with check (actor_id = auth.uid());

comment on table public.user_privacy_preferences is 'GDPR/Vietnam privacy controls; precise location is disabled by default.';
comment on table public.user_devices is 'Device sessions with coarse optional location hint; no precise tracking.';
comment on table public.privacy_deletion_requests is 'Account deletion workflow processed by a trusted backend worker.';
comment on table public.security_audit_logs is 'Allowlisted security audit events; no credentials or raw learning content.';
