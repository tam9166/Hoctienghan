-- P40 Future Global Language Platform.
-- Extends P27 language profiles, P22 marketplace, P32 AI companion and P35 device bridge.

create table if not exists public.language_platform_capabilities (
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  capability_key text not null,
  adapter_key text not null,
  status text not null check (status in ('foundation','device_dependent','ready','disabled')),
  configuration jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  review_status text not null default 'draft' check (review_status in ('draft','review','approved','deprecated')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (language_id, capability_key),
  check (review_status <> 'approved' or verified)
);

create table if not exists public.language_cross_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_language text not null check (source_language in ('vi','ko','ja','zh','en')),
  target_language text not null check (target_language in ('ko','ja','zh','en')),
  mode text not null check (mode in ('compare','transfer','contrast')),
  completed_items integer not null default 0 check (completed_items >= 0),
  correct_items integer not null default 0 check (correct_items between 0 and completed_items),
  raw_content_stored boolean not null default false check (raw_content_stored = false),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (source_language <> target_language)
);

create table if not exists public.language_device_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_type text not null check (integration_type in ('ar','wearable')),
  provider_key text not null,
  external_subject_hash text,
  consent_status text not null default 'pending' check (consent_status in ('pending','granted','revoked')),
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  permissions text[] not null default '{}',
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, integration_type, provider_key),
  check (not (permissions && array['health','location','contacts','microphone','raw-learning-content']))
);

create table if not exists public.language_translation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_language text not null check (source_language in ('vi','ko','ja','zh','en')),
  target_language text not null check (target_language in ('ko','ja','zh','en')),
  mode text not null check (mode in ('text','push_to_talk')),
  turn_count integer not null default 0 check (turn_count >= 0),
  character_count integer not null default 0 check (character_count >= 0),
  raw_audio_stored boolean not null default false check (raw_audio_stored = false),
  transcript_stored boolean not null default false check (transcript_stored = false),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (source_language <> target_language)
);

create table if not exists public.language_ai_operation_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  language_id text not null check (language_id in ('ko','ja','zh','en')),
  intent text not null check (intent in ('study-plan','explain','practice','immerse','translate','marketplace')),
  adapter_key text not null,
  status text not null check (status in ('routed','completed','fallback','blocked','failed')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_stored boolean not null default false check (input_stored = false),
  output_stored boolean not null default false check (output_stored = false),
  created_at timestamptz not null default now()
);

insert into public.language_platform_capabilities (language_id, capability_key, adapter_key, status, verified, review_status) values
  ('ko','universal-engine','LanguagePlatformService','ready',true,'approved'),
  ('ko','cross-language','LanguageComparisonService','ready',true,'approved'),
  ('ko','ai-immersion','AICompanionService','ready',true,'approved'),
  ('ko','realtime-translation','TranslationService','ready',true,'approved'),
  ('ja','universal-engine','LanguagePlatformService','foundation',true,'approved'),
  ('ja','cross-language','LanguageComparisonService','foundation',true,'approved'),
  ('zh','universal-engine','LanguagePlatformService','foundation',true,'approved'),
  ('zh','cross-language','LanguageComparisonService','foundation',true,'approved'),
  ('en','universal-engine','LanguagePlatformService','foundation',true,'approved'),
  ('en','cross-language','LanguageComparisonService','foundation',true,'approved')
on conflict (language_id, capability_key) do update set adapter_key = excluded.adapter_key, status = excluded.status, verified = excluded.verified, review_status = excluded.review_status, version = greatest(public.language_platform_capabilities.version, excluded.version), updated_at = now();

alter table public.language_platform_capabilities enable row level security;
alter table public.language_cross_learning_sessions enable row level security;
alter table public.language_device_connections enable row level security;
alter table public.language_translation_sessions enable row level security;
alter table public.language_ai_operation_logs enable row level security;

drop policy if exists "authenticated read approved language capabilities" on public.language_platform_capabilities;
create policy "authenticated read approved language capabilities" on public.language_platform_capabilities for select to authenticated using (verified and review_status = 'approved');
drop policy if exists "admins manage language capabilities" on public.language_platform_capabilities;
create policy "admins manage language capabilities" on public.language_platform_capabilities for all to authenticated using (public.has_any_role(array['admin'])) with check (public.has_any_role(array['admin']));

drop policy if exists "users manage own cross language sessions" on public.language_cross_learning_sessions;
create policy "users manage own cross language sessions" on public.language_cross_learning_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and raw_content_stored = false);
drop policy if exists "users manage own device connections" on public.language_device_connections;
create policy "users manage own device connections" on public.language_device_connections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage own translation session metadata" on public.language_translation_sessions;
create policy "users manage own translation session metadata" on public.language_translation_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and raw_audio_stored = false and transcript_stored = false);
drop policy if exists "users read own language ai operation logs" on public.language_ai_operation_logs;
create policy "users read own language ai operation logs" on public.language_ai_operation_logs for select to authenticated using (user_id = auth.uid());
-- AI operation logs are inserted by trusted server code after routing; browser clients cannot forge quality or usage records.

create index if not exists language_cross_sessions_user_idx on public.language_cross_learning_sessions(user_id, started_at desc);
create index if not exists language_device_connections_user_idx on public.language_device_connections(user_id, integration_type, status);
create index if not exists language_translation_sessions_user_idx on public.language_translation_sessions(user_id, created_at desc);
create index if not exists language_ai_operation_logs_user_idx on public.language_ai_operation_logs(user_id, created_at desc);

comment on table public.language_platform_capabilities is 'Versioned adapter registry. A language is not considered launched until its content pack is approved separately.';
comment on table public.language_device_connections is 'Consent and connection metadata only; tokens, health, location, contacts, microphone and raw learning content are prohibited.';
comment on table public.language_translation_sessions is 'Session metrics only. Raw audio and transcript history are intentionally excluded.';
comment on table public.language_ai_operation_logs is 'Minimal AI routing telemetry without prompts, responses or raw learner history.';
