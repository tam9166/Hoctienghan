-- P37: private AI-assisted authoring drafts with mandatory human approval.
-- AI clients never receive a publish capability; final learning_content writes remain admin-only.

create table if not exists public.ai_content_drafts (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('lesson','example','audio','quiz','curriculum')),
  title text not null check (char_length(title) between 1 and 160),
  difficulty text not null check (difficulty in ('TOPIK_0','TOPIK_1','TOPIK_2','TOPIK_3','TOPIK_4','TOPIK_5','TOPIK_6')),
  prompt_version text not null check (char_length(prompt_version) between 1 and 80),
  model_route text not null default 'small' check (char_length(model_route) between 1 and 80),
  generation_payload jsonb not null default '{}'::jsonb,
  draft_payload jsonb not null default '{}'::jsonb,
  status text not null default 'ai_draft' check (status in ('ai_draft','human_review','needs_revision','approved','published')),
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  duplicate_report jsonb not null default '{}'::jsonb,
  workflow_history jsonb not null default '[]'::jsonb check (jsonb_typeof(workflow_history) = 'array'),
  human_approved boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text not null default '' check (char_length(review_notes) <= 4000),
  published_content_id text references public.learning_content(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_draft_approval_gate check (
    (status not in ('approved','published'))
    or (human_approved = true and reviewed_by is not null)
  ),
  constraint ai_draft_publish_gate check (
    status <> 'published' or published_content_id is not null
  )
);

create index if not exists ai_content_drafts_queue_idx on public.ai_content_drafts(status, updated_at desc);
create index if not exists ai_content_drafts_creator_idx on public.ai_content_drafts(created_by, updated_at desc);
alter table public.ai_content_drafts enable row level security;

drop policy if exists "content staff read AI drafts" on public.ai_content_drafts;
create policy "content staff read AI drafts" on public.ai_content_drafts
  for select to authenticated
  using (public.has_any_role(array['reviewer','content_editor','admin']));

drop policy if exists "content editors create AI drafts" on public.ai_content_drafts;
create policy "content editors create AI drafts" on public.ai_content_drafts
  for insert to authenticated
  with check (
    public.has_any_role(array['content_editor','admin'])
    and created_by = auth.uid()
    and status = 'ai_draft'
    and human_approved = false
    and reviewed_by is null
    and published_content_id is null
  );

drop policy if exists "content staff update AI drafts" on public.ai_content_drafts;
create policy "content staff update AI drafts" on public.ai_content_drafts
  for update to authenticated
  using (public.has_any_role(array['reviewer','content_editor','admin']))
  with check (
    public.has_any_role(array['reviewer','content_editor','admin'])
    and created_by is not null
    and (status <> 'published' or public.has_any_role(array['admin']))
  );

create or replace function public.guard_ai_content_draft_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.created_by <> old.created_by then
    raise exception 'Draft ownership is immutable';
  end if;
  if old.status = 'published' and new.status <> 'published' then
    raise exception 'Published AI content drafts are immutable';
  end if;
  if not (
    (old.status = 'ai_draft' and new.status in ('ai_draft','human_review'))
    or (old.status = 'human_review' and new.status in ('human_review','needs_revision','approved'))
    or (old.status = 'needs_revision' and new.status in ('needs_revision','human_review'))
    or (old.status = 'approved' and new.status in ('approved','published'))
    or (old.status = 'published' and new.status = 'published')
  ) then
    raise exception 'Invalid AI content workflow transition';
  end if;
  if new.status in ('approved','published') and (new.human_approved is not true or new.reviewed_by is null) then
    raise exception 'Human approval is required';
  end if;
  if new.status = 'published' and not public.has_any_role(array['admin']) then
    raise exception 'Only admins can publish human-approved content';
  end if;
  if new.status = 'published' and new.content_type = 'curriculum' then
    raise exception 'AI curriculum proposals cannot be published';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_ai_content_draft_transition on public.ai_content_drafts;
create trigger guard_ai_content_draft_transition
  before update on public.ai_content_drafts
  for each row execute function public.guard_ai_content_draft_transition();

comment on table public.ai_content_drafts is 'Private staff drafts. AI can draft and score only; human review and admin publication are mandatory.';
