-- Run this in the Supabase SQL editor before using the management screens.
-- Safe to re-run; the existing column is named active.
alter table public.students add column if not exists active boolean not null default true;
update public.students set active = true where active is null;
create index if not exists students_active_class_id_idx on public.students (class_id) where active = true;

-- Existing RLS policies are intentionally unchanged. The management route verifies
-- the caller's session and profiles.role = 'admin' before using service role.
