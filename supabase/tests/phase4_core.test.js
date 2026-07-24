#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 4 core-management test suite

   Applies every migration in supabase/migrations/ (including the two new
   Phase 4 ones) to a real disposable Postgres (pglite) and proves the
   Phase 4 requirements with real SQL under the `authenticated` role, the
   same way security.test.js does:

     - super_admin can create records for any school
     - school_admin manages ONLY their own school's Phase 4 rows
     - cross-school reads/writes are blocked on every new table
     - a school admin cannot touch university tables; a university admin
       cannot touch school-section tables
     - duplicate codes (class/subject/course) are rejected per school but
       allowed across schools; admission numbers unique per school
     - date validation on academic years / terms / semesters
     - conservative Phase 4 posture: teachers read, never write; anon: nothing

   Run:  cd supabase/tests && node phase4_core.test.js
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
    console.log('applied', f);
  }
  console.log('');

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
  const writeIsBlocked = async (sql) => {
    try {
      const res = await db.query(sql);
      return (res.affectedRows ?? 0) === 0;
    } catch (e) { return true; }
  };
  const throws = async (fn) => {
    try { await fn(); return false; } catch (e) { return true; }
  };

  // ============================================================
  // Seed: super admin, two schools (A: primary_middle, B: secondary),
  // two universities (U, U2), one teacher in A — via the sanctioned paths.
  // ============================================================
  await asService();
  const mk = (n) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`;
  const superId = mk(1), a1 = mk(2), b1 = mk(3), un1 = mk(4), un2 = mk(5), t1 = mk(6);
  for (const [id, email] of [[superId, 'root@x.com'], [a1, 'a@x.com'], [b1, 'b@x.com'], [un1, 'u1@x.com'], [un2, 'u2@x.com'], [t1, 't@x.com']]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('P4 School A', 'p4-school-a', 'Gabiley', '${a1}', 'school', 'primary_middle') as id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('P4 School B', 'p4-school-b', 'Hargeisa', '${b1}', 'school', 'secondary') as id`)).rows[0].id;
  const uniU   = (await db.query(`select create_school_as_super_admin('P4 Uni U', 'p4-uni-u', 'Gabiley', '${un1}', 'university', null) as id`)).rows[0].id;
  const uniU2  = (await db.query(`select create_school_as_super_admin('P4 Uni U2', 'p4-uni-u2', 'Borama', '${un2}', 'university', null) as id`)).rows[0].id;
  await asClient(a1);
  await db.exec(`select assign_role('${t1}', 'teacher', '${schoolA}')`);

  let r;

  // ============================================================
  // 1. super_admin can create records for any school
  // ============================================================
  await asClient(superId);
  r = await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', 'SA 2026/27', '2026-09-01', '2027-06-30') returning id`);
  ok('1. super_admin creates an academic year for school A', r.rows.length === 1);
  r = await db.query(`insert into school_sections (school_id, name, level_type) values ('${schoolB}', 'Sare', 'secondary') returning id`);
  ok('1b. super_admin creates a school section for school B', r.rows.length === 1);
  r = await db.query(`insert into faculties (school_id, name) values ('${uniU}', 'SA Faculty') returning id`);
  ok('1c. super_admin creates a faculty for university U', r.rows.length === 1);

  // ============================================================
  // 2. school_admin: academic years only for own school
  // ============================================================
  await asClient(a1);
  r = await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', '2026/2027', '2026-09-01', '2027-06-30') returning id`);
  const yearA = r.rows[0].id;
  ok('2. school_admin creates academic year for own school', !!yearA);
  ok('2b. school_admin cannot create academic year for another school',
    await writeIsBlocked(`insert into academic_years (school_id, name) values ('${schoolB}', 'Evil Year')`));

  // ============================================================
  // 3/4. cross-school classes & students invisible/unwritable
  // ============================================================
  await asClient(b1);
  const yearB = (await db.query(`insert into academic_years (school_id, name) values ('${schoolB}', '2026/2027') returning id`)).rows[0].id;
  const classB = (await db.query(`insert into classes (school_id, name, code, academic_year_id) values ('${schoolB}', 'Form 1', 'F1', '${yearB}') returning id`)).rows[0].id;
  await db.query(`insert into students (school_id, full_name, admission_number, class_id) values ('${schoolB}', 'B Student', 'ADM-001', '${classB}')`);

  await asClient(a1);
  ok('3. school_admin cannot create a class for another school',
    await writeIsBlocked(`insert into classes (school_id, name) values ('${schoolB}', 'Evil Class')`));
  r = await db.query(`select * from classes where school_id = '${schoolB}'`);
  ok('3b. school_admin cannot read another school\'s classes', r.rows.length === 0);
  r = await db.query(`select * from students where school_id = '${schoolB}'`);
  ok('4. school_admin cannot read another school\'s students', r.rows.length === 0);

  // ============================================================
  // 5. university admin cannot read another university's students
  // ============================================================
  await asClient(un2);
  await db.query(`insert into university_students (school_id, full_name, student_code, admission_number) values ('${uniU2}', 'U2 Student', 'U2-001', 'U2-ADM-1')`);
  await asClient(un1);
  r = await db.query(`select * from university_students where school_id = '${uniU2}'`);
  ok('5. university admin cannot read another university\'s students', r.rows.length === 0);
  ok('5b. university admin cannot write another university\'s students',
    await writeIsBlocked(`insert into university_students (school_id, full_name) values ('${uniU2}', 'Evil')`));

  // ============================================================
  // 6. RLS blocks cross-school access on ALL new tables
  // ============================================================
  await asClient(a1);
  const crossSchool = [
    `insert into school_sections (school_id, name, level_type) values ('${schoolB}', 'X', 'primary')`,
    `insert into class_streams (school_id, class_id, name) values ('${schoolB}', '${classB}', 'X')`,
    `insert into admissions (school_id, applicant_name) values ('${schoolB}', 'X')`,
    `insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id)
       values ('${schoolB}', gen_random_uuid(), gen_random_uuid(), '${classB}', '${yearB}')`,
  ];
  let allBlocked = true;
  for (const sql of crossSchool) { if (!(await writeIsBlocked(sql))) allBlocked = false; }
  ok('6. cross-school writes blocked on new school tables', allBlocked);

  await asClient(un1);
  const crossUni = [
    `insert into faculties (school_id, name) values ('${uniU2}', 'X')`,
    `insert into departments (school_id, name) values ('${uniU2}', 'X')`,
    `insert into programmes (school_id, name) values ('${uniU2}', 'X')`,
    `insert into courses (school_id, name) values ('${uniU2}', 'X')`,
    `insert into lecturers (school_id, full_name) values ('${uniU2}', 'X')`,
  ];
  allBlocked = true;
  for (const sql of crossUni) { if (!(await writeIsBlocked(sql))) allBlocked = false; }
  ok('6b. cross-university writes blocked on new university tables', allBlocked);

  // ============================================================
  // institution isolation: school admin ↔ university tables
  // ============================================================
  await asClient(a1);
  ok('6c. SCHOOL admin cannot create faculties even for their own school_id',
    await writeIsBlocked(`insert into faculties (school_id, name) values ('${schoolA}', 'Evil Faculty')`));
  ok('6d. SCHOOL admin cannot create university_students for their school_id',
    await writeIsBlocked(`insert into university_students (school_id, full_name) values ('${schoolA}', 'Evil')`));
  await asClient(un1);
  ok('6e. UNIVERSITY admin cannot create school_sections for their university',
    await writeIsBlocked(`insert into school_sections (school_id, name, level_type) values ('${uniU}', 'Evil', 'primary')`));
  ok('6f. UNIVERSITY admin cannot create class_streams for their university',
    await writeIsBlocked(`insert into class_streams (school_id, class_id, name) values ('${uniU}', '${classB}', 'Evil')`));

  // ============================================================
  // 7/8. class code duplicates: rejected in-school, allowed cross-school
  // ============================================================
  await asClient(a1);
  const sectionA = (await db.query(`insert into school_sections (school_id, name, level_type) values ('${schoolA}', 'Hoose', 'primary') returning id`)).rows[0].id;
  const classA = (await db.query(`insert into classes (school_id, name, code, school_section_id, academic_year_id) values ('${schoolA}', 'Grade 1', 'G1', '${sectionA}', '${yearA}') returning id`)).rows[0].id;
  ok('7. duplicate class code within same school rejected',
    await throws(() => db.query(`insert into classes (school_id, name, code) values ('${schoolA}', 'Grade One Copy', 'g1')`)));
  await asClient(b1);
  r = await db.query(`insert into classes (school_id, name, code) values ('${schoolB}', 'Grade 1B', 'G1') returning id`);
  ok('8. same class code in a different school allowed', r.rows.length === 1);

  // ============================================================
  // 9. admission number unique per school (allowed across schools)
  // ============================================================
  await asClient(a1);
  r = await db.query(`insert into students (school_id, full_name, admission_number, class_id) values ('${schoolA}', 'A Student', 'ADM-001', '${classA}') returning id`);
  ok('9. school A can reuse an admission number school B used', r.rows.length === 1);
  ok('9b. duplicate admission number within school A rejected',
    await throws(() => db.query(`insert into students (school_id, full_name, admission_number) values ('${schoolA}', 'A Student 2', 'ADM-001')`)));

  // ============================================================
  // 10. date validation (years / terms / semesters)
  // ============================================================
  ok('10. academic year with end before start rejected',
    await throws(() => db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${schoolA}', 'Bad Year', '2027-01-01', '2026-01-01')`)));
  ok('10b. term with end before start rejected',
    await throws(() => db.query(`insert into terms (school_id, name, academic_year_id, starts_on, ends_on) values ('${schoolA}', 'Bad Term', '${yearA}', '2027-01-01', '2026-01-01')`)));

  // ============================================================
  // 11-13. school mode CRUD: sections/classes/streams/subjects/students/guardians
  // ============================================================
  r = await db.query(`insert into terms (school_id, name, academic_year_id, starts_on, ends_on) values ('${schoolA}', 'Term 1', '${yearA}', '2026-09-01', '2026-12-15') returning id`);
  ok('11. primary_middle school creates a term', r.rows.length === 1);
  const streamA = (await db.query(`insert into class_streams (school_id, class_id, name, code) values ('${schoolA}', '${classA}', 'A', 'G1A') returning id`)).rows[0].id;
  ok('11b. primary_middle school creates a stream', !!streamA);
  const subjA = (await db.query(`insert into subjects (school_id, name, code, class_id) values ('${schoolA}', 'Xisaab', 'MATH', '${classA}') returning id`)).rows[0].id;
  ok('11c. primary_middle school creates a subject with code', !!subjA);
  ok('11d. duplicate subject code within school rejected',
    await throws(() => db.query(`insert into subjects (school_id, name, code) values ('${schoolA}', 'Xisaab 2', 'math')`)));
  const guardianA = (await db.query(`insert into parents (school_id, full_name, phone, email) values ('${schoolA}', 'Guardian One', '+252634442211', 'g1@x.com') returning id`)).rows[0].id;
  ok('11e. school creates a guardian', !!guardianA);
  const studentA = (await db.query(`select id from students where school_id = '${schoolA}' and admission_number = 'ADM-001'`)).rows[0].id;
  r = await db.query(`insert into student_parents (parent_profile_id, student_id, parent_id, relationship, is_primary) values ('${a1}', '${studentA}', '${guardianA}', 'aabo', true) returning student_id`);
  ok('11f. student linked to guardian with relationship metadata', r.rows.length === 1);
  r = await db.query(`insert into admissions (school_id, applicant_name, guardian_name, guardian_phone, desired_class_id, status) values ('${schoolA}', 'New Applicant', 'G', '+252633334444', '${classA}', 'pending') returning id`);
  ok('11g. school creates an admission application', r.rows.length === 1);

  await asClient(b1);
  const classB2 = (await db.query(`insert into classes (school_id, name, code) values ('${schoolB}', 'Form 2', 'F2') returning id`)).rows[0].id;
  r = await db.query(`insert into class_streams (school_id, class_id, name) values ('${schoolB}', '${classB2}', 'B') returning id`);
  ok('13. secondary school creates forms/streams (same tables, same shell)', r.rows.length === 1);

  // teacher assignment foundation
  await asClient(a1);
  const teacherRowA = (await db.query(`insert into teachers (school_id, full_name, email) values ('${schoolA}', 'Teacher A', 'ta@x.com') returning id`)).rows[0].id;
  r = await db.query(`insert into teacher_assignments (school_id, teacher_id, subject_id, class_id, stream_id, academic_year_id) values ('${schoolA}', '${teacherRowA}', '${subjA}', '${classA}', '${streamA}', '${yearA}') returning id`);
  ok('12b. teacher-subject-class-stream-year assignment created', r.rows.length === 1);
  ok('12c. cross-school guard: stream from another school rejected inside own row',
    await throws(() => db.query(`insert into class_streams (school_id, class_id, name) values ('${schoolA}', '${classB}', 'Evil')`)));

  // conservative posture: teacher reads, never writes
  await asClient(t1);
  r = await db.query(`select * from school_sections where school_id = '${schoolA}'`);
  ok('14a. teacher can read own school\'s sections', r.rows.length >= 1);
  ok('14b. teacher cannot create sections',
    await writeIsBlocked(`insert into school_sections (school_id, name, level_type) values ('${schoolA}', 'T Evil', 'primary')`));
  ok('14c. teacher cannot create admissions',
    await writeIsBlocked(`insert into admissions (school_id, applicant_name) values ('${schoolA}', 'T Evil')`));

  // ============================================================
  // 16-21. university mode CRUD
  // ============================================================
  await asClient(un1);
  const facU = (await db.query(`insert into faculties (school_id, name, code) values ('${uniU}', 'Kulliyadda Caafimaadka', 'MED') returning id`)).rows[0].id;
  ok('16. university creates a faculty', !!facU);
  const depU = (await db.query(`insert into departments (school_id, faculty_id, name, code) values ('${uniU}', '${facU}', 'Public Health', 'PH') returning id`)).rows[0].id;
  ok('17. university creates a department', !!depU);
  const progU = (await db.query(`insert into programmes (school_id, department_id, name, code, degree_level, duration_years) values ('${uniU}', '${depU}', 'BSc Public Health', 'BPH', 'bachelor', 4) returning id`)).rows[0].id;
  ok('18. university creates a programme', !!progU);
  const uYear = (await db.query(`insert into academic_years (school_id, name, starts_on, ends_on) values ('${uniU}', '2026/2027', '2026-09-01', '2027-08-31') returning id`)).rows[0].id;
  const semU = (await db.query(`insert into semesters (school_id, academic_year_id, name, starts_on, ends_on) values ('${uniU}', '${uYear}', 'Semester 1', '2026-09-01', '2027-01-15') returning id`)).rows[0].id;
  ok('19. university creates a semester under the (reused) academic year', !!semU);
  ok('19b. semester with end before start rejected',
    await throws(() => db.query(`insert into semesters (school_id, academic_year_id, name, starts_on, ends_on) values ('${uniU}', '${uYear}', 'Bad Sem', '2027-01-01', '2026-01-01')`)));
  const courseU = (await db.query(`insert into courses (school_id, programme_id, department_id, name, code, credit_hours, level_year, semester_number) values ('${uniU}', '${progU}', '${depU}', 'Intro to Epidemiology', 'PH101', 3, 1, 1) returning id`)).rows[0].id;
  ok('20. university creates a course', !!courseU);
  ok('20b. duplicate course code within same university rejected',
    await throws(() => db.query(`insert into courses (school_id, name, code) values ('${uniU}', 'Copy', 'ph101')`)));
  r = await db.query(`insert into lecturers (school_id, full_name, email, department_id) values ('${uniU}', 'Dr. Lecturer', 'dr@x.com', '${depU}') returning id`);
  ok('20c. university creates a lecturer', r.rows.length === 1);
  r = await db.query(`insert into university_students (school_id, full_name, student_code, admission_number, programme_id, cohort, level_year) values ('${uniU}', 'Uni Student', 'STU-001', 'UADM-1', '${progU}', '2026', 1) returning id`);
  ok('21. university creates a university student', r.rows.length === 1);
  ok('21b. duplicate university student code rejected',
    await throws(() => db.query(`insert into university_students (school_id, full_name, student_code) values ('${uniU}', 'Copy', 'stu-001')`)));
  r = await db.query(`insert into admissions (school_id, applicant_name, status) values ('${uniU}', 'Uni Applicant', 'pending') returning id`);
  ok('21c. admissions pipeline intentionally shared: university creates an application', r.rows.length === 1);
  ok('21d. ...but never across universities',
    await writeIsBlocked(`insert into admissions (school_id, applicant_name) values ('${uniU2}', 'Evil')`));

  // ============================================================
  // anon gets nothing anywhere
  // ============================================================
  await asAnon();
  const anonBlocked = [];
  for (const t of ['school_sections', 'class_streams', 'teacher_assignments', 'admissions',
    'faculties', 'departments', 'programmes', 'semesters', 'courses', 'lecturers', 'university_students']) {
    anonBlocked.push(await throws(() => db.query(`select * from ${t}`)));
  }
  ok('anon cannot read any Phase 4 table', anonBlocked.every(Boolean));

  console.log('');
  if (failures) { console.error(`phase4_core FAILED with ${failures} issue(s)`); process.exit(1); }
  console.log('phase4_core PASSED — Phase 4 school & university core with RLS isolation holds ✓');
})().catch((e) => { console.error(e); process.exit(1); });
