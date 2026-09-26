-- Record-level, local-first learning sync. Apply after 20260907_p47_safety_data_integrity.sql.
-- The legacy learning_sync snapshot remains as a compatibility backup during rollout.

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

create index if not exists user_learning_records_user_updated_idx
  on public.user_learning_records (user_id, updated_at, domain, record_id);
create index if not exists user_learning_records_user_domain_idx
  on public.user_learning_records (user_id, domain, record_id);

alter table public.user_learning_records enable row level security;
drop policy if exists "users read own learning records" on public.user_learning_records;
create policy "users read own learning records"
  on public.user_learning_records for select
  using (auth.uid() = user_id);
revoke all on public.user_learning_records from anon;
revoke insert, update, delete on public.user_learning_records from anon, authenticated;
grant select on public.user_learning_records to authenticated;

create table if not exists public.learning_record_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  device_id text not null,
  applied_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, mutation_id),
  constraint learning_record_mutation_id_length check (char_length(mutation_id) between 8 and 160),
  constraint learning_record_mutation_device_id_length check (char_length(device_id) between 8 and 120)
);

alter table public.learning_record_mutations enable row level security;
revoke all on public.learning_record_mutations from anon, authenticated;
create index if not exists learning_record_mutations_applied_at_idx
  on public.learning_record_mutations (applied_at desc);

create or replace function public.apply_learning_record_batch(
  p_records jsonb,
  p_mutation_id text,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_mutation_id text := btrim(coalesce(p_mutation_id, ''));
  v_device_id text := btrim(coalesce(p_device_id, ''));
  v_item jsonb;
  v_domain text;
  v_record_id text;
  v_expected bigint;
  v_current public.user_learning_records%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if char_length(v_mutation_id) < 8 or char_length(v_mutation_id) > 160 then
    raise exception 'invalid mutation id' using errcode = '22023';
  end if;
  if char_length(v_device_id) < 8 or char_length(v_device_id) > 120 then
    raise exception 'invalid device id' using errcode = '22023';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 200 then
    raise exception 'records must be an array of at most 200 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_records) item
    group by btrim(item->>'domain'), btrim(item->>'recordId')
    having count(*) > 1
  ) then
    raise exception 'duplicate record in batch' using errcode = '22023';
  end if;

  if exists (select 1 from public.learning_record_mutations where user_id = v_user_id and mutation_id = v_mutation_id) then
    return jsonb_build_object('supported', true, 'status', 'duplicate', 'records', '[]'::jsonb);
  end if;

  -- Validate and lock the complete batch before writing, preventing partial application.
  for v_item in select value from jsonb_array_elements(p_records)
  loop
    v_domain := btrim(coalesce(v_item->>'domain', ''));
    v_record_id := btrim(coalesce(v_item->>'recordId', ''));
    v_expected := greatest(0, coalesce((v_item->>'expectedVersion')::bigint, 0));
    if char_length(v_domain) < 1 or char_length(v_domain) > 120 or char_length(v_record_id) < 1 or char_length(v_record_id) > 180 or jsonb_typeof(coalesce(v_item->'payload', '{}'::jsonb)) <> 'object' then
      raise exception 'invalid learning record' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || '|' || v_domain || '|' || v_record_id, 0));
    select * into v_current from public.user_learning_records
      where user_id = v_user_id and domain = v_domain and record_id = v_record_id
      for update;
    if (found and v_current.version <> v_expected) or (not found and v_expected <> 0) then
      if found then
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
          'domain', v_current.domain, 'record_id', v_current.record_id, 'payload', v_current.payload,
          'version', v_current.version, 'device_id', v_current.device_id,
          'client_updated_at', v_current.client_updated_at, 'updated_at', v_current.updated_at, 'deleted_at', v_current.deleted_at
        ));
      else
        v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('domain', v_domain, 'record_id', v_record_id, 'payload', '{}'::jsonb, 'version', 0));
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object('supported', true, 'status', 'conflict', 'records', v_conflicts);
  end if;

  for v_item in select value from jsonb_array_elements(p_records)
  loop
    v_domain := btrim(v_item->>'domain');
    v_record_id := btrim(v_item->>'recordId');
    v_expected := greatest(0, coalesce((v_item->>'expectedVersion')::bigint, 0));
    insert into public.user_learning_records (
      user_id, domain, record_id, payload, version, device_id, client_updated_at, deleted_at, updated_at
    ) values (
      v_user_id, v_domain, v_record_id, coalesce(v_item->'payload', '{}'::jsonb), 1, v_device_id,
      coalesce(nullif(v_item->>'clientUpdatedAt', '')::timestamptz, timezone('utc', now())),
      nullif(v_item->>'deletedAt', '')::timestamptz, timezone('utc', now())
    )
    on conflict (user_id, domain, record_id) do update set
      payload = excluded.payload,
      version = public.user_learning_records.version + 1,
      device_id = excluded.device_id,
      client_updated_at = excluded.client_updated_at,
      deleted_at = excluded.deleted_at,
      updated_at = timezone('utc', now())
    returning * into v_current;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'domain', v_current.domain, 'record_id', v_current.record_id, 'payload', v_current.payload,
      'version', v_current.version, 'device_id', v_current.device_id,
      'client_updated_at', v_current.client_updated_at, 'updated_at', v_current.updated_at, 'deleted_at', v_current.deleted_at
    ));
  end loop;

  insert into public.learning_record_mutations (user_id, mutation_id, device_id)
    values (v_user_id, v_mutation_id, v_device_id);
  return jsonb_build_object('supported', true, 'status', 'applied', 'records', v_results);
end;
$$;

revoke all on function public.apply_learning_record_batch(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.apply_learning_record_batch(jsonb, text, text) to authenticated;

comment on table public.user_learning_records is
  'Per-user learning records for conflict-safe local-first sync; legacy learning_sync remains a rollout backup.';
