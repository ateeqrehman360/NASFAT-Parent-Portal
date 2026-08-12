-- Preserve historic scores when the original paper's date was not recorded.
-- Dated results continue to use the existing one-student/one-date workflow.

begin;

alter table public.exam_results
  add column if not exists assessment_name text;

alter table public.exam_results
  alter column exam_date drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exam_results_requires_date_or_assessment'
      and conrelid = 'public.exam_results'::regclass
  ) then
    alter table public.exam_results
      add constraint exam_results_requires_date_or_assessment
      check (
        exam_date is not null
        or nullif(btrim(assessment_name), '') is not null
      );
  end if;
end $$;

-- A historic result has no date, so its assessment name becomes the stable
-- duplicate guard for that student. It does not affect the dated-result index.
create unique index if not exists exam_results_one_undated_assessment_per_student_idx
  on public.exam_results (student_id, assessment_name)
  where exam_date is null and assessment_name is not null;

commit;
