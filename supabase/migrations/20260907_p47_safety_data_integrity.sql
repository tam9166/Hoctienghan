-- P47: optimistic concurrency and idempotent CloudSync writes.
-- Existing rows remain intact and start at revision 0.
alter table public.learning_sync
  add column if not exists revision bigint not null default 0;

drop policy if exists "users insert own learning sync" on public.learning_sync;
drop policy if exists "users update own learning sync" on public.learning_sync;
revoke insert, update, delete on public.learning_sync from anon, authenticated;

create table if not exists public.learning_sync_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  applied_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, mutation_id),
  constraint learning_sync_mutation_id_length check (char_length(mutation_id) between 8 and 160)
);

alter table public.learning_sync_mutations enable row level security;
revoke all on public.learning_sync_mutations from anon, authenticated;

create index if not exists learning_sync_mutations_applied_at_idx
  on public.learning_sync_mutations (applied_at desc);

create or replace function public.compare_and_swap_learning_sync(
  p_expected_revision bigint,
  p_payload jsonb,
  p_schema_version integer default 1,
  p_mutation_id text default null
)
returns table (
  sync_status text,
  current_revision bigint,
  current_payload jsonb,
  was_applied boolean,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_current_payload jsonb;
  v_mutation_id text := nullif(btrim(coalesce(p_mutation_id, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_mutation_id is null or char_length(v_mutation_id) < 8 or char_length(v_mutation_id) > 160 then
    raise exception 'invalid mutation id' using errcode = '22023';
  end if;

  insert into public.learning_sync (user_id, payload, schema_version, revision, updated_at)
  values (v_user_id, '{}'::jsonb, greatest(1, coalesce(p_schema_version, 1)), 0, timezone('utc', now()))
  on conflict (user_id) do nothing;

  select revision, payload
    into v_current_revision, v_current_payload
    from public.learning_sync
    where user_id = v_user_id
    for update;

  if v_current_revision <> greatest(0, coalesce(p_expected_revision, 0)) then
    return query select 'conflict'::text, v_current_revision, v_current_payload, false, false;
    return;
  end if;

  if exists (
    select 1 from public.learning_sync_mutations
    where user_id = v_user_id and mutation_id = v_mutation_id
  ) then
    return query select 'duplicate'::text, v_current_revision, v_current_payload, false, true;
    return;
  end if;

  update public.learning_sync
    set payload = coalesce(p_payload, '{}'::jsonb),
        schema_version = greatest(1, coalesce(p_schema_version, 1)),
        revision = revision + 1,
        updated_at = timezone('utc', now())
    where user_id = v_user_id
    returning revision, payload into v_current_revision, v_current_payload;

  insert into public.learning_sync_mutations (user_id, mutation_id)
  values (v_user_id, v_mutation_id);

  return query select 'applied'::text, v_current_revision, v_current_payload, true, false;
end;
$$;

revoke all on function public.compare_and_swap_learning_sync(bigint, jsonb, integer, text) from public;
grant execute on function public.compare_and_swap_learning_sync(bigint, jsonb, integer, text) to authenticated;
