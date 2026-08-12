-- Per-parent teacher-note notifications and read history.
-- The existing student_notes.is_read column is retained for compatibility, but
-- new read state is stored per parent so one parent cannot clear another's alert.

begin;

create table if not exists public.student_note_reads (
  note_id uuid not null references public.student_notes(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamp with time zone not null default now(),
  primary key (note_id, parent_id)
);

create index if not exists student_note_reads_parent_date_idx
  on public.student_note_reads (parent_id, read_at desc);

alter table public.student_note_reads enable row level security;

comment on table public.student_note_reads is
  'Per-parent read receipts for teacher notes. A missing row means the note is new for that parent.';

comment on column public.student_notes.is_read is
  'Legacy global read flag retained for compatibility. New code uses student_note_reads.';

-- Preserve any legacy globally-read state if it exists when this migration runs.
insert into public.student_note_reads (note_id, parent_id, read_at)
select note.id, link.parent_id, now()
from public.student_notes note
join public.parent_student link on link.student_id = note.student_id
where note.is_read is true
on conflict (note_id, parent_id) do nothing;

revoke all on table public.student_note_reads from anon, authenticated;
grant select, insert on table public.student_note_reads to authenticated;

drop policy if exists "Parents read own note receipts" on public.student_note_reads;
create policy "Parents read own note receipts"
  on public.student_note_reads
  for select
  to authenticated
  using (parent_id = (select auth.uid()));

drop policy if exists "Parents mark linked notes read" on public.student_note_reads;
create policy "Parents mark linked notes read"
  on public.student_note_reads
  for insert
  to authenticated
  with check (
    parent_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'parent'
    )
    and exists (
      select 1
      from public.student_notes note
      join public.parent_student link on link.student_id = note.student_id
      where note.id = student_note_reads.note_id
        and link.parent_id = (select auth.uid())
    )
  );

-- Parents no longer update the global flag. Admin note deletion goes through the
-- authenticated server route; staff continue to receive no delete permission.
drop policy if exists "Parents mark notes read" on public.student_notes;
revoke all on table public.student_notes from anon, authenticated;
grant select, insert on table public.student_notes to authenticated;

commit;
