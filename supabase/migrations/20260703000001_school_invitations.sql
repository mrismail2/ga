-- ============================================================
-- Kobciye — Phase 3: secure school onboarding (invitations)
--
-- New, timestamped migration that sorts strictly AFTER every Phase 2
-- migration (…20260702000008). It does NOT touch, rename or rewrite any
-- earlier migration — it only adds:
--
--   • school_invitations       the invite record (pending/accepted/expired/cancelled)
--   • invitation_status enum
--   • my_email()               the caller's verified email (from auth.users, never client input)
--   • sa_create_school_and_invitation()   super_admin: create school + trial + invite (one txn)
--   • sa_attach_invitation_auth_user()    super_admin: record the Auth user id from a server result
--   • sa_resend_invitation()              super_admin: refresh expiry safely
--   • sa_cancel_invitation()              super_admin: cancel, block future acceptance
--   • accept_school_invitation()          invitee: the ONLY path that mints school_admin
--   • expire_stale_school_invitations()   maintenance: flip past-due pending -> expired
--
-- Design notes (why this shape):
--   - Every privileged decision is re-derived IN THE DATABASE from
--     auth.uid()/auth.users — never from anything the client (or even the
--     Edge Function) puts in a request body. The Edge Functions in
--     supabase/functions/ are thin: they verify the JWT, add email/Auth-admin
--     side effects and CORS, then call these functions, which re-check the
--     caller's real role. Defence in depth: a bug in an Edge Function still
--     cannot let a non-super_admin create a school or steal an invite.
--   - school_admin is assigned through the SAME sanctioned bypass flag that
--     migrations 0006–0008 established (kobciye.bypass_profile_guard), so the
--     profiles column-guard and school_members sync stay authoritative and
--     nothing about Phase 2's protections is weakened.
-- ============================================================

-- ---------- invitation status ----------
create type invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');

-- ---------- school_invitations ----------
create table school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  -- always stored lower-cased & trimmed by the RPCs below; a light format
  -- check is a backstop, not the primary validation (that lives in the RPCs)
  invitee_email text not null check (position('@' in invitee_email) > 1),
  invitee_name text not null default '',
  invitee_phone text,
  -- filled in ONLY from a secure server-side Supabase Auth result (the Edge
  -- Function passes back the id the Auth Admin API returned) — never from a
  -- client claiming "this is my user id".
  invitee_auth_user_id uuid references auth.users (id) on delete set null,
  -- Phase 3 only ever invites a school_admin; constrained so a bug/manual
  -- write cannot smuggle in a super_admin invite.
  intended_role user_role not null default 'school_admin' check (intended_role = 'school_admin'),
  status invitation_status not null default 'pending',
  invited_by uuid references profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table school_invitations is
  'Super-admin-issued invitations for a school''s first school_admin. Rows are created/resent/cancelled only by super_admin (via the sa_* RPCs / Edge Functions) and accepted only by the matching invited user (via accept_school_invitation()). No normal client can read or write this table.';
comment on column school_invitations.invitee_auth_user_id is
  'The invited person''s auth.users id — recorded only from a secure server-side Supabase Auth result, never trusted from client metadata.';
comment on column school_invitations.intended_role is
  'Always school_admin in Phase 3 (CHECK-constrained). The invited account gains this role ONLY after accept_school_invitation() succeeds — never merely from having a row here.';

-- ---------- indexes ----------
create index school_invitations_school on school_invitations (school_id);
create index school_invitations_email on school_invitations (lower(invitee_email));
create index school_invitations_auth_user on school_invitations (invitee_auth_user_id);
create index school_invitations_status on school_invitations (status);
create index school_invitations_expires_at on school_invitations (expires_at);

-- at most ONE active (pending) invitation per school + email. A resend
-- refreshes the same row; a second "Create & Invite" for the same pair is
-- rejected here (belt) and short-circuited in the RPC (braces) — that pair
-- is the idempotency key that stops a double-click creating duplicates.
create unique index school_invitations_one_pending
  on school_invitations (school_id, lower(invitee_email))
  where status = 'pending';

create trigger school_invitations_updated_at
  before update on school_invitations
  for each row execute function set_updated_at();

-- ============================================================
-- RLS: super_admin only. Everyone else — including the invitee and any
-- school_admin — has NO policy, so the table is completely invisible and
-- unwritable to them through PostgREST. Invitees never touch the table
-- directly; they go through accept_school_invitation() (SECURITY DEFINER).
-- ============================================================
alter table school_invitations enable row level security;

create policy "super_admin reads invitations" on school_invitations for select
  using (my_role() = 'super_admin');
create policy "super_admin writes invitations" on school_invitations for all
  using (my_role() = 'super_admin')
  with check (my_role() = 'super_admin');

-- ============================================================
-- Helper: the caller's verified email, read from auth.users by the function
-- OWNER (postgres) — the client cannot see or spoof this. Used by
-- accept_school_invitation() to prove "you are the person who was invited".
-- ============================================================
create or replace function my_email()
returns text language sql stable security definer set search_path = public, auth as $$
  select email from auth.users where id = auth.uid();
$$;
revoke all on function my_email() from public, anon;
grant execute on function my_email() to authenticated;
comment on function my_email() is
  'The authenticated caller''s email, read server-side from auth.users. Never trust a client-supplied email for identity checks — use this.';

-- ============================================================
-- sa_create_school_and_invitation
-- super_admin only. One transaction: create the school, its trial
-- subscription, and a pending invitation for the first school_admin. Audited.
-- Idempotent for a double-click: if the same slug already exists AND a pending
-- invitation already exists for the same email on it, the existing ids are
-- returned instead of creating duplicates.
-- ============================================================
create or replace function sa_create_school_and_invitation(
  p_name text,
  p_slug text,
  p_location text,
  p_email text,
  p_admin_name text,
  p_phone text,
  p_expires_in_days integer default 14
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
  v_school_id uuid;
  v_invitation_id uuid;
  v_existing_school uuid;
  v_existing_invite uuid;
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

  -- ---- idempotency: same slug + same pending invite email already exists ----
  select id into v_existing_school from schools where slug = v_slug;
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
        'idempotent', true
      );
    end if;
    -- slug taken by a different situation -> a real conflict
    raise exception 'a school with slug "%" already exists', v_slug;
  end if;

  -- ---- 1. create the school ----
  insert into schools (name, slug, location)
  values (v_name, v_slug, nullif(trim(coalesce(p_location, '')), ''))
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
          jsonb_build_object('name', v_name, 'slug', v_slug));
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school_id, auth.uid(), 'invitation.create', 'school_invitations', v_invitation_id::text,
          jsonb_build_object('invitee_email', v_email, 'intended_role', 'school_admin'));

  return jsonb_build_object(
    'school_id', v_school_id,
    'invitation_id', v_invitation_id,
    'invitee_email', v_email,
    'idempotent', false
  );
end $$;

revoke all on function sa_create_school_and_invitation(text, text, text, text, text, text, integer) from public, anon;
grant execute on function sa_create_school_and_invitation(text, text, text, text, text, text, integer) to authenticated;
comment on function sa_create_school_and_invitation(text, text, text, text, text, text, integer) is
  'super_admin-only. Creates a school + trial subscription + a pending school_admin invitation in one audited transaction. Idempotent on (slug,email) so a double-click cannot duplicate. Does NOT grant the invitee any role — that only happens on accept_school_invitation().';

-- ============================================================
-- sa_attach_invitation_auth_user
-- super_admin only. Records the invited person's auth.users id AFTER the Edge
-- Function has created/invited them through the Supabase Auth Admin API. The
-- id therefore always originates from a trusted server-side Auth result.
-- ============================================================
create or replace function sa_attach_invitation_auth_user(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_school uuid;
begin
  if auth.uid() is null then
    raise exception 'must be called by an authenticated user';
  end if;
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'only a super_admin may link an invitation to an auth user';
  end if;

  update school_invitations
     set invitee_auth_user_id = p_auth_user_id
   where id = p_invitation_id
     and status = 'pending'
   returning school_id into v_school;
  if v_school is null then
    raise exception 'invitation not found or not pending';
  end if;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school, auth.uid(), 'invitation.link_auth_user', 'school_invitations', p_invitation_id::text,
          jsonb_build_object('auth_user_id', p_auth_user_id));
end $$;

revoke all on function sa_attach_invitation_auth_user(uuid, uuid) from public, anon;
grant execute on function sa_attach_invitation_auth_user(uuid, uuid) to authenticated;
comment on function sa_attach_invitation_auth_user(uuid, uuid) is
  'super_admin-only. Stores the invited Auth user id (from a secure server-side Supabase Auth result) on a pending invitation. Audited.';

-- ============================================================
-- sa_resend_invitation
-- super_admin only. Refreshes expiry and re-arms a pending/expired invite.
-- Clearly refuses accepted/cancelled invites. Never creates a second row.
-- ============================================================
create or replace function sa_resend_invitation(
  p_invitation_id uuid,
  p_expires_in_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_status invitation_status;
  v_school uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'must be called by an authenticated user';
  end if;
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'only a super_admin may resend an invitation';
  end if;

  select status, school_id, invitee_email into v_status, v_school, v_email
    from school_invitations where id = p_invitation_id;
  if v_status is null then
    raise exception 'invitation not found';
  end if;
  if v_status = 'accepted' then
    raise exception 'invitation already accepted; nothing to resend';
  end if;
  if v_status = 'cancelled' then
    raise exception 'invitation was cancelled; create a new one instead';
  end if;

  -- pending or expired -> re-arm as pending with a fresh expiry
  update school_invitations
     set status = 'pending',
         expires_at = now() + make_interval(days => greatest(1, coalesce(p_expires_in_days, 14))),
         cancelled_at = null
   where id = p_invitation_id;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school, auth.uid(), 'invitation.resend', 'school_invitations', p_invitation_id::text,
          jsonb_build_object('invitee_email', v_email));

  return jsonb_build_object('invitation_id', p_invitation_id, 'invitee_email', v_email, 'status', 'pending');
end $$;

revoke all on function sa_resend_invitation(uuid, integer) from public, anon;
grant execute on function sa_resend_invitation(uuid, integer) to authenticated;
comment on function sa_resend_invitation(uuid, integer) is
  'super_admin-only. Refreshes a pending/expired invitation''s expiry (re-arms it as pending). Refuses accepted/cancelled invites. Never duplicates a school or invitation. Audited.';

-- ============================================================
-- sa_cancel_invitation
-- super_admin only. Sets status=cancelled so it can never be accepted.
-- ============================================================
create or replace function sa_cancel_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_status invitation_status;
  v_school uuid;
begin
  if auth.uid() is null then
    raise exception 'must be called by an authenticated user';
  end if;
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'only a super_admin may cancel an invitation';
  end if;

  select status, school_id into v_status, v_school
    from school_invitations where id = p_invitation_id;
  if v_status is null then
    raise exception 'invitation not found';
  end if;
  if v_status = 'accepted' then
    raise exception 'invitation already accepted; cannot cancel';
  end if;

  update school_invitations
     set status = 'cancelled', cancelled_at = now()
   where id = p_invitation_id;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school, auth.uid(), 'invitation.cancel', 'school_invitations', p_invitation_id::text, '{}'::jsonb);

  return jsonb_build_object('invitation_id', p_invitation_id, 'status', 'cancelled');
end $$;

revoke all on function sa_cancel_invitation(uuid) from public, anon;
grant execute on function sa_cancel_invitation(uuid) to authenticated;
comment on function sa_cancel_invitation(uuid) is
  'super_admin-only. Cancels a pending/expired invitation so it can never be accepted. Refuses to cancel an already-accepted invite. Audited.';

-- ============================================================
-- accept_school_invitation
-- The invitee calls this (via the accept-school-invite Edge Function or
-- directly). It is the ONLY path that turns an invited account into
-- school_admin. Everything is derived server-side:
--   • the caller is auth.uid() (from the JWT)
--   • the caller's email is my_email() (from auth.users) — must equal the invite
--   • the invite must be pending and not past expiry
-- p_invitation_id is optional: when null the pending invite is found by the
-- caller's email. When provided it is still re-verified against that email, so
-- a client cannot accept an invitation addressed to someone else.
-- ============================================================
create or replace function accept_school_invitation(p_invitation_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv record;
  v_profile record;
begin
  if v_uid is null then
    raise exception 'accept_school_invitation must be called by an authenticated user';
  end if;

  v_email := lower(my_email());
  if v_email is null then
    raise exception 'could not determine your account email';
  end if;

  -- locate the invitation: by id (re-checked against email) or by email
  if p_invitation_id is not null then
    select * into v_inv from school_invitations where id = p_invitation_id;
    if v_inv.id is null then
      raise exception 'invitation not found';
    end if;
    if lower(v_inv.invitee_email) is distinct from v_email then
      raise exception 'this invitation was issued to a different email address';
    end if;
  else
    select * into v_inv
      from school_invitations
     where lower(invitee_email) = v_email
       and status = 'pending'
     order by created_at desc
     limit 1;
    if v_inv.id is null then
      raise exception 'no pending invitation found for your account';
    end if;
  end if;

  -- state checks with distinct, safe messages
  if v_inv.status = 'accepted' then
    raise exception 'invitation already accepted';
  elsif v_inv.status = 'cancelled' then
    raise exception 'invitation was cancelled';
  elsif v_inv.status = 'expired' or v_inv.expires_at <= now() then
    -- flip a lazily-expired row so the state is consistent, then refuse
    update school_invitations set status = 'expired' where id = v_inv.id and status = 'pending';
    raise exception 'invitation has expired';
  elsif v_inv.status <> 'pending' then
    raise exception 'invitation is not acceptable';
  end if;

  -- protect existing accounts: only a still-pending profile with no school may
  -- be converted. An account that already belongs to a school is never
  -- silently re-homed or re-roled.
  select role, school_id into v_profile from profiles where id = v_uid;
  if v_profile.role is distinct from 'pending' or v_profile.school_id is not null then
    raise exception 'your account already belongs to a school and cannot accept this invitation';
  end if;

  -- assign school_admin through the SAME sanctioned bypass the Phase 2
  -- migrations established (the column guard + school_members sync stay in force)
  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles
     set role = 'school_admin', school_id = v_inv.school_id
   where id = v_uid;
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  -- mark accepted + record the real auth user id (from the JWT, server-side)
  update school_invitations
     set status = 'accepted', accepted_at = now(), invitee_auth_user_id = v_uid
   where id = v_inv.id;

  -- audit the acceptance AND the role assignment
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_inv.school_id, v_uid, 'invitation.accept', 'school_invitations', v_inv.id::text,
          jsonb_build_object('invitee_email', v_email));
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_inv.school_id, v_uid, 'profile.assign_role', 'profiles', v_uid::text,
          jsonb_build_object('role', 'school_admin', 'via', 'invitation'));

  return jsonb_build_object('school_id', v_inv.school_id, 'role', 'school_admin');
end $$;

revoke all on function accept_school_invitation(uuid) from public, anon;
grant execute on function accept_school_invitation(uuid) to authenticated;
comment on function accept_school_invitation(uuid) is
  'The only path that converts an invited account into school_admin. Caller is auth.uid(); their email (my_email()) must match the invite; the invite must be pending and unexpired; the profile must still be pending with no school. Assigns the role via the sanctioned bypass, marks the invite accepted, and audits both the acceptance and the role assignment.';

-- ============================================================
-- expire_stale_school_invitations
-- Maintenance: flip pending rows whose expiry has passed to 'expired'. Safe to
-- run from a scheduled job (service role, auth.uid() null) or by a super_admin.
-- Returns the number of rows expired.
-- ============================================================
create or replace function expire_stale_school_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role user_role;
  v_count integer;
begin
  -- allow a no-JWT (service/cron) session, or a super_admin
  if auth.uid() is not null then
    select role into v_caller_role from profiles where id = auth.uid();
    if v_caller_role is distinct from 'super_admin' then
      raise exception 'only a super_admin (or a service job) may expire invitations';
    end if;
  end if;

  with expired as (
    update school_invitations
       set status = 'expired'
     where status = 'pending' and expires_at <= now()
     returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end $$;

revoke all on function expire_stale_school_invitations() from public, anon;
grant execute on function expire_stale_school_invitations() to authenticated, service_role;
comment on function expire_stale_school_invitations() is
  'Flips past-due pending invitations to expired. Callable by a super_admin or a no-JWT service/cron session. Returns the count expired.';
