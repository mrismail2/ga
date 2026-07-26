-- ============================================================
-- Kobciye Phase 5 — corrective migration: identifier login (Student / Parent)
--
-- Adds the server-side pieces the Student and Parent "School ID + Student ID +
-- password" login need, WITHOUT exposing any internal UUID to users and
-- WITHOUT any client service-role key. The actual password check happens in
-- the identifier-login Edge Function (an anon signInWithPassword against the
-- resolved account), so a real Supabase session is produced; this migration
-- only provides secure resolution, rate-limiting and audit primitives.
--
-- Reuses existing identifiers:
--   • schools.slug is a URL name; a NEW human-facing schools.login_code
--     ("SCH-0042") is the public school code — never the raw UUID.
--   • students.student_id ("HID-000142") is already unique(school_id,student_id)
--     and is reused as the student login id — no new student identifier column.
--   • student_parents.is_primary (Phase 4) selects the ONE primary-login parent
--     for the child-id parent login (resolves multi-guardian ambiguity, §3.4).
--
-- Additive, transactional, preserves data. Preflight stops safely on a
-- login_code collision instead of overwriting.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. schools.login_code — the public school code (not the UUID)
-- ------------------------------------------------------------
alter table schools add column if not exists login_code text;

-- Backfill a stable, human-readable code for existing schools that lack one.
-- Deterministic from the id so re-running is idempotent; 6 hex chars keeps it
-- short and collision-safe for realistic tenant counts.
update schools
  set login_code = 'SCH-' || upper(substr(replace(id::text, '-', ''), 1, 6))
  where login_code is null;

-- Preflight: refuse to install the unique index over a duplicate code rather
-- than silently mangling data. (Cannot happen from the deterministic backfill,
-- but a manually-set code could collide.)
do $$
begin
  if exists (
    select login_code from schools where login_code is not null
    group by login_code having count(*) > 1
  ) then
    raise exception 'duplicate schools.login_code values exist — resolve them before applying';
  end if;
end $$;

create unique index if not exists schools_login_code_unique
  on schools (login_code) where login_code is not null;

-- NEW schools (created after this migration, e.g. via create_school_as_super_admin)
-- get a deterministic public login_code automatically, so every school always
-- has one without exposing its UUID.
create or replace function phase5_fill_school_login_code()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.login_code is null then
    new.login_code := 'SCH-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  end if;
  return new;
end $$;
drop trigger if exists schools_fill_login_code on schools;
create trigger schools_fill_login_code before insert on schools
  for each row execute function phase5_fill_school_login_code();

-- ------------------------------------------------------------
-- 2. profiles.must_change_password — forced first-login change
-- ------------------------------------------------------------
alter table profiles add column if not exists must_change_password boolean not null default false;

-- ------------------------------------------------------------
-- 3. login_attempts — rate-limit + audit (no password ever stored)
-- ------------------------------------------------------------
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  school_code text,
  identifier text,          -- the student_id / child student_id typed
  kind text not null check (kind in ('student', 'parent')),
  ip text,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_lookup
  on login_attempts (kind, school_code, identifier, created_at desc);
create index if not exists login_attempts_ip on login_attempts (ip, created_at desc);

alter table login_attempts enable row level security;
-- no client reads/writes this table; the Edge Function uses the service role,
-- and a super_admin may read it for audit. Nothing else.
create policy "super admin reads login attempts" on login_attempts
  for select using (my_role() = 'super_admin');

-- ------------------------------------------------------------
-- 4. resolve_login_email — server-side identifier → auth email.
--    SECURITY DEFINER, service-role only. Returns the internal auth email of
--    the account to sign in, or NULL when anything does not resolve. Reveals
--    nothing to the client (the Edge Function keeps the email server-side).
--      student : the student's OWN activated profile
--      parent  : the is_primary parent linked to that student
-- ------------------------------------------------------------
create or replace function resolve_login_email(p_school_code text, p_student_id text, p_kind text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_school uuid;
  v_student uuid;
  v_profile uuid;
  v_email text;
begin
  if p_school_code is null or p_student_id is null then return null; end if;
  select id into v_school from schools where login_code = trim(p_school_code);
  if v_school is null then return null; end if;

  select id into v_student from students
    where school_id = v_school and student_id = trim(p_student_id);
  if v_student is null then return null; end if;

  if p_kind = 'student' then
    select profile_id into v_profile from students where id = v_student;
  elsif p_kind = 'parent' then
    -- the ONE primary-login parent for this child (multi-guardian safe)
    select p.profile_id into v_profile
    from student_parents sp
    join parents p on p.id = sp.parent_id
    where sp.student_id = v_student and sp.is_primary = true and p.profile_id is not null
    order by sp.id asc
    limit 1;
  else
    return null;
  end if;

  if v_profile is null then return null; end if;
  select email into v_email from auth.users where id = v_profile;
  return v_email;
end $$;
revoke all on function resolve_login_email(text, text, text) from public, anon, authenticated;
grant execute on function resolve_login_email(text, text, text) to service_role;

-- ------------------------------------------------------------
-- 5. is_login_locked / record_login_attempt — rate limiting + audit.
--    5 failed attempts for the same (kind, school_code, identifier) within
--    15 minutes locks that identifier for the rest of the window. Service-role
--    only; the Edge Function is the sole caller.
-- ------------------------------------------------------------
create or replace function is_login_locked(p_school_code text, p_identifier text, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 5
  from login_attempts
  where kind = p_kind and school_code = p_school_code and identifier = p_identifier
    and succeeded = false and created_at > now() - interval '15 minutes'
$$;
revoke all on function is_login_locked(text, text, text) from public, anon, authenticated;
grant execute on function is_login_locked(text, text, text) to service_role;

create or replace function record_login_attempt(p_school_code text, p_identifier text, p_kind text, p_success boolean, p_ip text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  insert into login_attempts (school_code, identifier, kind, ip, succeeded)
  values (p_school_code, p_identifier, p_kind, p_ip, coalesce(p_success, false));
  -- audit without ever storing the password or which field was wrong
  select id into v_school from schools where login_code = p_school_code;
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school, null,
          case when p_success then 'auth.identifier_login.success' else 'auth.identifier_login.failure' end,
          'login_attempts', null,
          jsonb_build_object('kind', p_kind, 'school_code', p_school_code));
end $$;
revoke all on function record_login_attempt(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function record_login_attempt(text, text, text, boolean, text) to service_role;

-- ------------------------------------------------------------
-- 6. set_school_login_code — a School Admin (or super_admin) may set/change
--    their school's public login code (validated, unique). Never exposes the
--    UUID; the code is what appears on printed login slips.
-- ------------------------------------------------------------
create or replace function set_school_login_code(p_school uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(coalesce(p_code, '')));
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may set the login code'; end if;
  if v_code = '' or length(v_code) < 4 then raise exception 'the login code must be at least 4 characters'; end if;
  if exists (select 1 from schools where login_code = v_code and id <> p_school) then
    raise exception 'this login code is already in use';
  end if;
  update schools set login_code = v_code where id = p_school;
  return v_code;
end $$;
revoke all on function set_school_login_code(uuid, text) from public, anon;
grant execute on function set_school_login_code(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 7. clear_must_change_password — a user clears their own flag after they set
--    a new password (the app calls this right after updateUser succeeds).
-- ------------------------------------------------------------
create or replace function clear_must_change_password()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- must_change_password is outside the profiles direct-edit allow-list, so use
  -- the same sanctioned transaction-local bypass assign_role() uses, scoped to
  -- exactly this one self-update.
  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles set must_change_password = false where id = auth.uid();
  perform set_config('kobciye.bypass_profile_guard', 'off', true);
end $$;
revoke all on function clear_must_change_password() from public, anon;
grant execute on function clear_must_change_password() to authenticated;

commit;
