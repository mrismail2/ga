-- ============================================================
-- Kobciye — Phase 2 security hardening, round 3 (independent verification)
--
-- Fixes two remaining gaps found after migration 0007:
--
--  1. guard_profile_privileged_fields() blocked role/school_id changes but
--     nothing stopped a normal client from directly rewriting created_at
--     (or updated_at, or any other non-safe column): e.g.
--       update profiles set created_at = '2000-01-01' where id = auth.uid();
--     Fixed by switching from a deny-list (role, school_id, id) to an
--     ALLOW-list (full_name, phone, avatar_url) — every other column,
--     including ones added by a future migration, is blocked by default
--     without needing this trigger touched again.
--
--  2. provision_school() let ANY authenticated 'pending' account create a
--     school and become its first school_admin. The actual product rule is
--     narrower: only a verified super_admin may create a school and assign
--     its first school_admin. provision_school() is now disabled for all
--     client roles (EXECUTE revoked); create_school_as_super_admin() is the
--     replacement, gated on the caller's role being super_admin in the
--     database (never trusting client input for that check).
-- ============================================================

-- ============================================================
-- A. profiles: allow-list, not deny-list, for client-writable columns
-- ============================================================

create or replace function guard_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  -- No JWT session (SQL Editor / service-role / the auth service's own
  -- internal writes, e.g. handle_new_user()'s insert) is trusted — see
  -- migrations 0006/0007 for why this is intentional, not a hole.
  if auth.uid() is null then
    return new;
  end if;

  -- the ONLY other sanctioned path: provision_school() (disabled below) /
  -- assign_role() / create_school_as_super_admin() set this
  -- transaction-local flag right before their own UPDATE and clear it
  -- right after. Nothing else may set it.
  if current_setting('kobciye.bypass_profile_guard', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'pending' or new.school_id is not null then
      raise exception 'privilege escalation blocked: a new profile must start as pending with no school';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE': allow-list. Only full_name/phone/avatar_url may
  -- differ from the stored row. Everything else — id, role, school_id,
  -- created_at, updated_at, and any column a future migration adds — is
  -- rejected by default, not enumerated one at a time. (updated_at is
  -- deliberately included in the comparison, not excluded: this trigger
  -- fires BEFORE profiles_updated_at in the same BEFORE UPDATE phase —
  -- "profiles_guard_privileged" sorts before "profiles_updated_at" — so at
  -- this point new.updated_at still holds whatever the CLIENT sent, not
  -- yet the automatic now(). A client-supplied value is caught and
  -- rejected here; the legitimate automatic bump happens afterward, in a
  -- separate trigger, on a statement that already passed this check.)
  v_old := to_jsonb(old) - array['full_name', 'phone', 'avatar_url'];
  v_new := to_jsonb(new) - array['full_name', 'phone', 'avatar_url'];
  if v_old is distinct from v_new then
    raise exception 'privilege escalation blocked: only full_name, phone and avatar_url may be changed directly; everything else requires assign_role() / create_school_as_super_admin()';
  end if;

  return new;
end $$;

comment on function guard_profile_privileged_fields() is
  'Allow-list (full_name, phone, avatar_url) for direct client UPDATEs on profiles — everything else, present or future, is blocked by default. The only way to change role/school_id is the bypass flag, set exclusively inside assign_role()/create_school_as_super_admin().';

-- ============================================================
-- B. school provisioning: super_admin only, not self-service
-- ============================================================

-- Disable the old self-service path for every client role. The function
-- stays defined (audit/history trail, and so any migration that already
-- referenced it doesn't break) but is now unreachable through PostgREST.
revoke all on function provision_school(text, text, text) from public, anon, authenticated;
comment on function provision_school(text, text, text) is
  'DISABLED for client use as of migration 0008. The product rule is that only a verified super_admin may create a school (see create_school_as_super_admin()) — self-service "sign up and become admin of your own new school" is not the intended flow. EXECUTE revoked from all client roles; kept only for reference.';

-- The replacement: only a super_admin (verified from profiles.role in the
-- database — never from client input) may create a school and assign a
-- specific PENDING profile as its first school_admin.
create or replace function create_school_as_super_admin(
  p_name text,
  p_slug text,
  p_location text,
  p_initial_admin_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_target_role user_role;
  v_target_school uuid;
  v_school_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_school_as_super_admin must be called by an authenticated user';
  end if;

  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'only a super_admin may create a school';
  end if;

  select role, school_id into v_target_role, v_target_school
    from profiles where id = p_initial_admin_profile_id;
  if v_target_role is null then
    raise exception 'target profile % not found', p_initial_admin_profile_id;
  end if;
  if v_target_role is distinct from 'pending' or v_target_school is not null then
    raise exception 'the initial admin must be a pending profile with no existing school';
  end if;

  -- 1. create the school
  insert into schools (name, slug, location)
  values (p_name, p_slug, p_location)
  returning id into v_school_id;

  -- 2. create the initial subscription/trial
  insert into subscriptions (school_id, plan, status, trial_ends_at, current_period_end)
  values (v_school_id, 'small', 'trialing', now() + interval '30 days', now() + interval '30 days');

  -- 3. assign the target profile as school_admin (the only sanctioned
  --    bypass of the column guard above — see part A)
  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles
     set role = 'school_admin', school_id = v_school_id
   where id = p_initial_admin_profile_id;
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  -- 4. school_members is synced automatically by sync_primary_membership()
  --    (fires off the profiles UPDATE above — no direct write needed here)

  -- 5. audit log
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school_id, auth.uid(), 'school.provision_by_super_admin', 'schools', v_school_id::text,
          jsonb_build_object('name', p_name, 'slug', p_slug, 'initial_admin_profile_id', p_initial_admin_profile_id));

  return v_school_id;
end $$;

revoke all on function create_school_as_super_admin(text, text, text, uuid) from public, anon;
grant execute on function create_school_as_super_admin(text, text, text, uuid) to authenticated;

comment on function create_school_as_super_admin(text, text, text, uuid) is
  'The only way to create a school. Caller must be super_admin (checked from profiles.role in the database, never from client input). Target must be a pending profile with no school. Creates the school, its trial subscription, assigns the target as school_admin (school_members syncs automatically), and writes an audit_logs entry.';
