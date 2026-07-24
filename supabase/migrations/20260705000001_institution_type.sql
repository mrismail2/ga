-- ============================================================
-- Kobciye — Phase 3 foundation: School Mode vs University Mode
--
-- New, timestamped migration that sorts strictly AFTER every earlier
-- migration (…20260703000002). It does NOT touch, rename or rewrite any
-- earlier migration file. It only adds:
--
--   • schools.institution_type   'school' | 'university' | null (PRE-EXISTING
--                                 legacy rows only — see hardening pass below)
--   • schools.school_stage       'primary_middle' | 'secondary' | null (same)
--   • DB-level CHECK constraints enforcing the pairing rule
--   • a guard trigger so institution_type/school_stage can never be changed
--     via a normal UPDATE (by anyone — school_admin or super_admin) once set;
--     for this phase, changing institution/stage after creation is not
--     offered anywhere in the app (see PHASE_3_COMPLETION_REPORT.md — real
--     conversion needs its own safe data-migration tool, future work)
--   • a guard trigger so no NEW row (INSERT) may ever be unclassified — see
--     "data-integrity hardening" section below. Only rows that predate this
--     migration may have a null institution_type; that never changes once
--     this migration has run.
--   • sa_create_school_and_invitation() REQUIRES institution_type and (for
--     'school') school_stage — no defaults, no omitting them. The active
--     create-school-and-invite-admin Edge Function always supplies both.
--   • create_school_as_super_admin() (the older, otherwise-unused Phase 2
--     super_admin path) is upgraded the same way — required + validated,
--     not silently defaulted — so it cannot become a second unclassified-
--     creation loophole either.
--
-- Design notes:
--   - institution_type/school_stage are plain `text` + CHECK, not enums —
--     deliberately, so a future stage/type can be added later with a simple
--     constraint change instead of an ALTER TYPE ceremony.
--   - Existing schools are never guessed or silently reclassified: the ALTER
--     TABLE below adds nullable columns with no backfill, so every
--     pre-existing row simply stays "unclassified" (institution_type IS
--     NULL) until a super_admin explicitly classifies it through a future,
--     dedicated (and audited) tool — not built in this phase. A plain
--     column-level NOT NULL is deliberately NOT used for this reason: it
--     would fail the migration itself the instant it ran against a database
--     that already has unclassified rows (e.g. the seed/demo schools). The
--     BEFORE INSERT guard trigger below is what actually enforces "no NEW
--     school may be unclassified", precisely because — unlike a CHECK
--     constraint — a trigger can see TG_OP and treat INSERT differently from
--     UPDATE.
--
-- DATA-INTEGRITY HARDENING (same migration, added in the same development
-- pass before this ever reached a real Supabase project — see
-- PHASE_3_COMPLETION_REPORT.md for the determination that this migration
-- had not yet been applied anywhere, so it is amended here rather than
-- superseded by a separate corrective migration): closes three loopholes
-- that could otherwise still create a NEW unclassified school —
-- (1) a direct INSERT into schools (permitted by the pre-existing
-- "super_admin manages schools" RLS policy), (2) calling
-- sa_create_school_and_invitation() while omitting institution_type/
-- school_stage, and (3) calling the legacy create_school_as_super_admin()
-- without a classification. All three now fail — see the tests in
-- supabase/tests/institution_type.test.js.
-- ============================================================

-- ---------- 1. columns ----------
alter table schools
  add column institution_type text,
  add column school_stage text;

comment on column schools.institution_type is
  'School Mode vs University Mode. NULL means unclassified (legacy school, predates this feature). Set once, at creation, by sa_create_school_and_invitation(); frozen thereafter by the guard trigger below — no in-app conversion in this phase.';
comment on column schools.school_stage is
  'Only meaningful when institution_type = ''school'': ''primary_middle'' or ''secondary''. Always NULL for institution_type = ''university'' and for unclassified (NULL institution_type) schools.';

-- ---------- 2. validation (DB-level, defense in depth alongside the RPC) ----------
alter table schools
  add constraint schools_institution_type_valid
    check (institution_type is null or institution_type in ('school', 'university'));

alter table schools
  add constraint schools_school_stage_valid
    check (school_stage is null or school_stage in ('primary_middle', 'secondary'));

-- the pairing rule itself: school requires a stage; university forbids one;
-- unclassified (null institution_type) is left alone (existing rows, or a
-- school created by a caller that didn't pass these fields at all).
alter table schools
  add constraint schools_institution_school_stage_pairing
    check (
      institution_type is null
      or (institution_type = 'school' and school_stage in ('primary_middle', 'secondary'))
      or (institution_type = 'university' and school_stage is null)
    );

-- ---------- 3. freeze after creation: no UPDATE may change these columns ----------
-- Column-level guard RLS cannot express (RLS controls rows, not columns) —
-- same pattern as guard_profile_privileged_fields() in migration 0006. No
-- bypass flag exists for this one: real institution/stage conversion after a
-- school has real academic data is NOT safe to do as a bare column flip, so
-- for this phase it is simply not possible via any client, school_admin or
-- super_admin. A future phase can add a dedicated, audited migration RPC and
-- a sanctioned bypass here if/when that safe-conversion tool is built.
create or replace function guard_school_institution_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_type is distinct from old.institution_type
     or new.school_stage is distinct from old.school_stage then
    raise exception 'institution_type/school_stage cannot be changed once set — this requires a dedicated, safe data-migration tool (not available yet)';
  end if;
  return new;
end $$;

revoke all on function guard_school_institution_fields() from public, anon, authenticated;

create trigger schools_guard_institution_fields
  before update on schools
  for each row execute function guard_school_institution_fields();

comment on function guard_school_institution_fields() is
  'Blocks any UPDATE from changing institution_type/school_stage, for every role including super_admin. Values are set exactly once, at creation, by sa_create_school_and_invitation(). No bypass exists yet — see migration comments.';

-- ---------- 4. no NEW row may ever be unclassified ----------
-- Closes loophole (1): a super_admin's own RLS policy ("super_admin manages
-- schools" FOR ALL) permits a direct INSERT into schools, completely
-- bypassing sa_create_school_and_invitation()/create_school_as_super_admin()
-- and any validation they perform. A CHECK constraint cannot express "reject
-- this on INSERT but allow it to persist via UPDATE on legacy rows" (it has
-- no notion of TG_OP), so this MUST be a trigger, fired BEFORE INSERT only —
-- never BEFORE UPDATE, so a legacy pre-migration row that already has a null
-- institution_type is never forced to change (it is separately frozen by
-- guard_school_institution_fields above, which blocks it from changing at
-- all, in either direction).
create or replace function guard_new_schools_require_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_type is null then
    raise exception 'institution_type is required for every newly created school (a school created before this migration may remain unclassified, but no new one may)';
  end if;
  if new.institution_type not in ('school', 'university') then
    raise exception 'invalid institution_type: must be "school" or "university"';
  end if;
  if new.institution_type = 'school' and (new.school_stage is null or new.school_stage not in ('primary_middle', 'secondary')) then
    raise exception 'invalid school_stage: a new school must have school_stage "primary_middle" or "secondary"';
  end if;
  if new.institution_type = 'university' and new.school_stage is not null then
    raise exception 'invalid school_stage: a new university must not set school_stage';
  end if;
  return new;
end $$;

revoke all on function guard_new_schools_require_classification() from public, anon, authenticated;

create trigger schools_require_classification_on_insert
  before insert on schools
  for each row execute function guard_new_schools_require_classification();

comment on function guard_new_schools_require_classification() is
  'Rejects any INSERT into schools with a null/invalid institution_type or an inconsistent school_stage pairing — for EVERY insert path (direct client INSERT, sa_create_school_and_invitation, create_school_as_super_admin, or any future one), regardless of caller. Never fires on UPDATE, so pre-existing unclassified rows are untouched.';

-- ============================================================
-- 5. sa_create_school_and_invitation — institution_type/school_stage are now
--    REQUIRED (no defaults). Postgres treats a changed parameter COUNT as a
--    genuinely different function even under CREATE OR REPLACE (it does not
--    retroactively "add defaults" to the existing overload) — left alone,
--    the old 7-arg version and this new 9-arg version would coexist as two
--    ambiguous overloads, breaking every existing 7-arg caller with a
--    "not unique" error. So the old signature is dropped explicitly first;
--    this still does not touch the FILE that originally defined it (migration
--    0001) — only the live database definition, exactly like every other
--    create-or-replace evolution already used in migrations 0006/0007/0008
--    (assign_role, guard_profile_privileged_fields), just with the one extra
--    explicit drop that a parameter-count change requires.
-- ============================================================
drop function if exists sa_create_school_and_invitation(text, text, text, text, text, text, integer);

-- p_expires_in_days no longer has a default either: Postgres requires every
-- parameter AFTER the first defaulted one to also have a default, and
-- p_institution_type/p_school_stage must now be mandatory. This does not
-- affect any real caller — every existing call site (the Edge Function and
-- every SQL test) already passes it explicitly.
create or replace function sa_create_school_and_invitation(
  p_name text,
  p_slug text,
  p_location text,
  p_email text,
  p_admin_name text,
  p_phone text,
  p_expires_in_days integer,
  p_institution_type text,
  p_school_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_email text := lower(trim(p_email));
  v_slug text := lower(trim(p_slug));
  v_name text := trim(p_name);
  v_institution_type text := nullif(trim(coalesce(p_institution_type, '')), '');
  v_school_stage text := nullif(trim(coalesce(p_school_stage, '')), '');
  v_school_id uuid;
  v_invitation_id uuid;
  v_existing_school uuid;
  v_existing_invite uuid;
  v_existing_institution_type text;
  v_existing_school_stage text;
begin
  if auth.uid() is null then
    raise exception 'sa_create_school_and_invitation must be called by an authenticated user';
  end if;

  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'only a super_admin may create a school';
  end if;

  -- ---- validation (server-side; the app validates too, but this is the gate) ----
  if v_name is null or length(v_name) < 2 then
    raise exception 'invalid school name';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid slug: use lowercase letters, numbers and hyphens only';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email address';
  end if;
  -- phone optional; if present require a plausible shape
  if p_phone is not null and trim(p_phone) <> '' and trim(p_phone) !~ '^\+?[0-9 ()-]{6,20}$' then
    raise exception 'invalid phone number';
  end if;

  -- ---- institution_type / school_stage validation (REQUIRED — hardening) ----
  -- No longer optional: every NEW school must be classified. Omitting these
  -- (or passing an invalid combination) is rejected here — and, as a second,
  -- independent layer, by the schools_require_classification_on_insert
  -- trigger on the INSERT below, which also covers any caller that reaches
  -- the INSERT by some other means.
  if v_institution_type is null then
    raise exception 'institution_type is required (must be "school" or "university")';
  end if;
  if v_institution_type not in ('school', 'university') then
    raise exception 'invalid institution_type: must be "school" or "university"';
  end if;
  if v_institution_type = 'school' and (v_school_stage is null or v_school_stage not in ('primary_middle', 'secondary')) then
    raise exception 'invalid school_stage: a school must have school_stage "primary_middle" or "secondary"';
  end if;
  if v_institution_type = 'university' and v_school_stage is not null then
    raise exception 'invalid school_stage: a university must not set school_stage';
  end if;

  -- ---- idempotency: same slug + same pending invite email already exists ----
  select id, institution_type, school_stage
    into v_existing_school, v_existing_institution_type, v_existing_school_stage
    from schools where slug = v_slug;
  if v_existing_school is not null then
    select id into v_existing_invite
      from school_invitations
     where school_id = v_existing_school
       and lower(invitee_email) = v_email
       and status = 'pending';
    if v_existing_invite is not null then
      return jsonb_build_object(
        'school_id', v_existing_school,
        'invitation_id', v_existing_invite,
        'invitee_email', v_email,
        'institution_type', v_existing_institution_type,
        'school_stage', v_existing_school_stage,
        'idempotent', true
      );
    end if;
    -- slug taken by a different situation -> a real conflict
    raise exception 'a school with slug "%" already exists', v_slug;
  end if;

  -- ---- 1. create the school ----
  insert into schools (name, slug, location, institution_type, school_stage)
  values (v_name, v_slug, nullif(trim(coalesce(p_location, '')), ''), v_institution_type, v_school_stage)
  returning id into v_school_id;

  -- ---- 2. its initial trial subscription ----
  insert into subscriptions (school_id, plan, status, trial_ends_at, current_period_end)
  values (v_school_id, 'small', 'trialing', now() + interval '30 days', now() + interval '30 days');

  -- ---- 3. the pending invitation ----
  insert into school_invitations (school_id, invitee_email, invitee_name, invitee_phone,
                                  intended_role, status, invited_by, expires_at)
  values (v_school_id, v_email, trim(coalesce(p_admin_name, '')), nullif(trim(coalesce(p_phone, '')), ''),
          'school_admin', 'pending', auth.uid(),
          now() + make_interval(days => greatest(1, coalesce(p_expires_in_days, 14))))
  returning id into v_invitation_id;

  -- ---- 4. audit both actions ----
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school_id, auth.uid(), 'school.create', 'schools', v_school_id::text,
          jsonb_build_object('name', v_name, 'slug', v_slug, 'institution_type', v_institution_type, 'school_stage', v_school_stage));
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school_id, auth.uid(), 'invitation.create', 'school_invitations', v_invitation_id::text,
          jsonb_build_object('invitee_email', v_email, 'intended_role', 'school_admin'));

  return jsonb_build_object(
    'school_id', v_school_id,
    'invitation_id', v_invitation_id,
    'invitee_email', v_email,
    'institution_type', v_institution_type,
    'school_stage', v_school_stage,
    'idempotent', false
  );
end $$;

revoke all on function sa_create_school_and_invitation(text, text, text, text, text, text, integer, text, text) from public, anon;
grant execute on function sa_create_school_and_invitation(text, text, text, text, text, text, integer, text, text) to authenticated;

comment on function sa_create_school_and_invitation(text, text, text, text, text, text, integer, text, text) is
  'super_admin-only. Creates a school + trial subscription + a pending school_admin invitation in one audited transaction. Idempotent on (slug,email) so a double-click cannot duplicate. institution_type and (for a school) school_stage are REQUIRED and validated strictly — omitting them fails, so no NEW school can be created unclassified. Does NOT grant the invitee any role — that only happens on accept_school_invitation().';

-- ============================================================
-- 6. create_school_as_super_admin — closes loophole (3). This is the OLDER,
--    Phase-2-era super_admin creation path (predates the invitation system;
--    it takes an ALREADY-pending profile id directly rather than inviting
--    one by email). It has no caller anywhere in the live app — the active
--    onboarding flow is exclusively sa_create_school_and_invitation() via
--    the create-school-and-invite-admin Edge Function — but it is still
--    reachable by any authenticated super_admin client (EXECUTE is granted
--    to `authenticated`), so it must not be able to create an unclassified
--    school either.
--
--    Same parameter-count-change rule as section 5 applies: the old 4-arg
--    signature must be dropped explicitly before the new 6-arg one is
--    defined, or the two would coexist as ambiguous overloads.
--
--    Unlike sa_create_school_and_invitation, institution_type/school_stage
--    ARE required here too (no defaults) — deliberately: a caller that omits
--    them must fail, not silently receive a default classification (see
--    supabase/tests/institution_type.test.js, "legacy create_school_as_super_admin
--    call without classification fails"). Nothing in the live app calls this
--    function without them already (nothing calls it at all), so this is a
--    zero-blast-radius tightening in practice; the mobile
--    services/supabase.js wrapper (createSchoolAsSuperAdmin, itself unused
--    by any screen) is updated in the same pass to always pass them.
-- ============================================================
drop function if exists create_school_as_super_admin(text, text, text, uuid);

create or replace function create_school_as_super_admin(
  p_name text,
  p_slug text,
  p_location text,
  p_initial_admin_profile_id uuid,
  p_institution_type text,
  p_school_stage text
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
  v_institution_type text := nullif(trim(coalesce(p_institution_type, '')), '');
  v_school_stage text := nullif(trim(coalesce(p_school_stage, '')), '');
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

  -- ---- institution_type / school_stage validation (REQUIRED — hardening) ----
  if v_institution_type is null then
    raise exception 'institution_type is required (must be "school" or "university")';
  end if;
  if v_institution_type not in ('school', 'university') then
    raise exception 'invalid institution_type: must be "school" or "university"';
  end if;
  if v_institution_type = 'school' and (v_school_stage is null or v_school_stage not in ('primary_middle', 'secondary')) then
    raise exception 'invalid school_stage: a school must have school_stage "primary_middle" or "secondary"';
  end if;
  if v_institution_type = 'university' and v_school_stage is not null then
    raise exception 'invalid school_stage: a university must not set school_stage';
  end if;

  -- 1. create the school
  insert into schools (name, slug, location, institution_type, school_stage)
  values (p_name, p_slug, p_location, v_institution_type, v_school_stage)
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
          jsonb_build_object('name', p_name, 'slug', p_slug, 'initial_admin_profile_id', p_initial_admin_profile_id, 'institution_type', v_institution_type, 'school_stage', v_school_stage));

  return v_school_id;
end $$;

revoke all on function create_school_as_super_admin(text, text, text, uuid, text, text) from public, anon;
grant execute on function create_school_as_super_admin(text, text, text, uuid, text, text) to authenticated;

comment on function create_school_as_super_admin(text, text, text, uuid, text, text) is
  'Legacy (pre-invitation-system) super_admin school-creation path — the live app uses sa_create_school_and_invitation()/the create-school-and-invite-admin Edge Function instead. Caller must be super_admin; target must be a pending profile with no school. institution_type and (for a school) school_stage are REQUIRED and validated strictly, same as sa_create_school_and_invitation() — omitting them fails, so this cannot become a second unclassified-creation loophole.';
