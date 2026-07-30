-- ============================================================
-- Kobciye — Phase 3 hardening (post independent review)
--
-- New, timestamped migration that sorts strictly AFTER
-- 20260703000001_school_invitations.sql. It does NOT modify any earlier
-- migration. Two production-critical fixes:
--
--  (3) school_invitations must be WRITE-ONLY-VIA-SERVER. The previous
--      "super_admin writes invitations" FOR ALL policy let a super_admin
--      client insert/update/delete invitation rows directly through PostgREST,
--      bypassing the Edge Functions / secure RPCs, the invite state machine,
--      and the audit log. We drop that policy. super_admin keeps READ access
--      (for the dashboard list). All writes now go exclusively through the
--      SECURITY DEFINER RPCs (which are owned by postgres and bypass RLS),
--      i.e. only through the four Edge Functions and accept flow.
--
--  (4) Invitation email delivery must be observable. We add an explicit
--      delivery-status column so a "school created but email NOT delivered"
--      state is visible to the super_admin (instead of falsely reporting
--      "invite sent"), plus a super_admin-only RPC the Edge Function calls to
--      record the real delivery outcome. Audited.
-- ============================================================

-- ============================================================
-- (3) Remove the direct client write path on school_invitations.
--     Keep read-only access for the dashboard listing.
-- ============================================================
drop policy if exists "super_admin writes invitations" on school_invitations;

-- (the read policy "super_admin reads invitations" from migration 0001 stays.)
comment on table school_invitations is
  'Super-admin-issued invitations for a school''s first school_admin. READ-ONLY through the client API (super_admin SELECT only). Every INSERT/UPDATE/DELETE happens exclusively through the SECURITY DEFINER RPCs (sa_create_school_and_invitation, sa_attach_invitation_auth_user, sa_resend_invitation, sa_cancel_invitation, sa_mark_invitation_delivery, accept_school_invitation) — i.e. only via the Edge Functions / accept flow. No client, super_admin included, may write this table directly.';

-- ============================================================
-- (4) Email delivery status.
-- ============================================================
alter table school_invitations
  add column email_delivery_status text not null default 'pending_delivery'
    check (email_delivery_status in ('pending_delivery', 'sent', 'failed')),
  add column email_last_error text;

comment on column school_invitations.email_delivery_status is
  'Real outcome of the invite/recovery email send, recorded server-side by the Edge Function via sa_mark_invitation_delivery(): pending_delivery (created, not yet sent) | sent (SMTP accepted it) | failed (send failed — super_admin must fix email settings and resend).';

create index school_invitations_delivery on school_invitations (email_delivery_status);

-- already-accepted rows (pre-existing) implicitly had a working email
update school_invitations set email_delivery_status = 'sent' where status = 'accepted';

-- super_admin-only RPC to record the delivery outcome. SECURITY DEFINER so it
-- can write the (client-unwritable) table; re-checks the caller is super_admin.
create or replace function sa_mark_invitation_delivery(
  p_invitation_id uuid,
  p_status text,
  p_error text default null
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
    raise exception 'only a super_admin may record invitation delivery';
  end if;
  if p_status not in ('pending_delivery', 'sent', 'failed') then
    raise exception 'invalid delivery status';
  end if;

  update school_invitations
     set email_delivery_status = p_status,
         email_last_error = case when p_status = 'failed' then left(coalesce(p_error, 'delivery failed'), 300) else null end
   where id = p_invitation_id
   returning school_id into v_school;
  if v_school is null then
    raise exception 'invitation not found';
  end if;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school, auth.uid(), 'invitation.delivery', 'school_invitations', p_invitation_id::text,
          jsonb_build_object('delivery_status', p_status));
end $$;

revoke all on function sa_mark_invitation_delivery(uuid, text, text) from public, anon;
grant execute on function sa_mark_invitation_delivery(uuid, text, text) to authenticated;
comment on function sa_mark_invitation_delivery(uuid, text, text) is
  'super_admin-only. Records the real email delivery outcome (pending_delivery|sent|failed) on an invitation. Audited. Called by the create/resend Edge Functions after the actual send attempt.';
