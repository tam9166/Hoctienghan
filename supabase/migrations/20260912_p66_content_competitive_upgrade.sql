-- P66: Vietnamese-first content metadata and review evidence.
-- Additive only: this migration does not update/delete learner progress, SRS,
-- mastery, learning history, auth records or cloud-sync snapshots.

alter table public.learning_content drop constraint if exists learning_content_type_check;
alter table public.learning_content
  add constraint learning_content_type_check
  check (type in (
    'lesson','vocabulary','grammar','audio','quiz','exercise','example',
    'listening','speaking','writing','reading','pronunciation','topik_question','culture_note','story'
  ));

alter table public.learning_content
  add column if not exists topic text not null default '' check (char_length(topic) <= 160),
  add column if not exists source_type text not null default 'CURRICULUM'
    check (source_type in ('OFFICIAL_VERIFIED','TOPIK_STYLE_PRACTICE','ORIGINAL_CREATED_CONTENT','CURRICULUM')),
  add column if not exists source_evidence jsonb not null default '[]'::jsonb,
  add column if not exists audio_source_type text
    check (audio_source_type is null or audio_source_type in ('NATIVE','AI_VOICE','TTS')),
  add column if not exists audio_metadata jsonb not null default '{}'::jsonb,
  add column if not exists quality_score integer check (quality_score between 0 and 100),
  add column if not exists quality_dimensions jsonb not null default '{}'::jsonb,
  add column if not exists ai_check jsonb not null default '{}'::jsonb,
  add column if not exists content_version_label text not null default '1.0.0'
    check (content_version_label ~ '^[0-9]+\.[0-9]+\.[0-9]+$');

alter table public.learning_content drop constraint if exists learning_content_p66_json_shapes_check;
alter table public.learning_content
  add constraint learning_content_p66_json_shapes_check check (
    jsonb_typeof(source_evidence) = 'array'
    and jsonb_typeof(audio_metadata) = 'object'
    and jsonb_typeof(quality_dimensions) = 'object'
    and jsonb_typeof(ai_check) = 'object'
  );

alter table public.content_quality_reports drop constraint if exists content_quality_reports_report_type_check;
alter table public.content_quality_reports
  add constraint content_quality_reports_report_type_check
  check (report_type in (
    'meaning','audio','example','answer','difficulty','duplicate',
    'difficult_explanation','question_issue','unnatural_example'
  ));

create index if not exists learning_content_quality_queue_idx
  on public.learning_content (review_status, quality_score, difficulty, type, updated_at desc);

create index if not exists learning_content_topic_search_idx
  on public.learning_content (topic, difficulty, review_status);

create or replace function public.guard_p66_content_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  metadata_changed boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    metadata_changed :=
      new.topic is distinct from old.topic
      or new.source_type is distinct from old.source_type
      or new.source_evidence is distinct from old.source_evidence
      or new.audio_source_type is distinct from old.audio_source_type
      or new.audio_metadata is distinct from old.audio_metadata
      or new.quality_score is distinct from old.quality_score
      or new.quality_dimensions is distinct from old.quality_dimensions
      or new.ai_check is distinct from old.ai_check
      or new.content_version_label is distinct from old.content_version_label;
  end if;

  if auth.uid() is not null and metadata_changed
     and not public.has_any_role(array['content_editor','admin']) then
    raise exception 'Only content editors can change P66 content metadata';
  end if;

  if new.review_status <> 'approved' and coalesce(new.quality_score, 0) > 69 then
    raise exception 'Unreviewed content quality score is provisional and capped at 69';
  end if;

  if new.source_type = 'OFFICIAL_VERIFIED'
     and jsonb_array_length(coalesce(new.source_evidence, '[]'::jsonb)) = 0 then
    raise exception 'Official content requires item-level source evidence';
  end if;

  if new.audio_source_type = 'NATIVE'
     and coalesce((new.audio_metadata ->> 'human_verified')::boolean, false) is not true then
    raise exception 'Native audio requires verified human recording evidence';
  end if;

  if tg_op = 'UPDATE' and new.content_version_label is distinct from old.content_version_label
     and new.version <= old.version then
    raise exception 'Content version label changes require a higher integer version';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_p66_content_metadata on public.learning_content;
create trigger guard_p66_content_metadata
  before insert or update on public.learning_content
  for each row execute function public.guard_p66_content_metadata();

comment on column public.learning_content.quality_score is
  '0-100 quality score. Unreviewed content remains review_status=review and is never published solely from this score.';
comment on column public.learning_content.source_type is
  'Explicit provenance; TOPIK_STYLE_PRACTICE and ORIGINAL_CREATED_CONTENT must never be presented as official exam questions.';
comment on column public.learning_content.audio_source_type is
  'Honest audio origin. NATIVE is reserved for a verified human native-speaker recording.';
comment on column public.learning_content.ai_check is
  'Machine check evidence only. Human reviewer evidence remains required by the P62 approval trigger.';
