#!/usr/bin/env node
/* ============================================================
   Kobciye — student / enrollment / guardian workflow (database level)

   Runs the REAL supabase/migrations against a disposable in-process
   Postgres (pglite) and exercises admit_student_atomic — the single writer
   both "Ku dar Arday" and Admissions now route through — under real RLS.

   The defect this locks down: a student was created without the ACTIVE
   student_enrollments row every roster and count reads from, so nothing
   appeared in Ardayda, in the class, or in the class's active count.

   No remote database is touched and no destructive CLI command is issued:
   pglite is created, used and discarded entirely in-process.
   ============================================================ */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, condition) => { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; };
const rejects = async (fn, pattern) => {
  try { await fn(); return false; } catch (e) { return pattern.test(String(e && e.message)); }
};

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('myapp.test_uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
  `);
  const dir = path.join(__dirname, '..', 'migrations');
  for (const file of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
  }
  console.log(`applied ${fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).length} migrations to disposable Postgres\n`);

  const asService = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '', false)`); };
  const asClient = async (uid) => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '${uid}', false)`);
    await db.exec('set role authenticated');
  };
  const id = (d) => `${d.repeat(8)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(12)}`;
  const superId = id('1'), adminA = id('2'), adminB = id('3');

  await asService();
  for (const [uid, email] of [[superId, 'root@x.test'], [adminA, 'a@x.test'], [adminB, 'b@x.test']]) {
    await db.query('insert into auth.users (id,email) values ($1,$2)', [uid, email]);
  }
  await db.query(`update profiles set role='super_admin' where id=$1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('A','enrol-a','A','${adminA}','school','primary_middle') id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('B','enrol-b','B','${adminB}','school','secondary') id`)).rows[0].id;

  /* ---- School A's academic structure ---- */
  await asClient(adminA);
  const yearA = (await db.query(
    `insert into academic_years (school_id,name,status) values ('${schoolA}','2026/2027','active') returning id`)).rows[0].id;
  const class1 = (await db.query(
    `insert into classes (school_id,name,academic_year_id) values ('${schoolA}','Fasalka 1','${yearA}') returning id`)).rows[0].id;
  const class2 = (await db.query(
    `insert into classes (school_id,name,academic_year_id) values ('${schoolA}','Fasalka 2','${yearA}') returning id`)).rows[0].id;
  await asClient(adminB);
  const classB = (await db.query(
    `insert into classes (school_id,name) values ('${schoolB}','B Class') returning id`)).rows[0].id;

  /* helpers matching exactly what the app's screens count */
  const activeCount = async (classId) => Number((await db.query(
    `select count(*) n from student_enrollments where class_id=$1 and status='active'`, [classId])).rows[0].n);
  const visibleStudents = async (schoolId) => Number((await db.query(
    `select count(*) n from students s where s.school_id=$1
       and exists (select 1 from student_enrollments e where e.student_id=s.id and e.status='active')`,
    [schoolId])).rows[0].n);

  /* ---- B. "Ku dar Arday": student + ACTIVE enrollment, atomically ---- */
  await asClient(adminA);
  const admitted = (await db.query(
    `select admit_student_atomic('${schoolA}','Aaliyah Maxamed',null,null,null,'${class1}',null,'${yearA}') r`)).rows[0].r;
  const studentId = admitted.student_id;

  ok('the student row is created', Number((await db.query(
    `select count(*) n from students where id=$1`, [studentId])).rows[0].n) === 1);
  ok('an ACTIVE student_enrollments row is created in the same call', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1 and status='active'`, [studentId])).rows[0].n) === 1);
  const enrol = (await db.query(
    `select class_id, academic_year_id, school_id from student_enrollments where student_id=$1 and status='active'`,
    [studentId])).rows[0];
  ok('the enrollment stores the correct class', enrol.class_id === class1);
  ok('the enrollment stores the correct academic year', enrol.academic_year_id === yearA);
  ok('the enrollment is scoped to the correct school', enrol.school_id === schoolA);
  ok('the student is visible in the school student list', await visibleStudents(schoolA) === 1);
  ok('the class active count updates to 1', await activeCount(class1) === 1);
  ok('the other class stays at 0', await activeCount(class2) === 0);

  /* active enrollment scope is now mandatory at the DB boundary too */
  const beforeRequiredChecks = Number((await db.query(
    `select count(*) n from students where school_id='${schoolA}'`)).rows[0].n);
  ok('an active enrollment without a class is rejected', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','Missing Class',null,null,null,null,null,'${yearA}')`),
    /active enrollment requires a class/i));
  ok('an active enrollment without an academic year is rejected', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','Missing Year',null,null,null,'${class1}')`),
    /active enrollment requires an academic year/i));
  ok('required-field failures roll back the partial student row', Number((await db.query(
    `select count(*) n from students where school_id='${schoolA}'`)).rows[0].n) === beforeRequiredChecks);

  /* ---- the failure path leaves NOTHING behind (real atomicity) ---- */
  const beforeStudents = Number((await db.query(`select count(*) n from students where school_id='${schoolA}'`)).rows[0].n);
  ok('a class from another school is rejected with a real error', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','Cross School',null,null,null,'${classB}')`),
    /belongs to another school/i));
  ok('the rejected admission left NO partial student behind',
    Number((await db.query(`select count(*) n from students where school_id='${schoolA}'`)).rows[0].n) === beforeStudents);
  ok('an empty applicant name is rejected', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','   ')`), /applicant name is required/i));

  /* ---- C. transfer preserves enrollment history ---- */
  await db.query(`select admit_student_atomic('${schoolA}','Aaliyah Maxamed',null,null,null,'${class2}',null,'${yearA}',null,'${studentId}')`);
  ok('the previous enrollment is preserved as history (never overwritten)', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1`, [studentId])).rows[0].n) === 2);
  ok('the previous enrollment is closed as transferred', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1 and status='transferred' and ended_on is not null`,
    [studentId])).rows[0].n) === 1);
  ok('the student has exactly ONE active enrollment after the move', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1 and status='active'`, [studentId])).rows[0].n) === 1);
  ok('the moved student now counts in the NEW class only',
    await activeCount(class2) === 1 && await activeCount(class1) === 0);
  const beforeResubmit = Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1`, [studentId])).rows[0].n);
  await db.query(`select admit_student_atomic('${schoolA}','Aaliyah Maxamed',null,null,null,'${class2}',null,'${yearA}',null,'${studentId}')`);
  ok('resubmitting unchanged values creates no history spam', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1`, [studentId])).rows[0].n) === beforeResubmit);

  /* ---- D. guardians ---- */
  const withGuardian = (await db.query(
    `select admit_student_atomic('${schoolA}','Child One',null,null,null,'${class1}',null,'${yearA}',
       null,null,null,'Cali Xuseen','+252630000001',null,'father') r`)).rows[0].r;
  ok('a NEW guardian is created by an enrolled admission', !!withGuardian.parent_id);
  ok('the guardian is linked to the student', !!withGuardian.link_id);
  ok('the guarded student also got an active enrollment', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1 and status='active'`,
    [withGuardian.student_id])).rows[0].n) === 1);

  const sibling = (await db.query(
    `select admit_student_atomic('${schoolA}','Child Two',null,null,null,'${class1}',null,'${yearA}',
       null,null,null,'Cali Xuseen','+252630000001',null,'father') r`)).rows[0].r;
  ok('an existing guardian (same name+phone) is REUSED, not duplicated',
    sibling.parent_id === withGuardian.parent_id);
  ok('exactly one guardian row exists for that name+phone', Number((await db.query(
    `select count(*) n from parents where school_id='${schoolA}' and full_name='Cali Xuseen'`)).rows[0].n) === 1);
  ok('the reused guardian is linked to BOTH children', Number((await db.query(
    `select count(*) n from student_parents where parent_id=$1`, [withGuardian.parent_id])).rows[0].n) === 2);

  const byId = (await db.query(
    `select admit_student_atomic('${schoolA}','Child Three',null,null,null,'${class1}',null,'${yearA}',
       null,null,'${withGuardian.parent_id}',null,null,null,'father') r`)).rows[0].r;
  ok('linking an EXISTING guardian by id works', byId.parent_id === withGuardian.parent_id);

  const noGuardian = (await db.query(
    `select admit_student_atomic('${schoolA}','No Guardian',null,null,null,'${class1}',null,'${yearA}') r`)).rows[0].r;
  ok('a student with NO guardian is still fully enrolled',
    noGuardian.parent_id === null && Number((await db.query(
      `select count(*) n from student_enrollments where student_id=$1 and status='active'`,
      [noGuardian.student_id])).rows[0].n) === 1);

  ok('a duplicate guardian link is rejected', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','Child One',null,null,null,null,null,null,
      null,'${withGuardian.student_id}','${withGuardian.parent_id}')`), /already linked/i));

  /* ---- E. cross-school isolation under real RLS ---- */
  await asClient(adminB);
  ok('a School B admin may NOT admit into School A', await rejects(
    () => db.query(`select admit_student_atomic('${schoolA}','Intruder')`), /only a school admin|permission|denied/i));
  ok('a School B admin cannot see School A students', Number((await db.query(
    `select count(*) n from students where school_id='${schoolA}'`)).rows[0].n) === 0);
  ok('a School B admin cannot see School A enrollments', Number((await db.query(
    `select count(*) n from student_enrollments where school_id='${schoolA}'`)).rows[0].n) === 0);

  /* ---- F. Super Admin may admit into a chosen school (is_admin_of) ---- */
  await asClient(superId);
  const bySuper = (await db.query(
    `select admit_student_atomic('${schoolA}','Super Added',null,null,null,'${class1}',null,'${yearA}') r`)).rows[0].r;
  ok('Super Admin may enrol into the school they selected', !!bySuper.student_id);
  ok('the Super-Admin-created student also has an active enrollment', Number((await db.query(
    `select count(*) n from student_enrollments where student_id=$1 and status='active'`,
    [bySuper.student_id])).rows[0].n) === 1);
  ok('the Super-Admin-created student belongs to the SELECTED school', Number((await db.query(
    `select count(*) n from students where id=$1 and school_id='${schoolA}'`, [bySuper.student_id])).rows[0].n) === 1);
  ok('no data leaked into the other school', Number((await db.query(
    `select count(*) n from students where school_id='${schoolB}'`)).rows[0].n) === 0);

  /* ---- G. a placeholder school id is rejected by the database itself ---- */
  ok('a non-uuid school id is a hard database error, never a silent query', await rejects(
    () => db.query(`select admit_student_atomic('*','Placeholder')`), /invalid input syntax for type uuid/i));

  await db.close();
  console.log(failures === 0
    ? '\nstudent_enrollment_workflow: all assertions passed'
    : `\nstudent_enrollment_workflow: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
