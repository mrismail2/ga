#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 1–4 operational-roles test suite

   Re-implementation of the previously reported (but unrecoverable)
   phase4_operational_roles.test.js. Applies EVERY migration (including
   20260717000001_additional_phase1_4_requirements.sql) to a disposable
   real Postgres (pglite) and proves, with real SQL under the
   `authenticated` role:

     - admit_student_atomic creates student + enrollment + admission +
       parent + guardian link in ONE transaction
     - a failure at ANY step rolls the whole admission back (no partial
       student is ever left behind)
     - duplicate guardian links are rejected
     - cross-school guardian/class/admission references are rejected
     - only a school admin may enrol; teachers/anon cannot
     - lesson_plans: teacher drafts own, only admin approves, RLS keeps
       schools apart, an empty school sees zero rows
     - conversations/messages: members only, cross-school access blocked,
       unread state via conversation_members.last_read_at, an empty
       school sees zero conversations

   Run:  cd supabase/tests && node phase4_operational_roles.test.js
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
  const asAnon = async () => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '', false)`);
    await db.exec('set role anon');
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
  // Seed: super admin, school A (admin a1, teacher t1, parent-profile pp1),
  // school B (admin b1) — via the sanctioned provisioning path.
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk(1), a1 = mk(2), b1 = mk(3), t1 = mk(4), pp1 = mk(5);
  for (const [id, email] of [[superId, 'root@op.test'], [a1, 'a@op.test'], [b1, 'b@op.test'], [t1, 't@op.test'], [pp1, 'p@op.test']]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('Op School A', 'op-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('Op School B', 'op-school-b', 'Hargeisa', '${b1}', 'school', 'secondary') as id`)).rows[0].id;
  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${pp1}', 'parent', '${schoolA}')`);
  await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1}', 'Teacher Op')`);

  // classes for both schools (admin-created, canonical)
  await asClient(a1);
  const classA = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 1', 'G1') returning id`)).rows[0].id;
  const yearA = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`)).rows[0].id;
  await asClient(b1);
  const classB = (await db.query(`insert into classes (school_id, name, code) values ('${schoolB}', 'Form 1', 'F1') returning id`)).rows[0].id;

  let r;

  // ============================================================
  // 1. atomic admission — happy path (new student + new guardian)
  // ============================================================
  await asClient(a1);
  r = await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Ayaan Warsame',
    p_gender => 'female', p_class_id => '${classA}', p_academic_year_id => '${yearA}',
    p_guardian_name => 'Warsame Cali', p_guardian_phone => '+252611111111',
    p_relationship => 'father', p_is_primary => true) as out`);
  const out1 = r.rows[0].out;
  ok('1. admit_student_atomic returns ids for every created record',
    out1 && out1.student_id && out1.enrollment_id && out1.admission_id && out1.parent_id && out1.link_id);
  r = await db.query(`select student_id, full_name, class_id from students where id = '${out1.student_id}'`);
  ok('1b. student row exists with a generated public student id',
    r.rows.length === 1 && r.rows[0].student_id && r.rows[0].class_id === classA);
  r = await db.query(`select status, class_id, academic_year_id from student_enrollments where id = '${out1.enrollment_id}'`);
  ok('1c. active enrollment row exists with class + academic year',
    r.rows.length === 1 && r.rows[0].status === 'active' && r.rows[0].class_id === classA && r.rows[0].academic_year_id === yearA);
  r = await db.query(`select status, student_id from admissions where id = '${out1.admission_id}'`);
  ok('1d. admission row is enrolled and linked to the student',
    r.rows.length === 1 && r.rows[0].status === 'enrolled' && r.rows[0].student_id === out1.student_id);
  r = await db.query(`select relationship, is_primary from student_parents where id = '${out1.link_id}'`);
  ok('1e. guardian link exists with relationship + primary flag',
    r.rows.length === 1 && r.rows[0].relationship === 'father' && r.rows[0].is_primary === true);

  // ============================================================
  // 2. admission upgrade path (existing application → enrolled)
  // ============================================================
  const adm2 = (await db.query(`insert into admissions (school_id, applicant_name, status) values ('${schoolA}', 'Maxamed Xasan', 'pending') returning id`)).rows[0].id;
  r = await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Maxamed Xasan',
    p_class_id => '${classA}', p_admission_id => '${adm2}',
    p_parent_id => '${out1.parent_id}', p_relationship => 'guardian') as out`);
  const out2 = r.rows[0].out;
  ok('2. existing admission upgrades to enrolled (same canonical row)', out2.admission_id === adm2);
  r = await db.query(`select status from admissions where id = '${adm2}'`);
  ok('2b. upgraded admission status is enrolled', r.rows[0].status === 'enrolled');
  ok('2c. existing same-school guardian was reused (no duplicate parent row)', out2.parent_id === out1.parent_id);

  // ============================================================
  // 3. duplicate guardian link is rejected
  // ============================================================
  ok('3. linking the same guardian to the same student twice is rejected',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'Ayaan Warsame',
      p_student_id => '${out1.student_id}',
      p_parent_id => '${out1.parent_id}') as out`), /already linked/i));
  const links = await count(`select count(*) n from student_parents where student_id = '${out1.student_id}'`);
  ok('3b. the student still has exactly one guardian link', links === 1);

  // ============================================================
  // 4. atomicity — a failing guardian step rolls the WHOLE admission back
  // ============================================================
  await asClient(b1);
  const parentB = (await db.query(`insert into parents (school_id, full_name, phone) values ('${schoolB}', 'Waalid B', '+252622222222') returning id`)).rows[0].id;
  await asClient(a1);
  const studentsBefore = await count(`select count(*) n from students where school_id = '${schoolA}'`);
  const admissionsBefore = await count(`select count(*) n from admissions where school_id = '${schoolA}'`);
  ok('4. cross-school guardian aborts the admission',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'Rollback Kid',
      p_class_id => '${classA}', p_parent_id => '${parentB}') as out`), /another school/i));
  const studentsAfter = await count(`select count(*) n from students where school_id = '${schoolA}'`);
  const admissionsAfter = await count(`select count(*) n from admissions where school_id = '${schoolA}'`);
  ok('4b. NO partial student row was left behind', studentsAfter === studentsBefore);
  ok('4c. NO partial admission row was left behind', admissionsAfter === admissionsBefore);

  // ============================================================
  // 5. cross-school class / admission references are rejected
  // ============================================================
  ok('5. class from another school is rejected',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'X', p_class_id => '${classB}') as out`), /another school/i));
  await asClient(b1);
  const admB = (await db.query(`insert into admissions (school_id, applicant_name, status) values ('${schoolB}', 'B Kid', 'pending') returning id`)).rows[0].id;
  await asClient(a1);
  ok('5b. admission from another school is rejected',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'B Kid', p_admission_id => '${admB}') as out`), /another school/i));

  // ============================================================
  // 6. only a school admin may enrol
  // ============================================================
  await asClient(t1);
  ok('6. a teacher cannot call admit_student_atomic',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'Teacher Kid') as out`), /school admin/i));
  await asClient(b1);
  ok('6b. an admin of ANOTHER school cannot enrol into school A',
    await throwsWith(() => db.query(`select admit_student_atomic(
      p_school => '${schoolA}', p_applicant_name => 'Intruder Kid') as out`), /school admin/i));

  // ============================================================
  // 7. lesson_plans — canonical Casharrada with role rules + isolation
  // ============================================================
  await asClient(t1);
  const lp1 = (await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, subject, class_label)
    values ('${schoolA}', '${t1}', 'Macalin T', 'Xisaab: Isugeynta', 'Xisaab', 'Fasalka 1') returning id`)).rows[0].id;
  ok('7. teacher creates their own draft lesson plan', !!lp1);
  await db.query(`update lesson_plans set status = 'pending' where id = '${lp1}'`);
  r = await db.query(`select status from lesson_plans where id = '${lp1}'`);
  ok('7b. teacher submits own plan for review (draft → pending)', r.rows[0].status === 'pending');
  ok('7c. teacher CANNOT approve their own plan',
    await throwsWith(() => db.query(`update lesson_plans set status = 'approved' where id = '${lp1}'`), /school admin/i));
  await asClient(a1);
  await db.query(`update lesson_plans set status = 'approved' where id = '${lp1}'`);
  r = await db.query(`select status from lesson_plans where id = '${lp1}'`);
  ok('7d. school admin approves the plan', r.rows[0].status === 'approved');
  await asClient(b1);
  ok('7e. another school sees ZERO of school A lesson plans (empty state)',
    (await count(`select count(*) n from lesson_plans`)) === 0);
  await asClient(t1);
  ok('7f. teacher cannot plant a lesson plan under another teacher id',
    await throwsWith(() => db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title)
      values ('${schoolA}', '${a1}', 'Fake', 'Fake plan')`)));

  // ============================================================
  // 8. conversations / messages — members only, unread via last_read_at
  // ============================================================
  await asClient(a1);
  const conv = (await db.query(`insert into conversations (school_id, created_by, title)
    values ('${schoolA}', '${a1}', null) returning id`)).rows[0].id;
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv}', '${a1}')`);
  await db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv}', '${t1}')`);
  ok('8. conversation created with two same-school members', true);
  ok('8b. a member from ANOTHER school cannot be added',
    await throwsWith(() => db.query(`insert into conversation_members (conversation_id, profile_id) values ('${conv}', '${b1}')`), /another school/i));

  await asClient(t1);
  r = await db.query(`insert into messages (school_id, sender_id, conversation_id, body)
    values ('${schoolA}', '${t1}', '${conv}', 'Salaan, waraaqda imtixaanka waa diyaar.') returning id`);
  ok('8c. member sends a text message into the conversation', r.rows.length === 1);

  await asClient(a1);
  r = await db.query(`select body from messages where conversation_id = '${conv}'`);
  ok('8d. the other member reads the persisted message',
    r.rows.length === 1 && /diyaar/.test(r.rows[0].body));
  // unread: message newer than my last_read_at → then mark read
  r = await db.query(`select count(*) n from messages m
    join conversation_members cm on cm.conversation_id = m.conversation_id and cm.profile_id = '${a1}'
    where m.conversation_id = '${conv}' and (cm.last_read_at is null or m.created_at > cm.last_read_at)`);
  ok('8e. unread count is 1 before marking read (last_read_at)', Number(r.rows[0].n) === 1);
  await db.query(`update conversation_members set last_read_at = now() where conversation_id = '${conv}' and profile_id = '${a1}'`);
  r = await db.query(`select count(*) n from messages m
    join conversation_members cm on cm.conversation_id = m.conversation_id and cm.profile_id = '${a1}'
    where m.conversation_id = '${conv}' and (cm.last_read_at is null or m.created_at > cm.last_read_at)`);
  ok('8f. unread count is 0 after marking read', Number(r.rows[0].n) === 0);

  await asClient(b1);
  ok('8g. another school sees ZERO conversations (empty state)',
    (await count(`select count(*) n from conversations`)) === 0);
  ok('8h. another school reads ZERO conversation messages',
    (await count(`select count(*) n from messages where conversation_id = '${conv}'`)) === 0);
  ok('8i. a non-member cannot inject a message into the conversation',
    await throwsWith(() => db.query(`insert into messages (school_id, sender_id, conversation_id, body)
      values ('${schoolB}', '${b1}', '${conv}', 'intrusion')`)));
  await asClient(pp1);
  ok('8j. a same-school NON-member also reads zero messages',
    (await count(`select count(*) n from messages where conversation_id = '${conv}'`)) === 0);

  // ============================================================
  // 9. anon is locked out of every new table
  // ============================================================
  await asAnon();
  for (const t of ['student_enrollments', 'lesson_plans', 'conversations', 'conversation_members']) {
    ok(`9. anon cannot read ${t}`,
      await throwsWith(() => db.query(`select * from ${t}`)));
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) FAILED`);
    process.exit(1);
  }
  console.log('phase4_operational_roles: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
