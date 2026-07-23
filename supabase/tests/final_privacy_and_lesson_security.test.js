#!/usr/bin/env node
/* ============================================================
   Kobciye — final privacy & lesson-plan security correction test suite

   Applies every migration (including 20260724000001) to a disposable
   real Postgres (pglite) and proves, with real SQL under the
   `authenticated` role:

   CONVERSATION-MEMBERSHIP IDENTITY IMMUTABILITY (required tests 1–6)
     1. A member can update their own last_read_at.
     2. A member cannot change conversation_id.
     3. A member cannot change profile_id.
     4. A member cannot change joined_at.
     5. A member cannot move their membership to another conversation.
     6. A non-member cannot create themselves as a member of a private
        conversation.

   DIRECT-MESSAGE / CONVERSATION-MESSAGE SEPARATION (required tests 1–9)
     1. Same-school direct messaging works.
     2. Cross-school direct messaging is blocked.
     3. Direct-message policies do not match conversation messages.
     4. A removed conversation member cannot read messages through
        sender_id.
     5. A recipient can update read_at.
     6. A recipient cannot modify body.
     7. A recipient cannot modify sender_id.
     8. A recipient cannot modify school_id.
     9. A recipient cannot convert a message between direct/conversation
        via conversation_id.

   LESSON-PLAN AUTHORIZATION (required tests 1–11)
     1. Teacher can create a lesson plan for an assigned class and subject.
     2. Teacher cannot create one for an unassigned class.
     3. Teacher cannot create one for an unassigned subject.
     4. Teacher cannot use another teacher_profile_id.
     5. Teacher can read their own plans.
     6. Teacher cannot read another teacher's plans.
     7. School Admin can read plans in their own school.
     8. Accountant cannot create or read teacher plans.
     9. Parent cannot access lesson plans.
     10. Student cannot access lesson plans.
     11. Cross-school lesson-plan access is blocked.

   Run:  cd supabase/tests && node final_privacy_and_lesson_security.test.js
   Exits non-zero if any assertion fails.
   ============================================================ */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => {
  console.log((cond ? 'PASS' : 'FAIL'), name);
  if (!cond) failures += 1;
};

(async () => {
  const db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public
      grant execute on functions to anon, authenticated, service_role;

    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('myapp.test_uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text,
      name text, owner uuid);
    alter table storage.objects enable row level security;
  `);

  const dir = path.join(__dirname, '..', 'migrations');
  for (const f of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8')
      .replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
  }
  console.log('applied all migrations\n');

  const asClient = async (uid) => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '${uid || ''}', false)`);
    await db.exec('set role authenticated');
  };
  const asService = async () => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '', false)`);
  };
  const throwsWith = async (fn, re) => {
    try { await fn(); return false; }
    catch (e) { return re ? re.test(String(e && e.message)) : true; }
  };
  const count = async (sql) => Number((await db.query(sql)).rows[0].n);

  // ============================================================
  // Seed: super admin, school A (admin a1, teachers t1/t1b, accountant
  // ac1, parent p1, student st1), school B (admin b1, teacher t2).
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk('1'), a1 = mk('2'), b1 = mk('3'), t1 = mk('4'), t2 = mk('5'),
    ac1 = mk('6'), pp1 = mk('7'), stu1 = mk('8'), t1b = mk('9');
  for (const [id, email] of [
    [superId, 'root@priv.test'], [a1, 'a@priv.test'], [b1, 'b@priv.test'],
    [t1, 't1@priv.test'], [t2, 't2@priv.test'], [ac1, 'ac1@priv.test'],
    [pp1, 'p1@priv.test'], [stu1, 'stu1@priv.test'], [t1b, 't1b@priv.test'],
  ]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('Priv School A', 'priv-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('Priv School B', 'priv-school-b', 'Hargeisa', '${b1}', 'school', 'secondary') as id`)).rows[0].id;

  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${t1b}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${ac1}', 'accountant', '${schoolA}')`);
  await db.exec(`select assign_role('${pp1}', 'parent', '${schoolA}')`);
  await db.exec(`select assign_role('${stu1}', 'student', '${schoolA}')`);
  const teacherRow1 = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1}', 'Teacher One') returning id`)).rows[0];
  await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1b}', 'Teacher One B') returning id`);
  const yearA = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`)).rows[0].id;
  const subjMath = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Xisaab') returning id`)).rows[0].id;
  const subjEnglish = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Ingiriisi') returning id`)).rows[0].id;
  const classA1 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 1', 'S1') returning id`)).rows[0].id;
  const classA2 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 2', 'S2') returning id`)).rows[0].id;
  await db.query(`insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id, is_active)
    values ('${schoolA}', '${teacherRow1.id}', '${subjMath}', '${classA1}', '${yearA}', true)`);

  await asClient(b1);
  await db.exec(`select assign_role('${t2}', 'teacher', '${schoolB}')`);

  // ============================================================
  console.log('=== Conversation-membership identity immutability ===');
  // ============================================================
  await asClient(a1);
  const conv1 = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  const conv2 = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv1}', '${a1}')`);
  const t1MemberRow = (await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv1}', '${t1}') returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv2}', '${a1}')`);

  await asClient(t1);
  // 1. A member can update their own last_read_at.
  let r = await db.query(`update conversation_members set last_read_at = now() where id = '${t1MemberRow}' returning last_read_at`);
  ok('1. a member can update their own last_read_at', r.rows.length === 1 && r.rows[0].last_read_at !== null);

  // 2. A member cannot change conversation_id.
  ok('2. a member cannot change conversation_id',
    await throwsWith(() => db.query(`update conversation_members set conversation_id = '${conv2}' where id = '${t1MemberRow}'`), /immutable/i));

  // 3. A member cannot change profile_id.
  ok('3. a member cannot change profile_id',
    await throwsWith(() => db.query(`update conversation_members set profile_id = '${a1}' where id = '${t1MemberRow}'`), /immutable/i));

  // 4. A member cannot change joined_at.
  ok('4. a member cannot change joined_at',
    await throwsWith(() => db.query(`update conversation_members set joined_at = now() - interval '10 days' where id = '${t1MemberRow}'`), /immutable/i));

  // 5. A member cannot move their membership to another conversation
  //    (same mechanism as #2, re-verified against a REAL other conversation
  //    they were never invited to).
  ok('5. a member cannot move their membership into another same-school conversation',
    await throwsWith(() => db.query(`update conversation_members set conversation_id = '${conv2}' where id = '${t1MemberRow}'`), /immutable/i));
  r = await db.query(`select conversation_id from conversation_members where id = '${t1MemberRow}'`);
  ok('5b. the membership row still points at the original conversation', r.rows[0].conversation_id === conv1);

  // 6. A non-member cannot create themselves as a member of a private conversation.
  await asClient(t1b); // same school, never invited, not the creator, not an admin
  ok('6. a non-member cannot insert themselves into a private conversation',
    await throwsWith(() => db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv1}', '${t1b}')`)));

  // ============================================================
  console.log('\n=== Direct-message / conversation-message separation ===');
  // ============================================================
  await asClient(a1);
  // 1. Same-school direct messaging works.
  r = await db.query(`insert into messages (school_id, sender_id, recipient_id, body)
    values ('${schoolA}', '${a1}', '${t1}', 'Salaan macalin') returning id`);
  ok('1. same-school direct messaging works', r.rows.length === 1);
  const directMsgId = r.rows[0].id;

  // 2. Cross-school direct messaging is blocked.
  ok('2. cross-school direct messaging is blocked',
    await throwsWith(() => db.query(`insert into messages (school_id, sender_id, recipient_id, body)
      values ('${schoolA}', '${a1}', '${t2}', 'gaal')`), /same school/i));

  // 3. Direct-message policies do not match conversation messages
  //    (verify the deployed policy text explicitly excludes them).
  r = await db.query(`select pg_get_expr(polqual, polrelid) as qual from pg_policy where polname = 'read own direct messages'`);
  ok('3. the direct-message SELECT policy explicitly requires conversation_id is null',
    /conversation_id IS NULL/i.test(r.rows[0].qual));
  r = await db.query(`select pg_get_expr(polwithcheck, polrelid) as chk from pg_policy where polname = 'send direct messages in school'`);
  ok('3b. the direct-message INSERT policy explicitly requires conversation_id is null',
    /conversation_id IS NULL/i.test(r.rows[0].chk));

  // set up a conversation message, then remove the sender from membership
  const conv3 = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv3}', '${a1}')`);
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv3}', '${t1}')`);
  await asClient(t1);
  const convMsg = (await db.query(`insert into messages (school_id, sender_id, conversation_id, body)
    values ('${schoolA}', '${t1}', '${conv3}', 'still a member here') returning id`)).rows[0].id;
  r = await db.query(`select id from messages where id = '${convMsg}'`);
  ok('4a. the sender can read their own conversation message while still a member', r.rows.length === 1);

  // now remove t1 from the conversation
  await asService();
  await db.query(`delete from conversation_members where conversation_id = '${conv3}' and profile_id = '${t1}'`);

  // 4. A removed conversation member cannot read messages through sender_id.
  await asClient(t1);
  r = await db.query(`select id from messages where id = '${convMsg}'`);
  ok('4. a removed conversation member cannot read the message through sender_id', r.rows.length === 0);

  // 5-9. Recipient update scope: only read_at may change on the direct message.
  await asClient(t1); // t1 is the recipient of directMsgId
  r = await db.query(`update messages set read_at = now() where id = '${directMsgId}' returning read_at`);
  ok('5. a recipient can update read_at', r.rows.length === 1 && r.rows[0].read_at !== null);

  ok('6. a recipient cannot modify body',
    await throwsWith(() => db.query(`update messages set body = 'tampered' where id = '${directMsgId}'`), /only read_at/i));

  ok('7. a recipient cannot modify sender_id',
    await throwsWith(() => db.query(`update messages set sender_id = '${t1}' where id = '${directMsgId}'`), /only read_at/i));

  // rejected by whichever guard fires first — the immutability trigger
  // ("only read_at") or the pre-existing sender/school consistency guard
  // ("message school must match the sender school"); either one closes it.
  ok('8. a recipient cannot modify school_id',
    await throwsWith(() => db.query(`update messages set school_id = '${schoolB}' where id = '${directMsgId}'`), /only read_at|message school/i));

  // 9. A recipient cannot convert a message between direct/conversation via conversation_id.
  ok('9. a recipient cannot attach a direct message to a conversation via conversation_id',
    await throwsWith(() => db.query(`update messages set conversation_id = '${conv1}' where id = '${directMsgId}'`), /only read_at/i));

  // ============================================================
  console.log('\n=== Lesson-plan authorization ===');
  // ============================================================
  // 1. Teacher can create a lesson plan for an assigned class and subject.
  await asClient(t1);
  r = await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id, subject_id)
    values ('${schoolA}', '${t1}', 'Teacher One', 'Xisaab 1', '${classA1}', '${subjMath}') returning id`);
  ok('1. teacher creates a lesson plan for an assigned class+subject', r.rows.length === 1);
  const assignedPlanId = r.rows[0].id;

  // 2. Teacher cannot create one for an unassigned class.
  ok('2. teacher cannot create a lesson plan for an UNassigned class',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id, subject_id)
      values ('${schoolA}', '${t1}', 'Teacher One', 'Xisaab 2', '${classA2}', '${subjMath}')`), /not assigned/i));

  // 3. Teacher cannot create one for an unassigned subject.
  ok('3. teacher cannot create a lesson plan for an UNassigned subject',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id, subject_id)
      values ('${schoolA}', '${t1}', 'Teacher One', 'Ingiriisi 1', '${classA1}', '${subjEnglish}')`), /not assigned/i));

  // 4. Teacher cannot use another teacher_profile_id.
  ok('4. teacher cannot plant a lesson plan under another teacher_profile_id',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id, subject_id)
      values ('${schoolA}', '${t1b}', 'Teacher One B', 'Forged', '${classA1}', '${subjMath}')`)));

  // 5. Teacher can read their own plans.
  r = await db.query(`select id from lesson_plans where id = '${assignedPlanId}'`);
  ok('5. teacher reads their own lesson plan', r.rows.length === 1);

  // 6. Teacher cannot read another teacher's plans.
  await asClient(t1b);
  const otherTeacherPlan = (await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
    values ('${schoolA}', '${t1b}', 'Teacher One B', 'Cashar kale') returning id`)).rows[0].id;
  await asClient(t1);
  r = await db.query(`select id from lesson_plans where id = '${otherTeacherPlan}'`);
  ok('6. teacher cannot read ANOTHER teacher\'s lesson plan', r.rows.length === 0);

  // 7. School Admin can read plans in their own school.
  await asClient(a1);
  r = await db.query(`select id from lesson_plans where school_id = '${schoolA}'`);
  ok('7. school admin reads every lesson plan in their own school', r.rows.length === 2);

  // 8. Accountant cannot create or read teacher plans (the closed hole:
  //    setting teacher_profile_id to their OWN id used to slip through
  //    is_staff_of()).
  await asClient(ac1);
  ok('8. accountant cannot create a lesson plan for themselves',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
      values ('${schoolA}', '${ac1}', 'Accountant', 'Fake plan')`)));
  ok('8b. accountant reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);

  // 9. Parent cannot access lesson plans.
  await asClient(pp1);
  ok('9. parent reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);
  ok('9b. parent cannot create a lesson plan',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
      values ('${schoolA}', '${pp1}', 'Parent', 'Fake plan')`)));

  // 10. Student cannot access lesson plans.
  await asClient(stu1);
  ok('10. student reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);
  ok('10b. student cannot create a lesson plan',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
      values ('${schoolA}', '${stu1}', 'Student', 'Fake plan')`)));

  // 11. Cross-school lesson-plan access is blocked.
  await asClient(t2);
  ok('11. a teacher in another school reads ZERO of school A\'s lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);
  await asClient(b1);
  ok('11b. an admin of another school reads ZERO of school A\'s lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);

  console.log('');
  if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
  console.log('final_privacy_and_lesson_security: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
