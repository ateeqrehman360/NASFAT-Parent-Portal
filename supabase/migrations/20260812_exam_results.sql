-- Exam results for Quran, Islamic Studies, and Arabic.
-- One row represents one student's results for one exam date.

begin;

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  exam_date date not null,
  quran_score numeric,
  islamic_studies_score numeric,
  arabic_score numeric,
  entered_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint exam_results_one_per_student_date unique (student_id, exam_date),
  constraint exam_results_scores_are_non_negative check (
    (quran_score is null or quran_score >= 0)
    and (islamic_studies_score is null or islamic_studies_score >= 0)
    and (arabic_score is null or arabic_score >= 0)
  )
);

create index if not exists exam_results_student_date_idx
  on public.exam_results (student_id, exam_date desc);

alter table public.exam_results enable row level security;

-- Browser clients only need to read this table. All writes are intentionally
-- restricted to the server-side route, which uses the service-role client
-- after verifying an admin or staff session.
revoke all on table public.exam_results from anon, authenticated;
grant select on table public.exam_results to authenticated;

-- Parents can only read results for students linked to their own account.
-- Admin/staff writes go through the server-side management route, which checks
-- the caller's profile role before using the service-role client.
drop policy if exists "parents read linked exam results" on public.exam_results;
create policy "parents read linked exam results"
  on public.exam_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.parent_student
      where parent_student.parent_id = auth.uid()
        and parent_student.student_id = exam_results.student_id
    )
  );

commit;
