-- Kobciye Phase 4 focused follow-up
-- Active enrollments must always point to a real class and academic year.
--
-- This migration is required because the existing table intentionally kept
-- those columns nullable for historical/non-active rows, while the runtime
-- requirement for a NEW active enrollment is stricter. The existing trigger
-- is replaced in place; no tables are reset and historical rows are not
-- rewritten.

create or replace function phase4_guard_student_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.class_id is null then
    raise exception 'active enrollment requires a class';
  end if;
  if new.status = 'active' and new.academic_year_id is null then
    raise exception 'active enrollment requires an academic year';
  end if;

  if not exists (
    select 1 from students s
    where s.id = new.student_id and s.school_id = new.school_id
  ) then
    raise exception 'student belongs to another school';
  end if;

  if new.class_id is not null and not exists (
    select 1 from classes c
    where c.id = new.class_id and c.school_id = new.school_id
  ) then
    raise exception 'class belongs to another school';
  end if;

  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id
  ) then
    raise exception 'stream belongs to another school';
  end if;

  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y
    where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then
    raise exception 'academic_year belongs to another school';
  end if;

  return new;
end
$$;

revoke all on function phase4_guard_student_enrollments() from public, anon, authenticated;
