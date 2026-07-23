-- Kobciye Phase 4 guardian-link integrity follow-up.
-- The guardian directory is authoritative. parent_profile_id remains only as
-- a compatibility cache and must never delete a valid directory relationship.

-- Stop before mutation when an earlier guardian upgrade did not finish cleanly
-- or when legacy endpoint data needs explicit operator remediation.
do $$
begin
  if exists (select 1 from student_parents where parent_id is null) then
    raise exception using errcode = '23502',
      message = 'guardian integrity migration blocked: every guardian link must have a directory parent_id';
  end if;

  if exists (
    select 1 from parents p
    where is_university_institution(p.school_id)
  ) then
    raise exception using errcode = '23514',
      message = 'guardian integrity migration blocked: university guardian directory rows require remediation';
  end if;

  if exists (
    select 1
    from student_parents sp
    join parents p on p.id = sp.parent_id
    join students s on s.id = sp.student_id
    where p.school_id is distinct from s.school_id
      or is_university_institution(p.school_id)
      or is_university_institution(s.school_id)
  ) then
    raise exception using errcode = '23514',
      message = 'guardian integrity migration blocked: cross-school or university guardian links require remediation';
  end if;
end $$;

-- Normalize the cache while its original FK still validates non-null values.
update student_parents sp
set parent_profile_id = p.profile_id
from parents p
where p.id = sp.parent_id
  and sp.parent_profile_id is distinct from p.profile_id;

-- parent_profile_id is derived from parents.profile_id. Keeping the original
-- ON DELETE CASCADE FK would delete a valid guardian/student relationship when
-- only the guardian's optional login profile is removed.
alter table student_parents
  drop constraint if exists student_parents_parent_profile_id_fkey;
alter table student_parents alter column parent_id set not null;

create or replace function phase4_sync_guardian_profile_cache()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update student_parents
  set parent_profile_id = new.profile_id
  where parent_id = new.id
    and parent_profile_id is distinct from new.profile_id;
  return new;
end $$;
revoke all on function phase4_sync_guardian_profile_cache()
  from public, anon, authenticated;

drop trigger if exists parents_profile_link_cache_sync on parents;
create trigger parents_profile_link_cache_sync
  after update of profile_id on parents
  for each row
  when (old.profile_id is distinct from new.profile_id)
  execute function phase4_sync_guardian_profile_cache();

-- Link inserts/updates already validate both endpoints. These endpoint guards
-- preserve the same invariant if a privileged caller later moves a directory
-- guardian or student to another institution.
create or replace function phase4_guard_parent_link_endpoint()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_id is distinct from old.school_id
    and exists (select 1 from student_parents sp where sp.parent_id = old.id) then
    if is_university_institution(new.school_id) then
      raise exception 'a linked guardian cannot be moved to a university institution';
    end if;
    if exists (
      select 1
      from student_parents sp
      join students s on s.id = sp.student_id
      where sp.parent_id = old.id
        and s.school_id is distinct from new.school_id
    ) then
      raise exception 'a linked guardian cannot be moved across schools';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_parent_link_endpoint()
  from public, anon, authenticated;

drop trigger if exists parents_guard_link_endpoint on parents;
create trigger parents_guard_link_endpoint
  before update of school_id on parents
  for each row execute function phase4_guard_parent_link_endpoint();

create or replace function phase4_guard_student_link_endpoint()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_id is distinct from old.school_id
    and exists (select 1 from student_parents sp where sp.student_id = old.id) then
    if is_university_institution(new.school_id) then
      raise exception 'a student with guardian links cannot be moved to a university institution';
    end if;
    if exists (
      select 1
      from student_parents sp
      join parents p on p.id = sp.parent_id
      where sp.student_id = old.id
        and p.school_id is distinct from new.school_id
    ) then
      raise exception 'a student with guardian links cannot be moved across schools';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_student_link_endpoint()
  from public, anon, authenticated;

drop trigger if exists students_guard_guardian_link_endpoint on students;
create trigger students_guard_guardian_link_endpoint
  before update of school_id on students
  for each row execute function phase4_guard_student_link_endpoint();

comment on column student_parents.parent_profile_id is
  'Derived compatibility cache of parents.profile_id; parent_id is authoritative and profile deletion must preserve the relationship.';
