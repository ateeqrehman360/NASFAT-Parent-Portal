-- Let staff use the existing browser-based class points and teacher-notes screen.
-- Parent policies remain unchanged. Staff receive no delete permissions and can
-- only work with active students.

begin;

grant select on table public.classes, public.students, public.daily_points, public.student_notes to authenticated;
grant insert, update on table public.daily_points to authenticated;
grant insert on table public.student_notes to authenticated;

drop policy if exists "staff read classes" on public.classes;
create policy "staff read classes"
  on public.classes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
  );

drop policy if exists "staff read active students" on public.students;
create policy "staff read active students"
  on public.students
  for select
  to authenticated
  using (
    active = true
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
  );

drop policy if exists "staff read active student points" on public.daily_points;
create policy "staff read active student points"
  on public.daily_points
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = daily_points.student_id
        and students.active = true
    )
  );

drop policy if exists "staff add active student points" on public.daily_points;
create policy "staff add active student points"
  on public.daily_points
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = daily_points.student_id
        and students.active = true
    )
  );

drop policy if exists "staff update active student points" on public.daily_points;
create policy "staff update active student points"
  on public.daily_points
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = daily_points.student_id
        and students.active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = daily_points.student_id
        and students.active = true
    )
  );

drop policy if exists "staff read active student notes" on public.student_notes;
create policy "staff read active student notes"
  on public.student_notes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = student_notes.student_id
        and students.active = true
    )
  );

drop policy if exists "staff add active student notes" on public.student_notes;
create policy "staff add active student notes"
  on public.student_notes
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'staff'
    )
    and exists (
      select 1 from public.students
      where students.id = student_notes.student_id
        and students.active = true
    )
  );

commit;
