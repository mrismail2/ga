-- ============================================================
-- Kobciye Phase 1–4 — final membership/message/lesson-plan guards
--
-- Purely additive on top of 20260724000001. Nothing here drops a table,
-- drops a column, resets data, or deletes a user-created row; no
-- already-applied migration file is edited (every behavior change to an
-- existing function uses `create or replace function`; policies are
-- replaced under the SAME name via `drop policy if exists` + `create
-- policy`). Five defects from this pass's re-audit:
--
--   1. The conversation_members identity-immutability trigger (added
--      20260724000001) protected conversation_id/profile_id/joined_at but
--      not the row's own primary key `id` — nothing stopped a member from
--      UPDATE-ing their own row's `id` to a different value. Closed by
--      adding `id` to the immutable-field list.
--
--   2. The messages field-immutability trigger (added 20260724000001)
--      protected body/sender_id/recipient_id/school_id/conversation_id/
--      message_type/attachment_uri/created_at but not `id` or
--      `deleted_at` — a recipient could still rewrite either via the
--      "recipient marks read" UPDATE policy. Closed by adding both to the
--      immutable-field list (a separate, restricted delete mechanism can
--      be added later if soft-delete becomes a requirement — not
--      implemented here, since nothing in the current codebase reads or
--      writes `deleted_at` today).
--
--   3. The direct-message SELECT policy proved same-school access only
--      indirectly (via a sender/recipient profile join) and never checked
--      the message row's own `school_id` against the caller's school
--      directly — a correctness gap in defense-in-depth even though the
--      insert path and the field-immutability trigger already guarantee
--      school_id is accurate post-insert. Closed by adding an explicit
--      `school_id = my_school()` predicate.
--
--   4/5. The lesson_plans teacher guard only validated class/subject
--      assignment WHEN class_id or subject_id was supplied — a teacher
--      could still insert a fully classless/subjectless plan. Per this
--      pass's explicit, deliberate requirement (superseding the previous
--      pass's "draft may be classless" allowance for TEACHER-authored
--      plans specifically — School Admin's own broader "manage" policy is
--      untouched), a teacher-authored plan now REQUIRES both class_id and
--      subject_id, and they must form an EXACT existing
--      teacher_assignments pair (not two independently-matched columns).
-- ============================================================

-- ============================================================
-- 1. conversation_members — the row's own id joins the immutable set
-- ============================================================
create or replace function phase4_guard_conversation_member_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.conversation_id is distinct from old.conversation_id
       or new.profile_id is distinct from old.profile_id
       or new.joined_at is distinct from old.joined_at then
      raise exception 'membership identity is immutable — only last_read_at may be updated';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_conversation_member_identity() from public, anon, authenticated;
-- trigger binding is unchanged (already created by 20260724000001)

-- ============================================================
-- 2. messages — id and deleted_at join the immutable set
-- ============================================================
create or replace function phase4_guard_message_immutability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.body is distinct from old.body
       or new.sender_id is distinct from old.sender_id
       or new.recipient_id is distinct from old.recipient_id
       or new.school_id is distinct from old.school_id
       or new.conversation_id is distinct from old.conversation_id
       or new.message_type is distinct from old.message_type
       or new.attachment_uri is distinct from old.attachment_uri
       or new.deleted_at is distinct from old.deleted_at
       or new.created_at is distinct from old.created_at then
      raise exception 'only read_at may be updated on an existing message';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_message_immutability() from public, anon, authenticated;
-- trigger binding is unchanged (already created by 20260724000001)

-- ============================================================
-- 3. direct-message SELECT — explicit school_id = my_school(), not just
--    an inferred same-school join
-- ============================================================
drop policy if exists "read own direct messages" on messages;
create policy "read own direct messages" on messages for select
  using (
    conversation_id is null
    and school_id = my_school()
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and (recipient_id is null or exists (
      select 1 from profiles s join profiles r on s.school_id = r.school_id
      where s.id = sender_id and r.id = recipient_id))
  );

-- ============================================================
-- 4/5. lesson_plans — a teacher-authored plan requires BOTH class_id and
--    subject_id, matching one EXACT teacher_assignments pair. School
--    Admin's own "admins manage lesson_plans" policy is untouched (may
--    still create/manage classless/subjectless plans within their school,
--    per existing broader admin permissions).
-- ============================================================
create or replace function phase4_guard_lesson_plans()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  if new.subject_id is not null and not exists (
    select 1 from subjects su where su.id = new.subject_id and su.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if new.class_id is not null and not exists (
    select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;

  if new.teacher_profile_id is not null then
    select id into new.teacher_id from teachers
      where profile_id = new.teacher_profile_id and school_id = new.school_id;
    if new.teacher_id is null then
      raise exception 'teacher_profile_id does not correspond to a teacher in this school';
    end if;
  elsif new.teacher_id is not null and not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;

  -- computed inline (rather than via the shared is_admin_of() helper) so
  -- this guard's admin check never depends on a separate function's plan
  -- cache — it reads profiles directly, every call, inside this trigger.
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'super_admin' or (school_id = new.school_id and role = 'school_admin'))
  ) into v_is_admin;

  -- a non-admin (teacher) author MUST supply both class_id and subject_id,
  -- and they must form one EXACT active teacher_assignments pair — never
  -- an unassigned class, an unassigned subject, a mismatched pair, or a
  -- classless/subjectless plan.
  if not v_is_admin and new.teacher_id is not null then
    if new.class_id is null or new.subject_id is null then
      raise exception 'a teacher lesson plan requires both class_id and subject_id';
    end if;
    if not exists (
      select 1 from teacher_assignments ta
      where ta.teacher_id = new.teacher_id and ta.is_active
        and ta.class_id = new.class_id and ta.subject_id = new.subject_id) then
      raise exception 'class/subject is not assigned to this teacher';
    end if;
  end if;

  -- only school admins (or super_admin) may approve / reject
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and not v_is_admin then
    raise exception 'only a school admin may approve or reject a lesson plan';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_lesson_plans() from public, anon, authenticated;
-- trigger binding is unchanged (already created by 20260717000001)
