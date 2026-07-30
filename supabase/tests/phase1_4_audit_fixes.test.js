#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 1–4 independent-audit correction test suite

   Applies every migration (including 20260723000001) to a disposable
   real Postgres (pglite) and proves, with real SQL under the
   `authenticated` role, the two defect areas that migration corrects:

   TEACHER / STUDENT RLS SCOPING (required tests 1–6)
     1. Teacher can access an assigned class.
     2. Teacher cannot access an unassigned class.
     3. Teacher can access permitted students in assigned classes.
     4. Teacher cannot access students outside assigned classes.
     5. School Admin can access all classes in their own school.
     6. Cross-school access remains blocked.
     (+ class_exists_in_my_school distinguishes "not found" from
     "exists but not authorized" without leaking cross-school data.)

   ENROLLMENT HISTORY (required tests 1–5)
     1. Initial enrollment is preserved.
     2. Class transfer creates a new row.
     3. The previous row is no longer active.
     4. Historical class and academic-year data remain unchanged.
     5. Only one active enrollment exists after transfer.
     (+ resubmitting the same class is a no-op — no history spam.)

   Run:  cd supabase/tests && node phase1_4_audit_fixes.test.js
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
  const count = async (sql) => Number((await db.query(sql)).rows[0].n);

  // ============================================================
  // Seed: super admin, school A (admin a1, teachers t1 + t2, classes
  // classA1/classA2), school B (admin b1, class classB1).
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk('1'), a1 = mk('2'), b1 = mk('3'), t1 = mk('4'), t2 = mk('5');
  for (const [id, email] of [[superId, 'root@af.test'], [a1, 'a@af.test'], [b1, 'b@af.test'], [t1, 't1@af.test'], [t2, 't2@af.test']]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('AF School A', 'af-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('AF School B', 'af-school-b', 'Hargeisa', '${b1}', 'school', 'secondary') as id`)).rows[0].id;

  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);
  await db.exec(`select assign_role('${t2}', 'teacher', '${schoolA}')`);
  // assign_role only sets profiles.role/school_id — the school admin still
  // creates the canonical teachers row (linked via profile_id) themselves,
  // exactly as Maamulka Dugsiga's Macallimiinta module does.
  const teacherRow1 = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t1}', 'Teacher One') returning id`)).rows[0];
  const teacherRow2 = (await db.query(`insert into teachers (school_id, profile_id, full_name) values ('${schoolA}', '${t2}', 'Teacher Two') returning id`)).rows[0];
  const yearA = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`)).rows[0].id;
  const yearA2 = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2027/2028', '2027-09-01', '2028-06-30') returning id`)).rows[0].id;
  const subjA = (await db.query(`insert into subjects (school_id, name) values ('${schoolA}', 'Xisaab') returning id`)).rows[0].id;
  const classA1 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 1', 'A1') returning id`)).rows[0].id;
  const classA2 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Fasalka 2', 'A2') returning id`)).rows[0].id;
  // t1 is assigned to classA1 only; t2 has no assignment at all
  await db.query(`insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id, is_active)
    values ('${schoolA}', '${teacherRow1.id}', '${subjA}', '${classA1}', '${yearA}', true)`);

  await asClient(b1);
  const classB1 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolB}', 'Form 1', 'B1') returning id`)).rows[0].id;

  // students: one enrolled in classA1 (assigned to t1), one in classA2 (unassigned)
  await asClient(a1);
  const out1 = (await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Xamse Cali',
    p_class_id => '${classA1}', p_academic_year_id => '${yearA}') as out`)).rows[0].out;
  const out2 = (await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Nadiya Faarax',
    p_class_id => '${classA2}', p_academic_year_id => '${yearA}') as out`)).rows[0].out;
  const studentInAssigned = out1.student_id;
  const studentInUnassigned = out2.student_id;

  console.log('=== Teacher / School Admin class + student RLS scoping ===');

  // 1. Teacher can access an assigned class.
  await asClient(t1);
  let r = await db.query(`select id from classes where id = '${classA1}'`);
  ok('1. teacher can read their assigned class', r.rows.length === 1);

  // 2. Teacher cannot access an unassigned class.
  r = await db.query(`select id from classes where id = '${classA2}'`);
  ok('2. teacher cannot read an unassigned class in the same school', r.rows.length === 0);
  r = await db.query(`select id from classes where id = '${classB1}'`);
  ok('2b. teacher cannot read a class in another school', r.rows.length === 0);

  // 3. Teacher can access permitted students in assigned classes.
  r = await db.query(`select id from students where id = '${studentInAssigned}'`);
  ok('3. teacher can read a student enrolled in their assigned class', r.rows.length === 1);

  // 4. Teacher cannot access students outside assigned classes.
  r = await db.query(`select id from students where id = '${studentInUnassigned}'`);
  ok('4. teacher cannot read a student in an unassigned class (same school)', r.rows.length === 0);

  // a teacher with NO assignments at all (t2) sees no classes/students
  await asClient(t2);
  r = await db.query(`select id from classes where school_id = '${schoolA}'`);
  ok('4b. an unassigned teacher reads ZERO classes', r.rows.length === 0);
  r = await db.query(`select id from students where school_id = '${schoolA}'`);
  ok('4c. an unassigned teacher reads ZERO students', r.rows.length === 0);

  // 5. School Admin can access all classes in their own school.
  await asClient(a1);
  r = await db.query(`select id from classes where school_id = '${schoolA}' order by name`);
  ok('5. school admin reads every class in their own school', r.rows.length === 2);
  r = await db.query(`select id from students where school_id = '${schoolA}'`);
  ok('5b. school admin reads every student in their own school', r.rows.length === 2);

  // 6. Cross-school access remains blocked (for admin too).
  r = await db.query(`select id from classes where id = '${classB1}'`);
  ok('6. school A admin cannot read school B\'s class', r.rows.length === 0);
  await asClient(b1);
  r = await db.query(`select id from classes where id = '${classA1}'`);
  ok('6b. school B admin cannot read school A\'s class', r.rows.length === 0);

  // class_exists_in_my_school — distinguishes "not found" from "exists but
  // not authorized" without leaking any class data across schools
  await asClient(t2); // unassigned teacher in school A
  r = await db.query(`select class_exists_in_my_school('${classA1}') v`);
  ok('7. class_exists_in_my_school is true for a real same-school class', r.rows[0].v === true);
  r = await db.query(`select class_exists_in_my_school('${classB1}') v`);
  ok('7b. class_exists_in_my_school is false for another school\'s class (no leak)', r.rows[0].v === false);
  r = await db.query(`select class_exists_in_my_school('00000000-0000-0000-0000-000000000000') v`);
  ok('7c. class_exists_in_my_school is false for a genuinely missing id', r.rows[0].v === false);

  console.log('\n=== Student enrollment history (transfer safety) ===');

  await asClient(a1);
  // 1. Initial enrollment is preserved.
  r = await db.query(`select id, class_id, academic_year_id, status, ended_on, enrolled_on
    from student_enrollments where student_id = '${studentInAssigned}'`);
  ok('1. initial enrollment exists, active, class A1, no end date', r.rows.length === 1
    && r.rows[0].status === 'active' && r.rows[0].class_id === classA1 && r.rows[0].ended_on === null);
  const firstEnrollmentId = r.rows[0].id;
  const firstEnrolledOn = r.rows[0].enrolled_on;

  // 2. Class transfer creates a new row (student moves classA1 -> classA2,
  //    same admission re-run with a different class — the sanctioned path).
  const out3 = (await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Xamse Cali',
    p_student_id => '${studentInAssigned}', p_class_id => '${classA2}',
    p_academic_year_id => '${yearA}') as out`)).rows[0].out;
  const newEnrollmentId = out3.enrollment_id;
  ok('2. class transfer creates a NEW enrollment row (different id)', newEnrollmentId !== firstEnrollmentId);

  // 3. The previous row is no longer active.
  r = await db.query(`select status, ended_on from student_enrollments where id = '${firstEnrollmentId}'`);
  ok('3. the previous row is no longer active (transferred, ended_on set)',
    r.rows[0].status === 'transferred' && r.rows[0].ended_on !== null);

  // 4. Historical class and academic-year data remain unchanged.
  r = await db.query(`select class_id, academic_year_id, enrolled_on from student_enrollments where id = '${firstEnrollmentId}'`);
  ok('4. the historical row still points at the ORIGINAL class', r.rows[0].class_id === classA1);
  ok('4b. the historical row\'s original enrolled_on date is untouched',
    String(r.rows[0].enrolled_on) === String(firstEnrolledOn));

  // 5. Only one active enrollment exists after transfer.
  r = await db.query(`select id, class_id from student_enrollments where student_id = '${studentInAssigned}' and status = 'active'`);
  ok('5. exactly ONE active enrollment exists after the transfer', r.rows.length === 1);
  ok('5b. the active enrollment now points at the NEW class', r.rows[0].class_id === classA2);

  // resubmitting the SAME class is a no-op — no history spam
  const beforeCount = await count(`select count(*) n from student_enrollments where student_id = '${studentInAssigned}'`);
  await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Xamse Cali',
    p_student_id => '${studentInAssigned}', p_class_id => '${classA2}',
    p_academic_year_id => '${yearA}') as out`);
  const afterCount = await count(`select count(*) n from student_enrollments where student_id = '${studentInAssigned}'`);
  ok('6. resubmitting the SAME class is a no-op (no extra history row)', afterCount === beforeCount);

  // a genuine academic-year-only change also transfers correctly
  const out4 = (await db.query(`select admit_student_atomic(
    p_school => '${schoolA}', p_applicant_name => 'Xamse Cali',
    p_student_id => '${studentInAssigned}', p_class_id => '${classA2}',
    p_academic_year_id => '${yearA2}') as out`)).rows[0].out;
  ok('7. an academic-year-only change also creates a new enrollment row', out4.enrollment_id !== newEnrollmentId);
  r = await db.query(`select count(*) n from student_enrollments where student_id = '${studentInAssigned}' and status = 'active'`);
  ok('7b. still exactly ONE active enrollment after the year change', Number(r.rows[0].n) === 1);

  // the students.class_id denormalized cache stays in sync with the
  // CURRENT active enrollment (existing display code depends on this)
  r = await db.query(`select class_id from students where id = '${studentInAssigned}'`);
  ok('8. students.class_id cache matches the current active enrollment', r.rows[0].class_id === classA2);

  console.log('\n=== lesson_plans / conversations / messages schema completeness ===');
  r = await db.query(`select column_name from information_schema.columns
    where table_name = 'lesson_plans' and column_name in
    ('objectives','materials','lesson_content','homework_note','teacher_id') order by column_name`);
  ok('9. lesson_plans has all 5 newly-required columns', r.rows.length === 5);
  r = await db.query(`select column_name from information_schema.columns
    where table_name = 'conversations' and column_name in ('type','updated_at') order by column_name`);
  ok('10. conversations has type + updated_at', r.rows.length === 2);
  r = await db.query(`select column_name from information_schema.columns
    where table_name = 'messages' and column_name in ('message_type','attachment_uri','deleted_at') order by column_name`);
  ok('11. messages has message_type + attachment_uri + deleted_at', r.rows.length === 3);

  // 'ready' is now allowed alongside the existing review-workflow statuses
  // (class_id/subject_id match t1's real assignment from the seed above —
  // required for a teacher-authored plan since the 2026-07-24 rule change)
  const lp = (await db.query(`insert into lesson_plans (school_id, teacher_profile_id, teacher_name, title, status, class_id, subject_id)
    values ('${schoolA}', '${t1}', 'T1', 'Cashar', 'draft', '${classA1}', '${subjA}') returning id`)).rows[0];
  await asClient(t1);
  await db.query(`update lesson_plans set status = 'ready' where id = '${lp.id}'`);
  r = await db.query(`select status, teacher_id from lesson_plans where id = '${lp.id}'`);
  ok('12. lesson_plans status accepts the new value "ready"', r.rows[0].status === 'ready');
  ok('12b. teacher_id was auto-derived from teacher_profile_id', r.rows[0].teacher_id === teacherRow1.id);
  // the existing review workflow (pending/approved/rejected) still works
  await db.query(`update lesson_plans set status = 'pending' where id = '${lp.id}'`);
  await asClient(a1);
  await db.query(`update lesson_plans set status = 'approved' where id = '${lp.id}'`);
  r = await db.query(`select status from lesson_plans where id = '${lp.id}'`);
  ok('12c. the existing draft/pending/approved review workflow still works', r.rows[0].status === 'approved');

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) FAILED`);
    process.exit(1);
  }
  console.log('phase1_4_audit_fixes: all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
