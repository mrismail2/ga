-- ============================================================
-- Kobciye Phase 1–4 — final security corrections
--
-- Purely additive on top of 20260723000001. Nothing here drops a table,
-- drops a column, resets data, or deletes a user-created row. Two defects
-- from the final independent audit:
--
--   1. Direct messages (the legacy conversation_id-less path on `messages`)
--      verified the sender and the message's own school_id, but never
--      verified the RECIPIENT's school — a user in School A who knew a
--      School B profile's uuid could address a message to it. Closed at
--      both RLS (insert/select) and the existing message guard trigger
--      (defense in depth, matching the pattern already used for
--      conversation messages).
--
--   2. lesson_plans read access was "any staff member of the school" (so
--      a teacher could read every other teacher's plans, and accountant
--      could read them too), and create/update only checked ownership —
--      never that the class/subject was actually assigned to that
--      teacher. Narrowed read to admin-full-school OR own-plans-only;
--      create/update now also requires the class+subject (when supplied)
--      to match one of the teacher's own teacher_assignments rows. School
--      Admin is exempt (manages broadly, as before).
-- ============================================================

-- ============================================================
-- 1. Direct messages — recipient must be in the sender's own school
-- ============================================================

-- extend the existing message guard: the conversation branch is
-- unchanged; the legacy direct-message branch (conversation_id is null)
-- now verifies the sender resolves to a real profile whose school_id
-- matches new.school_id, and — when a recipient is given — that the
-- recipient resolves to a real profile in the SAME school.
create or replace function phase4_guard_conversation_messages()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_sender_school uuid;
  v_recipient_school uuid;
begin
  if new.conversation_id is not null then
    select school_id into v_school from conversations where id = new.conversation_id;
    if v_school is null then
      raise exception 'conversation not found';
    end if;
    if new.school_id is distinct from v_school then
      raise exception 'message school must match the conversation school';
    end if;
    if not exists (
      select 1 from conversation_members m
      where m.conversation_id = new.conversation_id and m.profile_id = new.sender_id) then
      raise exception 'sender is not a member of this conversation';
    end if;
    return new;
  end if;

  -- legacy direct-message path
  select school_id into v_sender_school from profiles where id = new.sender_id;
  if v_sender_school is null then
    raise exception 'sender profile not found';
  end if;
  if new.school_id is distinct from v_sender_school then
    raise exception 'message school must match the sender school';
  end if;
  if new.recipient_id is not null then
    select school_id into v_recipient_school from profiles where id = new.recipient_id;
    if v_recipient_school is null then
      raise exception 'recipient profile not found';
    end if;
    if v_recipient_school is distinct from v_sender_school then
      raise exception 'recipient must belong to the same school as the sender';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase4_guard_conversation_messages() from public, anon, authenticated;
-- trigger binding is unchanged (already created by 20260717000001)

-- RLS: insert requires a same-school recipient (when one is given); the
-- conversation-message insert path keeps its own separate, unaffected
-- policy ("members send conversation messages").
drop policy if exists "send messages in school" on messages;
create policy "send direct messages in school" on messages for insert
  with check (
    sender_id = auth.uid() and school_id = my_school()
    and (recipient_id is null or exists (
      select 1 from profiles p where p.id = recipient_id and p.school_id = my_school()))
  );

-- RLS: read requires the OTHER party (whichever one isn't me) to be in the
-- caller's own school — holds even for a hypothetical stale/pre-existing
-- mismatched row, not just newly-inserted ones.
drop policy if exists "read own messages" on messages;
create policy "read own direct messages" on messages for select
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and (recipient_id is null or exists (
      select 1 from profiles s join profiles r on s.school_id = r.school_id
      where s.id = sender_id and r.id = recipient_id))
  );

-- ============================================================
-- 2. lesson_plans — read scoped to own plans; create/update scoped to
--    the teacher's own assignments
-- ============================================================

drop policy if exists "staff read lesson_plans" on lesson_plans;
create policy "teachers read own lesson_plans" on lesson_plans for select
  using (teacher_profile_id = my_uid());
-- "admins manage lesson_plans" (for all, is_admin_of) already covers the
-- School Admin "read/manage lesson plans belonging to their own school"
-- requirement — unchanged.

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
  if new.teacher_id is not null and not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if new.teacher_id is null and new.teacher_profile_id is not null then
    select id into new.teacher_id from teachers
      where profile_id = new.teacher_profile_id and school_id = new.school_id;
  end if;

  v_is_admin := is_admin_of(new.school_id);

  -- a non-admin teacher may only use a class/subject THEY are actually
  -- assigned to (the SAME teacher_assignments row covers both, when both
  -- are supplied) — never an unassigned class or subject. A plan with
  -- neither set yet (still being drafted) is unaffected.
  if not v_is_admin and new.teacher_profile_id is not null
     and (new.class_id is not null or new.subject_id is not null) then
    if not exists (
      select 1 from teacher_assignments ta
      join teachers t on t.id = ta.teacher_id
      where t.profile_id = new.teacher_profile_id and ta.is_active
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

-- index for the new assignment-matching lookup inside the trigger and RLS
create index if not exists teacher_assignments_teacher_class_subject
  on teacher_assignments (teacher_id, class_id, subject_id);
