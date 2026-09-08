-- P52: expose only aggregate learning outcomes to an authorized teacher.
-- The raw attempts, journal, answers and private profile remain outside this RPC.
create or replace function public.education_student_summary(target_student uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  learner_progress jsonb;
  learner_errors jsonb;
  learner_outcomes jsonb;
  safe_errors jsonb;
  safe_outcomes jsonb;
begin
  if not public.has_any_role(array['teacher','admin']) or not (
    exists (select 1 from public.teacher_student_links link where link.teacher_id = auth.uid() and link.student_id = target_student and link.status = 'accepted')
    or exists (
      select 1 from public.education_class_students enrollment
      join public.education_classes classroom on classroom.id = enrollment.class_id
      where classroom.teacher_id = auth.uid() and enrollment.student_id = target_student and enrollment.status = 'active'
    )
  ) then raise exception 'student summary unavailable'; end if;

  select coalesce(payload #> '{data,klearn_progress}', '{}'::jsonb),
         coalesce(payload #> '{data,klearn_errors}', '[]'::jsonb),
         coalesce(payload #> '{data,klearn_learning_outcomes}', '[]'::jsonb)
    into learner_progress, learner_errors, learner_outcomes
  from public.learning_sync where user_id = target_student;

  if jsonb_typeof(learner_errors) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', coalesce(entry ->> 'type', 'learning'),
      'title', coalesce(nullif(entry ->> 'question', ''), nullif(entry ->> 'mistake', ''), 'Lỗi học tập'),
      'count', greatest(1, coalesce((entry ->> 'count')::integer, 1)),
      'resolved', coalesce((entry ->> 'resolved')::boolean, false)
    )), '[]'::jsonb) into safe_errors
    from (select value as entry from jsonb_array_elements(learner_errors) limit 8) limited_errors;
  else
    safe_errors := '[]'::jsonb;
  end if;

  if jsonb_typeof(learner_outcomes) = 'array' and jsonb_array_length(learner_outcomes) > 0 then
    safe_outcomes := jsonb_build_object(
      'status', case when learner_outcomes #>> '{0,teacherSummary,status}' = 'measured' then 'measured' else 'collecting' end,
      'overallGrowth', learner_outcomes #> '{0,teacherSummary,overallGrowth}',
      'goalProgress', learner_outcomes #> '{0,teacherSummary,goalProgress}',
      'retention7', learner_outcomes #> '{0,teacherSummary,retention7}',
      'retention30', learner_outcomes #> '{0,teacherSummary,retention30}',
      'evidenceCount', coalesce(learner_outcomes #> '{0,teacherSummary,evidenceCount}', '0'::jsonb),
      'skillGrowth', coalesce(learner_outcomes #> '{0,teacherSummary,skillGrowth}', '{}'::jsonb),
      'updatedAt', learner_outcomes #>> '{0,teacherSummary,updatedAt}'
    );
  else
    safe_outcomes := jsonb_build_object('status','collecting','overallGrowth',null,'goalProgress',null,'retention7',null,'retention30',null,'evidenceCount',0,'skillGrowth','{}'::jsonb);
  end if;

  result := jsonb_build_object(
    'stats', coalesce(learner_progress -> 'stats', '{}'::jsonb),
    'skills', coalesce(learner_progress -> 'skills', '{}'::jsonb),
    'progress', coalesce((learner_progress #>> '{stats,overallProgress}')::numeric, 0),
    'studyMinutes', coalesce((learner_progress #>> '{stats,totalMinutes}')::numeric, (learner_progress #>> '{stats,weeklyStudyMinutes}')::numeric, 0),
    'lessonCount', jsonb_object_length(coalesce(learner_progress -> 'lessonProgress', '{}'::jsonb)),
    'mistakes', safe_errors,
    'outcomes', safe_outcomes,
    'updatedAt', now()
  );
  return result;
exception when invalid_text_representation then
  return jsonb_build_object('stats','{}'::jsonb,'skills','{}'::jsonb,'progress',0,'studyMinutes',0,'lessonCount',0,'mistakes','[]'::jsonb,'outcomes',jsonb_build_object('status','collecting'));
end;
$$;

revoke all on function public.education_student_summary(uuid) from public;
grant execute on function public.education_student_summary(uuid) to authenticated;
