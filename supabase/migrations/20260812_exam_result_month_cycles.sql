-- Store one combined Quran, Islamic Studies, and Arabic result per student/month.
-- The supplied undated results were confirmed to be from July 2026.

begin;

-- Abort before merging if two rows in the same month contain different marks
-- for the same subject. This prevents a silent choice between conflicting data.
do $$
begin
  if exists (
    select 1
    from public.exam_results
    group by
      student_id,
      coalesce(date_trunc('month', exam_date)::date, date '2026-07-01')
    having
      count(distinct (quran_score, quran_max_score)) filter (where quran_score is not null) > 1
      or count(distinct (islamic_studies_score, islamic_studies_max_score)) filter (where islamic_studies_score is not null) > 1
      or count(distinct (arabic_score, arabic_max_score)) filter (where arabic_score is not null) > 1
  ) then
    raise exception 'Conflicting subject scores exist for the same student and exam month.';
  end if;
end $$;

create temporary table exam_results_month_merge on commit drop as
select
  (array_agg(id order by created_at, id))[1] as keep_id,
  student_id,
  coalesce(date_trunc('month', exam_date)::date, date '2026-07-01') as exam_month,
  max(quran_score) filter (where quran_score is not null) as quran_score,
  max(quran_max_score) filter (where quran_score is not null) as quran_max_score,
  max(islamic_studies_score) filter (where islamic_studies_score is not null) as islamic_studies_score,
  max(islamic_studies_max_score) filter (where islamic_studies_score is not null) as islamic_studies_max_score,
  max(arabic_score) filter (where arabic_score is not null) as arabic_score,
  max(arabic_max_score) filter (where arabic_score is not null) as arabic_max_score,
  (array_agg(entered_by order by updated_at desc) filter (where entered_by is not null))[1] as entered_by,
  min(created_at) as created_at,
  max(updated_at) as updated_at
from public.exam_results
group by
  student_id,
  coalesce(date_trunc('month', exam_date)::date, date '2026-07-01');

delete from public.exam_results as result
using exam_results_month_merge as merged
where result.student_id = merged.student_id
  and coalesce(date_trunc('month', result.exam_date)::date, date '2026-07-01') = merged.exam_month
  and result.id <> merged.keep_id;

update public.exam_results as result
set
  exam_date = merged.exam_month,
  assessment_name = null,
  quran_score = merged.quran_score,
  quran_max_score = merged.quran_max_score,
  islamic_studies_score = merged.islamic_studies_score,
  islamic_studies_max_score = merged.islamic_studies_max_score,
  arabic_score = merged.arabic_score,
  arabic_max_score = merged.arabic_max_score,
  entered_by = merged.entered_by,
  created_at = merged.created_at,
  updated_at = merged.updated_at
from exam_results_month_merge as merged
where result.id = merged.keep_id;

alter table public.exam_results
  drop constraint if exists exam_results_requires_date_or_assessment;

drop index if exists public.exam_results_one_undated_assessment_per_student_idx;

alter table public.exam_results
  alter column exam_date set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exam_results_date_is_month_start'
      and conrelid = 'public.exam_results'::regclass
  ) then
    alter table public.exam_results
      add constraint exam_results_date_is_month_start
      check (exam_date = date_trunc('month', exam_date)::date);
  end if;
end $$;

comment on column public.exam_results.exam_date is
  'Exam month stored as its first calendar day; interfaces display month and year only.';

commit;
