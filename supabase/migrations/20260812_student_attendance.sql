-- Saturday attendance for the NASFAT Parent Portal.
-- Absence is implicit: once Sunday arrives, every eligible Saturday is part of
-- the denominator and only students with a present row count as attended.

begin;

-- The frontend already routes staff to exam entry, and attendance uses the same
-- narrowly scoped editor role. The live constraint previously allowed only
-- admin and parent, so include staff without changing any RLS policy.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'parent', 'staff'));

alter table public.students
  add column if not exists attendance_started_on date;

-- Existing active students begin with the next class after this migration.
-- Students without a class (and archived students) begin when an admin later
-- assigns/restores them through the management screen.
update public.students
set attendance_started_on = current_date
where attendance_started_on is null
  and active = true
  and class_id is not null;

comment on column public.students.attendance_started_on is
  'Date from which completed Saturday classes are included in the current attendance percentage.';

create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  class_date date not null,
  present boolean not null default true,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint student_attendance_one_per_student_date unique (student_id, class_date),
  constraint student_attendance_class_date_is_saturday check (extract(isodow from class_date) = 6)
);

create index if not exists student_attendance_class_date_idx
  on public.student_attendance (class_id, class_date desc);

alter table public.student_attendance enable row level security;

-- Browser clients only read attendance. Admin and staff writes go through the
-- server-side management route after its role check, using the service role.
revoke all on table public.student_attendance from anon, authenticated;
grant select on table public.student_attendance to authenticated;

drop policy if exists "parents read linked attendance" on public.student_attendance;
create policy "parents read linked attendance"
  on public.student_attendance
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.parent_student
      where parent_student.parent_id = (select auth.uid())
        and parent_student.student_id = student_attendance.student_id
    )
  );

commit;
