#!/usr/bin/env node
/* ============================================================
   Kobciye — final membership/message/lesson-plan guards test suite

   Applies every migration (including 20260724000002) to a disposable
   real Postgres (pglite) and proves, with real SQL under the
   `authenticated` role, the NEW adversarial requirements from this
   pass's re-audit that are not already covered by
   final_privacy_and_lesson_security.test.js:

   CONVERSATION-MEMBERSHIP IDENTITY (required tests 2, 8 — the rest are
   covered in final_privacy_and_lesson_security.test.js)
     2. A member cannot change id.
     8. A user cannot update another member's row.

   MESSAGE RECIPIENT UPDATES (required tests 2, 5, 8, 9, 10 — the rest are
   covered in final_privacy_and_lesson_security.test.js)
     2. Recipient cannot change id.
     5. Recipient cannot change recipient_id.
     8. Recipient cannot change deleted_at.
     9. Recipient cannot convert a conversation message into a direct
        message (there is no update path into a conversation message at
        all, since recipient_id is null on one — verified explicitly).
     10. Recipient cannot convert a direct message into a conversation
         message (re-verified against the immutability trigger).

   DIRECT-MESSAGE SCHOOL ISOLATION (explicit school_id = my_school())
     - the deployed SELECT policy text is confirmed to require it.

   LESSON-PLAN NON-NULL CLASS/SUBJECT (required tests 2, 3 — the rest are
   covered across final_security_corrections.test.js and
   final_privacy_and_lesson_security.test.js)
     2. Teacher cannot create one with class_id NULL (subject_id given).
     3. Teacher cannot create one with subject_id NULL (class_id given).

   Run:  cd supabase/tests && node final_membership_message_lesson_guards.test.js
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

  // ============================================================
  // Seed: super admin, school A (admin a1, teacher t1 assigned to
  // classA1+subjMath), school B (admin b1).
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk('1'), a1 = mk('2'), b1 = mk('3'), t1 = mk('4'), t2 = mk('5');
  for (const [id, email] of [
    [superId, 'root@gd.test'], [a1, 'a@gd.test'], [b1, 'b@gd.test'],
    [t1, 't1@gd.test'], [t2, 't2@gd.test'],
  ]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('Guard School A', 'guard-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;

  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${t2}', 'teacher', '${schoolA}')`);
  const teacherRow1 = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1}', 'Teacher One') returning id`)).rows[0];
  const yearA = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`)).rows[0].id;
  const subjMath = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Xisaab') returning id`)).rows[0].id;
  const classA1 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 1', 'S1') returning id`)).rows[0].id;
  await db.query(`insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id, is_active)
    values ('${schoolA}', '${teacherRow1.id}', '${subjMath}', '${classA1}', '${yearA}', true)`);

  // ============================================================
  console.log('=== Conversation-membership identity (new items) ===');
  // ============================================================
  const conv1 = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  const a1MemberRow = (await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv1}', '${a1}') returning id`)).rows[0].id;
  const t1MemberRow = (await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv1}', '${t1}') returning id`)).rows[0].id;

  await asClient(t1);
  // 2. A member cannot change id.
  const fakeId = mk('9');
  ok('2. a member cannot change their own membership row id',
    await throwsWith(() => db.query(`update conversation_members set id = '${fakeId}' where id = '${t1MemberRow}'`), /immutable/i));

  // 8. A user cannot update another member's row.
  const r8 = await db.query(`update conversation_members set last_read_at = now() where id = '${a1MemberRow}' returning id`);
  ok('8. a user cannot update another member\'s row (RLS scopes updatable rows to their own)', r8.rows.length === 0);
  // confirm a1's row is genuinely untouched
  await asService();
  const a1RowCheck = await db.query(`select last_read_at from conversation_members where id = '${a1MemberRow}'`);
  ok('8b. the other member\'s row was not modified', a1RowCheck.rows[0].last_read_at === null);

  // ============================================================
  console.log('\n=== Message recipient updates (new items) ===');
  // ============================================================
  await asClient(a1);
  const directMsgId = (await db.query(`insert into messages (school_id, sender_id, recipient_id, body)
    values ('${schoolA}', '${a1}', '${t1}', 'Salaan') returning id`)).rows[0].id;

  await asClient(t1); // t1 is the recipient
  // 2. Recipient cannot change id.
  ok('2. a recipient cannot change the message id',
    await throwsWith(() => db.query(`update messages set id = '${fakeId}' where id = '${directMsgId}'`), /only read_at/i));

  // 5. Recipient cannot change recipient_id.
  ok('5. a recipient cannot change recipient_id',
    await throwsWith(() => db.query(`update messages set recipient_id = '${a1}' where id = '${directMsgId}'`), /only read_at/i));

  // 8. Recipient cannot change deleted_at.
  ok('8. a recipient cannot change deleted_at',
    await throwsWith(() => db.query(`update messages set deleted_at = now() where id = '${directMsgId}'`), /only read_at/i));

  // 9. Recipient cannot convert a conversation message into a direct
  //    message read — there is no UPDATE path at all into a conversation
  //    message via the recipient policy (recipient_id is null on one, so
  //    "recipient_id = auth.uid()" never matches).
  await asClient(a1);
  const conv2 = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv2}', '${a1}')`);
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv2}', '${t1}')`);
  await asClient(t1);
  const convMsgId = (await db.query(`insert into messages (school_id, sender_id, conversation_id, body)
    values ('${schoolA}', '${t1}', '${conv2}', 'group hello') returning id`)).rows[0].id;
  const r9 = await db.query(`update messages set read_at = now() where id = '${convMsgId}' returning id`);
  ok('9. the recipient-update policy grants ZERO rows on a conversation message (recipient_id is null there)', r9.rows.length === 0);

  // 10. Recipient cannot convert a direct message into a conversation
  //     message (re-verified: conversation_id is immutable).
  ok('10. a recipient cannot convert a direct message into a conversation message',
    await throwsWith(() => db.query(`update messages set conversation_id = '${conv2}' where id = '${directMsgId}'`), /only read_at/i));

  // ============================================================
  console.log('\n=== Direct-message school isolation (explicit check) ===');
  // ============================================================
  const polSelect = await db.query(`select pg_get_expr(polqual, polrelid) as qual from pg_policy where polname = 'read own direct messages'`);
  ok('the direct-message SELECT policy explicitly requires school_id = my_school()',
    /school_id = my_school\(\)/i.test(polSelect.rows[0].qual));

  // ============================================================
  console.log('\n=== Lesson-plan non-null class/subject (new items) ===');
  // ============================================================
  await asClient(t1);
  // 2. Teacher cannot create one with class_id NULL (subject_id given).
  ok('2. teacher cannot create a lesson plan with class_id NULL',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, subject_id)
      values ('${schoolA}', '${t1}', 'Teacher One', 'No class', '${subjMath}')`), /requires both class_id and subject_id/i));

  // 3. Teacher cannot create one with subject_id NULL (class_id given).
  ok('3. teacher cannot create a lesson plan with subject_id NULL',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id)
      values ('${schoolA}', '${t1}', 'Teacher One', 'No subject', '${classA1}')`), /requires both class_id and subject_id/i));

  // positive control: a fully-formed, correctly-assigned plan still works
  const goodPlan = await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, class_id, subject_id)
    values ('${schoolA}', '${t1}', 'Teacher One', 'Xisaab', '${classA1}', '${subjMath}') returning id`);
  ok('positive control: a fully-assigned class+subject pair is still accepted', goodPlan.rows.length === 1);

  console.log('');
  if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
  console.log('final_membership_message_lesson_guards: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
