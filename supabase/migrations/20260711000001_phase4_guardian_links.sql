-- Kobciye Phase 4 runtime correction: guardian directory links.
-- Reuses student_parents and safely upgrades legacy profile-only links.

-- Fail before any schema mutation when legacy data needs operator review.
do $$
begin
  if exists (
    select 1 from student_parents
    where parent_id is not null
    group by parent_id, student_id having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'guardian migration blocked: duplicate legacy (parent_id, student_id) links require remediation';
  end if;

  if exists (
    select 1 from student_parents where is_primary
    group by student_id having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'guardian migration blocked: more than one primary guardian exists for a student';
  end if;

  if exists (
    select 1 from parents where profile_id is not null
    group by profile_id having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'guardian migration blocked: one profile is assigned to multiple guardian directory rows';
  end if;

  if exists (
    select 1
    from parents p
    left join profiles pr on pr.id = p.profile_id
    where p.profile_id is not null
      and (pr.id is null or pr.role <> 'parent' or pr.school_id is distinct from p.school_id
        or is_university_institution(p.school_id))
  ) then
    raise exception using errcode = '23514',
      message = 'guardian migration blocked: parents.profile_id must reference a same-school parent profile';
  end if;

  if exists (
    select sp.parent_id
    from student_parents sp
    join parents p on p.id = sp.parent_id and p.profile_id is null
    group by sp.parent_id
    having count(distinct sp.parent_profile_id) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'guardian migration blocked: one directory guardian maps to multiple legacy profiles';
  end if;

  if exists (
    select 1
    from student_parents sp
    join students s on s.id = sp.student_id
    left join profiles pr on pr.id = sp.parent_profile_id
    where sp.parent_id is null
      and (pr.id is null or pr.role <> 'parent' or pr.school_id is distinct from s.school_id
        or is_university_institution(s.school_id))
  ) then
    raise exception using errcode = '23514',
      message = 'guardian migration blocked: a legacy profile-only link is not a valid same-school parent';
  end if;

  if exists (
    select effective_profile
    from (
      select p.id, coalesce(p.profile_id, (
        select sp.parent_profile_id from student_parents sp
        where sp.parent_id = p.id order by sp.student_id limit 1
      )) as effective_profile
      from parents p
    ) x
    where effective_profile is not null
    group by effective_profile having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'guardian migration blocked: legacy normalization would assign one profile to multiple guardians';
  end if;
end $$;

alter table student_parents add column id uuid default gen_random_uuid();
alter table student_parents alter column id set not null;
alter table student_parents drop constraint student_parents_pkey;
alter table student_parents add constraint student_parents_pkey primary key (id);
alter table student_parents alter column parent_profile_id drop not null;

-- Recover a directory profile from one unambiguous, valid legacy link.
update parents p
set profile_id = (
  select sp.parent_profile_id
  from student_parents sp
  join profiles pr on pr.id = sp.parent_profile_id
  join students s on s.id = sp.student_id
  where sp.parent_id = p.id and pr.role = 'parent'
    and pr.school_id = p.school_id and s.school_id = p.school_id
  order by sp.student_id limit 1
)
where p.profile_id is null
  and exists (select 1 from student_parents sp where sp.parent_id = p.id);

-- Give every valid legacy profile-only relationship a real directory row.
insert into parents (school_id, profile_id, full_name, phone)
select distinct on (pr.id)
  pr.school_id, pr.id, coalesce(nullif(trim(pr.full_name), ''), 'Waalid'), pr.phone
from student_parents sp
join students s on s.id = sp.student_id
join profiles pr on pr.id = sp.parent_profile_id
where sp.parent_id is null and pr.role = 'parent' and pr.school_id = s.school_id
  and not is_university_institution(s.school_id)
  and not exists (select 1 from parents p where p.profile_id = pr.id)
order by pr.id;

update student_parents sp
set parent_id = p.id
from parents p
where sp.parent_id is null and p.profile_id = sp.parent_profile_id;

-- Directory identity is authoritative; invalid placeholder profile IDs become
-- NULL while the guardian/student relationship itself remains intact.
update student_parents sp
set parent_profile_id = p.profile_id
from parents p
where sp.parent_id = p.id and sp.parent_profile_id is distinct from p.profile_id;

alter table student_parents
  add constraint student_parents_has_guardian
  check (parent_id is not null or parent_profile_id is not null);

create unique index parents_profile_unique
  on parents (profile_id) where profile_id is not null;
create unique index student_parents_directory_unique
  on student_parents (parent_id, student_id) where parent_id is not null;
create unique index student_parents_profile_unique
  on student_parents (parent_profile_id, student_id) where parent_profile_id is not null;
create unique index student_parents_one_primary
  on student_parents (student_id) where is_primary;

create or replace function phase4_guard_parent_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role user_role; v_school uuid;
begin
  if is_university_institution(new.school_id) then
    raise exception 'guardian directory is only available to school institutions';
  end if;
  if new.profile_id is not null then
    select role, school_id into v_role, v_school from profiles where id = new.profile_id;
    if not found or v_role <> 'parent' or v_school is distinct from new.school_id then
      raise exception 'guardian profile must be a parent in the same school';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_parent_profile() from public, anon, authenticated;
create trigger parents_profile_school_guard
  before insert or update on parents
  for each row execute function phase4_guard_parent_profile();

create or replace function guard_student_parents_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student_school uuid; v_parent_school uuid; v_directory_profile uuid;
  v_profile_school uuid; v_profile_role user_role;
begin
  select school_id into v_student_school from students where id = new.student_id;
  if not found then raise exception 'student does not exist'; end if;
  if is_university_institution(v_student_school) then
    raise exception 'guardian links are only available to school institutions';
  end if;

  if new.parent_id is not null then
    select school_id, profile_id into v_parent_school, v_directory_profile
      from parents where id = new.parent_id;
    if not found then raise exception 'guardian does not exist'; end if;
    if v_parent_school is distinct from v_student_school then
      raise exception 'parent and student must belong to the same school';
    end if;
    new.parent_profile_id := v_directory_profile;
  elsif new.parent_profile_id is null then
    raise exception 'a guardian directory row or parent profile is required';
  end if;

  if new.parent_profile_id is not null then
    select school_id, role into v_profile_school, v_profile_role
      from profiles where id = new.parent_profile_id;
    if not found or v_profile_role <> 'parent' or v_profile_school is distinct from v_student_school then
      raise exception 'parent profile must be a parent in the student school';
    end if;
  end if;
  return new;
end $$;
revoke all on function guard_student_parents_school() from public, anon, authenticated;

create or replace function is_parent_of(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from student_parents sp
    join students s on s.id = sp.student_id
    join profiles pr on pr.id = auth.uid()
    left join parents p on p.id = sp.parent_id
    where sp.student_id = p_student
      and pr.role = 'parent' and pr.school_id = s.school_id
      and not is_university_institution(s.school_id)
      and ((sp.parent_id is not null and p.profile_id = pr.id and p.school_id = s.school_id)
        or (sp.parent_id is null and sp.parent_profile_id = pr.id))
  );
$$;
revoke all on function is_parent_of(uuid) from public;
grant execute on function is_parent_of(uuid) to anon, authenticated;

create or replace function owns_parent_link(p_link uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from student_parents sp
    join students s on s.id = sp.student_id
    join profiles pr on pr.id = auth.uid()
    left join parents p on p.id = sp.parent_id
    where sp.id = p_link and pr.role = 'parent' and pr.school_id = s.school_id
      and not is_university_institution(s.school_id)
      and ((sp.parent_id is not null and p.profile_id = pr.id and p.school_id = s.school_id)
        or (sp.parent_id is null and sp.parent_profile_id = pr.id))
  );
$$;
revoke all on function owns_parent_link(uuid) from public;
grant execute on function owns_parent_link(uuid) to anon, authenticated;

drop policy if exists "admins manage parents" on parents;
create policy "admins manage parents" on parents for all
  using (is_admin_of(school_id) and not is_university_institution(school_id))
  with check (is_admin_of(school_id) and not is_university_institution(school_id));

drop policy if exists "staff read parents" on parents;
create policy "staff read parents" on parents for select
  using (is_staff_of(school_id) and not is_university_institution(school_id));

drop policy if exists "parents read own row" on parents;
create policy "parents read own row" on parents for select
  using (profile_id = auth.uid()
    and not is_university_institution(school_id)
    and exists (
      select 1 from profiles pr where pr.id = auth.uid()
        and pr.role = 'parent' and pr.school_id = parents.school_id
    ));

drop policy if exists "parents read own links" on student_parents;
create policy "parents read own links" on student_parents for select
  using (owns_parent_link(id));

drop policy if exists "admins manage parent links" on student_parents;
create policy "admins manage parent links" on student_parents for all
  using (exists (
    select 1 from students s where s.id = student_parents.student_id
      and is_admin_of(s.school_id)
      and not is_university_institution(s.school_id)
  ))
  with check (exists (
    select 1 from students s where s.id = student_parents.student_id
      and is_admin_of(s.school_id)
      and not is_university_institution(s.school_id)
  ));

comment on column student_parents.id is
  'Stable Phase 4 link identifier used for guardian-link edit and unlink operations.';
