#!/usr/bin/env node
/* ============================================================
   Kobciye — final independent-audit security-correction test suite

   Applies every migration (including 20260723000002) to a disposable
   real Postgres (pglite) and proves, with real SQL under the
   `authenticated` role:

   DIRECT-MESSAGE CROSS-SCHOOL ISOLATION (required tests 1–6)
     1. User in School A can message a permitted user in School A.
     2. User in School A cannot message a user in School B.
     3. User cannot forge another sender_profile_id.
     4. User cannot set a false school_id.
     5. User cannot read cross-school direct messages.
     6. Existing conversation-member messaging still works.

   LESSON-PLAN AUTHORIZATION (required tests 1–8)
     1. Teacher can create a lesson plan for an assigned class+subject.
     2. Teacher cannot create one for an unassigned class.
     3. Teacher cannot create one for an unassigned subject.
     4. Teacher can read their own permitted lesson plans.
     5. Teacher cannot read another teacher's lesson plans.
     6. School Admin can read lesson plans belonging to their school.
     7. Accountant, Parent and Student cannot access lesson plans.
     8. Cross-school lesson-plan access is blocked.

   Run:  cd supabase/tests && node final_security_corrections.test.js
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
  // Seed: super admin, school A (admin a1, teacher t1, accountant ac1,
  // parent p1, student st1), school B (admin b1, teacher t2).
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk('1'), a1 = mk('2'), b1 = mk('3'), t1 = mk('4'), t2 = mk('5'),
    ac1 = mk('6'), pp1 = mk('7'), stu1 = mk('8'), t1b = mk('9');
  for (const [id, email] of [
    [superId, 'root@sec.test'], [a1, 'a@sec.test'], [b1, 'b@sec.test'],
    [t1, 't1@sec.test'], [t2, 't2@sec.test'], [ac1, 'ac1@sec.test'],
    [pp1, 'p1@sec.test'], [stu1, 'stu1@sec.test'], [t1b, 't1b@sec.test'],
  ]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('Sec School A', 'sec-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('Sec School B', 'sec-school-b', 'Hargeisa', '${b1}', 'school', 'secondary') as id`)).rows[0].id;

  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${t1b}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${ac1}', 'accountant', '${schoolA}')`);
  await db.exec(`select assign_role('${pp1}', 'parent', '${schoolA}')`);
  await db.exec(`select assign_role('${stu1}', 'student', '${schoolA}')`);
  const teacherRow1 = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1}', 'Teacher One') returning id`)).rows[0];
  const teacherRow1b = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1b}', 'Teacher One B') returning id`)).rows[0];
  const yearA = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`)).rows[0].id;
  const subjMath = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Xisaab') returning id`)).rows[0].id;
  const subjEnglish = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Ingiriisi') returning id`)).rows[0].id;
  const classA1 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 1', 'S1') returning id`)).rows[0].id;
  const classA2 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 2', 'S2') returning id`)).rows[0].id;
  // t1 is assigned to (classA1, Math) only
  await db.query(`insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id, is_active)
    values ('${schoolA}', '${teacherRow1.id}', '${subjMath}', '${classA1}', '${yearA}', true)`);

  await asClient(b1);
  await db.exec(`select assign_role('${t2}', 'teacher', '${schoolB}')`);

  console.log('=== Direct-message cross-school isolation ===');

  // 1. User in School A can message a permitted user in School A.
  await asClient(a1);
  let r = await db.query(`insert into messages (school_id, sender_id, recipient_id, body)
    values ('${schoolA}', '${a1}', '${t1}', 'Salaan macalin') returning id`);
  ok('1. same-school direct message is accepted', r.rows.length === 1);
  const goodMsgId = r.rows[0].id;

  // 2. User in School A cannot message a user in School B.
  ok('2. cross-school direct message is rejected',
    await throwsWith(() => db.query(`insert into messages (school_id, sender_id, recipient_id, body)
      values ('${schoolA}', '${a1}', '${t2}', 'gaal')`), /same school/i));

  // 3. User cannot forge another sender_profile_id.
  await asClient(t1); // authenticated as t1, but claims to be sent BY a1
  ok('3. cannot forge another user\'s sender_id',
    await throwsWith(() => db.query(`insert into messages (school_id, sender_id, recipient_id, body)
      values ('${schoolA}', '${a1}', '${t1}', 'forged')`)));

  // 4. User cannot set a false school_id.
  ok('4. cannot claim a false school_id on an otherwise-valid message',
    await throwsWith(() => db.query(`insert into messages (school_id, sender_id, recipient_id, body)
      values ('${schoolB}', '${t1}', '${a1}', 'false school')`)));

  // 5. User cannot read cross-school direct messages.
  await asClient(t2); // school B teacher, uninvolved in the School A message
  r = await db.query(`select id from messages where id = '${goodMsgId}'`);
  ok('5. an uninvolved cross-school user cannot read the message', r.rows.length === 0);
  // even the legitimate recipient reads it fine
  await asClient(t1);
  r = await db.query(`select id, body from messages where id = '${goodMsgId}'`);
  ok('5b. the legitimate recipient CAN still read it', r.rows.length === 1);

  // 6. Existing conversation-member messaging still works (unaffected).
  await asClient(a1);
  const conv = (await db.query(`insert into conversations (school_id, created_by) values ('${schoolA}', '${a1}') returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv}', '${a1}')`);
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv}', '${t1}')`);
  await asClient(t1);
  r = await db.query(`insert into messages (school_id, sender_id, conversation_id, body)
    values ('${schoolA}', '${t1}', '${conv}', 'still works') returning id`);
  ok('6. conversation-member messaging is unaffected by this correction', r.rows.length === 1);

  console.log('\n=== Lesson-plan authorization ===');

  // 1. Teacher can create a lesson plan for an assigned class+subject.
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

  // a plan with no class/subject yet (still drafting) remains allowed
  r = await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
    values ('${schoolA}', '${t1}', 'Teacher One', 'Fikrad qoraal ah') returning id`);
  ok('3b. a class/subject-less draft is still allowed (unaffected)', r.rows.length === 1);

  // 4. Teacher can read their own permitted lesson plans.
  r = await db.query(`select id from lesson_plans where id = '${assignedPlanId}'`);
  ok('4. teacher reads their own lesson plan', r.rows.length === 1);

  // create a second teacher's plan (t1b, unassigned/no class needed)
  await asClient(t1b);
  const otherTeacherPlan = (await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
    values ('${schoolA}', '${t1b}', 'Teacher One B', 'Cashar kale') returning id`)).rows[0].id;

  // 5. Teacher cannot read another teacher's lesson plans.
  await asClient(t1);
  r = await db.query(`select id from lesson_plans where id = '${otherTeacherPlan}'`);
  ok('5. teacher cannot read ANOTHER teacher\'s lesson plan', r.rows.length === 0);

  // 6. School Admin can read lesson plans belonging to their school.
  await asClient(a1);
  r = await db.query(`select id from lesson_plans where school_id = '${schoolA}'`);
  ok('6. school admin reads every lesson plan in their own school', r.rows.length === 3);

  // 7. Accountant, Parent and Student cannot access lesson plans.
  await asClient(ac1);
  ok('7. accountant reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);
  await asClient(pp1);
  ok('7b. parent reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);
  await asClient(stu1);
  ok('7c. student reads ZERO lesson plans', (await count(`select count(*) n from lesson_plans`)) === 0);

  // 8. Cross-school lesson-plan access is blocked.
  await asClient(t2); // school B teacher
  ok('8. a teacher in another school reads ZERO of school A\'s lesson plans',
    (await count(`select count(*) n from lesson_plans`)) === 0);
  await asClient(b1); // school B admin
  ok('8b. an admin of another school reads ZERO of school A\'s lesson plans',
    (await count(`select count(*) n from lesson_plans`)) === 0);

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) FAILED`);
    process.exit(1);
  }
  console.log('final_security_corrections: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
