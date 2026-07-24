-- ============================================================
-- Kobciye Phase 1–4 — final privacy & lesson-plan security corrections
--
-- Purely additive on top of 20260723000002. Nothing here drops a table,
-- drops a column, resets data, or deletes a user-created row; no
-- already-applied migration file is edited (every behavior change to an
-- existing function uses `create or replace function`). Five defects from
-- this pass's re-audit:
--
--   1. conversation_members' self-update policy let a member change their
--      OWN row's conversation_id/joined_at freely (only profile_id was
--      implicitly pinned) — a member could UPDATE their own membership row
--      to point at a different same-school conversation instead of being
--      added to it via the creator/admin-only INSERT path. Closed with an
--      immutable-identity trigger: only last_read_at may ever change.
--
--   2. The legacy direct-message INSERT/SELECT policies never excluded
--      conversation rows (conversation_id is not null). In practice this
--      meant a message's own SENDER could keep reading a CONVERSATION
--      message forever via "read own direct messages" even after being
--      removed from conversation_members (recipient_id is null on a
--      conversation row, so the policy's own-message clause reduced to
--      "sender_id = auth.uid()" with no membership check at all). Closed by
--      scoping both policies to conversation_id is null explicitly.
--
--   3. The recipient "marks read" UPDATE policy had no WITH CHECK beyond
--      "still my row" — nothing stopped a recipient from rewriting body,
--      sender_id, school_id, conversation_id, message_type or
--      attachment_uri on an update. Closed with an immutable-fields
--      trigger: only read_at may change on an existing message, regardless
--      of which policy allowed the UPDATE.
--
--   4. lesson_plans policies used is_staff_of() (which also matches
--      accountant) and never verified the caller actually has a `teachers`
--      row — an accountant could set teacher_profile_id to their OWN
--      profile id and both create AND read a "teacher" lesson plan, and
--      the guard trigger silently left teacher_id unresolved rather than
--      rejecting a teacher_profile_id with no matching teachers row.
--      Closed: policies now require my_role() = 'teacher' + a real
--      same-school teachers row; the guard trigger rejects (does not
--      silently ignore) an unresolvable teacher_profile_id.
--
--   5. (client-side companion, no DB change needed) LessonPrepModal's Live
--      Mode zero-assignment case fell back to demo classes/free-text
--      subjects — see mobile/src/components/LessonPrepModal.js.
-- ============================================================

-- ============================================================
-- 1. conversation_members — identity fields become immutable
-- ============================================================
create or replace function phase4_guard_conversation_member_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.conversation_id is distinct from old.conversation_id
       or new.profile_id is distinct from old.profile_id
       or new.joined_at is distinct from old.joined_at then
      raise exception 'membership identity is immutable — only last_read_at may be updated';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_conversation_member_identity() from public, anon, authenticated;
create trigger conversation_members_identity_guard before update on conversation_members
  for each row execute function phase4_guard_conversation_member_identity();

-- ============================================================
-- 2. messages — direct-message policies apply ONLY to conversation_id IS
--    NULL rows; conversation messages stay governed exclusively by their
--    own membership-scoped policies.
-- ============================================================
drop policy if exists "send direct messages in school" on messages;
create policy "send direct messages in school" on messages for insert
  with check (
    conversation_id is null
    and sender_id = auth.uid() and school_id = my_school()
    and (recipient_id is null or exists (
      select 1 from profiles p where p.id = recipient_id and p.school_id = my_school()))
  );

drop policy if exists "read own direct messages" on messages;
create policy "read own direct messages" on messages for select
  using (
    conversation_id is null
    and (sender_id = auth.uid() or recipient_id = auth.uid())
    and (recipient_id is null or exists (
      select 1 from profiles s join profiles r on s.school_id = r.school_id
      where s.id = sender_id and r.id = recipient_id))
  );

-- recipient "mark read" also scoped to legacy direct messages only —
-- conversation-message read state lives on conversation_members.last_read_at
drop policy if exists "recipient marks read" on messages;
create policy "recipient marks read" on messages for update
  using (conversation_id is null and recipient_id = auth.uid());

-- ============================================================
-- 3. messages — every other field is immutable once written; only read_at
--    may ever change, regardless of which policy allowed the UPDATE.
-- ============================================================
create or replace function phase4_guard_message_immutability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.body is distinct from old.body
       or new.sender_id is distinct from old.sender_id
       or new.recipient_id is distinct from old.recipient_id
       or new.school_id is distinct from old.school_id
       or new.conversation_id is distinct from old.conversation_id
       or new.message_type is distinct from old.message_type
       or new.attachment_uri is distinct from old.attachment_uri
       or new.created_at is distinct from old.created_at then
      raise exception 'only read_at may be updated on an existing message';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_message_immutability() from public, anon, authenticated;
create trigger messages_immutability_guard before update on messages
  for each row execute function phase4_guard_message_immutability();

-- ============================================================
-- 4. lesson_plans — explicit teacher-role + real-teacher-row requirement
-- ============================================================
drop policy if exists "teachers read own lesson_plans" on lesson_plans;
create policy "teachers read own lesson_plans" on lesson_plans for select
  using (
    my_role() = 'teacher' and school_id = my_school() and teacher_profile_id = my_uid()
  );
-- "admins manage lesson_plans" (for all, is_admin_of) already covers the
-- School Admin "read/manage lesson plans in their own school" requirement
-- — unchanged.

drop policy if exists "teachers create own lesson_plans" on lesson_plans;
create policy "teachers create own lesson_plans" on lesson_plans for insert
  with check (
    my_role() = 'teacher' and school_id = my_school() and teacher_profile_id = my_uid()
    and exists (select 1 from teachers t where t.profile_id = my_uid() and t.school_id = school_id)
  );

drop policy if exists "teachers update own lesson_plans" on lesson_plans;
create policy "teachers update own lesson_plans" on lesson_plans for update
  using (my_role() = 'teacher' and school_id = my_school() and teacher_profile_id = my_uid())
  with check (
    my_role() = 'teacher' and school_id = my_school() and teacher_profile_id = my_uid()
    and exists (select 1 from teachers t where t.profile_id = my_uid() and t.school_id = school_id)
  );

-- the guard trigger now REJECTS (never silently drops) a teacher_profile_id
-- with no matching same-school teachers row, and the assignment check reads
-- the now-guaranteed-resolved teacher_id directly.
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

  v_is_admin := is_admin_of(new.school_id);

  -- a non-admin teacher may only use a class/subject THEY are actually
  -- assigned to (the SAME teacher_assignments row covers both, when both
  -- are supplied) — never an unassigned class or subject. A plan with
  -- neither set yet (still being drafted) is unaffected.
  if not v_is_admin and new.teacher_id is not null
     and (new.class_id is not null or new.subject_id is not null) then
    if not exists (
      select 1 from teacher_assignments ta
      where ta.teacher_id = new.teacher_id and ta.is_active
        and (new.class_id is null or ta.class_id = new.class_id)
        and (new.subject_id is null or ta.subject_id = new.subject_id)) then
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
