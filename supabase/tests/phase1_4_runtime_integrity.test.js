#!/usr/bin/env node
/* Kobciye Phase 1–4 final relational-integrity database tests.
   Applies every real migration to disposable PGlite; never touches remote DB. */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
let failures = 0;
const ok = (name, value) => { console.log(value ? 'PASS' : 'FAIL', name); if (!value) failures += 1; };
const rejects = async (fn, pattern) => { try { await fn(); return false; } catch (e) { return pattern.test(String(e && e.message)); } };

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
  const migrationDir = path.join(__dirname, '..', 'migrations');
  for (const file of fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
  }
  const id = (d) => `${d.repeat(8)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(12)}`;
  const root = id('1'), admin = id('2');
  const asService = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','',false)`); };
  const asClient = async (uid) => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','${uid}',false)`); await db.exec('set role authenticated'); };

  await asService();
  await db.query('insert into auth.users (id,email) values ($1,$2),($3,$4)', [root, 'root@test', admin, 'admin@test']);
  await db.query(`update profiles set role='super_admin' where id=$1`, [root]);
  await asClient(root);
  const school = (await db.query(`select create_school_as_super_admin('Integrity','integrity-school','Gabiley','${admin}','school','secondary') id`)).rows[0].id;
  await asClient(admin);
  const year1 = (await db.query(`insert into academic_years (school_id,name,status) values ($1,'2026/27','active') returning id`, [school])).rows[0].id;
  const year2 = (await db.query(`insert into academic_years (school_id,name,status) values ($1,'2027/28','archived') returning id`, [school])).rows[0].id;
  const class1 = (await db.query(`insert into classes (school_id,name,academic_year_id) values ($1,'Form 1A',$2) returning id`, [school, year1])).rows[0].id;
  const class2 = (await db.query(`insert into classes (school_id,name,academic_year_id) values ($1,'Form 2A',$2) returning id`, [school, year1])).rows[0].id;
  const stream1 = (await db.query(`insert into class_streams (school_id,class_id,name) values ($1,$2,'A') returning id`, [school, class1])).rows[0].id;
  const subject1 = (await db.query(`insert into subjects (school_id,name,class_id) values ($1,'Xisaab',$2) returning id`, [school, class1])).rows[0].id;
  const teacher = (await db.query(`insert into teachers (school_id,full_name) values ($1,'Macallin A') returning id`, [school])).rows[0].id;
  const term1 = (await db.query(`insert into terms (school_id,name,academic_year_id) values ($1,'Term 1',$2) returning id`, [school, year1])).rows[0].id;
  const term2 = (await db.query(`insert into terms (school_id,name,academic_year_id) values ($1,'Term X',$2) returning id`, [school, year2])).rows[0].id;

  const saved = (await db.query(`select save_student_with_enrollment_atomic($1,null,'Arday A',null,null,null,$2,$3,$4) r`, [school, class1, stream1, year1])).rows[0].r;
  ok('student editor RPC creates one active enrollment', Number((await db.query(`select count(*) n from student_enrollments where student_id=$1 and status='active'`, [saved.student_id])).rows[0].n) === 1);
  ok('student editor RPC creates no admission row', Number((await db.query(`select count(*) n from admissions where student_id=$1`, [saved.student_id])).rows[0].n) === 0);
  ok('active enrollment without class is rejected', await rejects(() => db.query(`insert into student_enrollments (school_id,student_id,academic_year_id,status) values ($1,$2,$3,'active')`, [school, saved.student_id, year1]), /requires a class/i));
  ok('active enrollment with wrong class year is rejected', await rejects(() => db.query(`select save_student_with_enrollment_atomic($1,$2,'Arday A',null,null,null,$3,null,$4)`, [school, saved.student_id, class1, year2]), /selected academic year/i));
  ok('stream from another class is rejected', await rejects(() => db.query(`select save_student_with_enrollment_atomic($1,$2,'Arday A',null,null,null,$3,$4,$5)`, [school, saved.student_id, class2, stream1, year1]), /selected class/i));

  ok('teacher assignment rejects class-scoped subject paired to another class', await rejects(() => db.query(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,academic_year_id) values ($1,$2,$3,$4,$5)`, [school, teacher, subject1, class2, year1]), /selected class/i));
  ok('teacher assignment rejects a stream from another class', await rejects(() => db.query(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,stream_id,academic_year_id) values ($1,$2,$3,$4,$5,$6)`, [school, teacher, subject1, class2, stream1, year1]), /selected class/i));
  ok('teacher assignment rejects term from another academic year', await rejects(() => db.query(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,academic_year_id,term_id) values ($1,$2,$3,$4,$5,$6)`, [school, teacher, subject1, class1, year1, term2]), /selected academic year/i));
  await db.query(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,stream_id,academic_year_id,term_id) values ($1,$2,$3,$4,$5,$6,$7)`, [school, teacher, subject1, class1, stream1, year1, term1]);
  ok('valid teacher assignment is accepted', Number((await db.query(`select count(*) n from teacher_assignments where teacher_id=$1`, [teacher])).rows[0].n) === 1);

  const moved = (await db.query(`select save_student_with_enrollment_atomic($1,$2,'Arday A',null,null,null,$3,null,$4) r`, [school, saved.student_id, class2, year1])).rows[0].r;
  ok('student transfer preserves old enrollment history', Number((await db.query(`select count(*) n from student_enrollments where student_id=$1`, [saved.student_id])).rows[0].n) === 2);
  ok('student transfer leaves exactly one active enrollment', Number((await db.query(`select count(*) n from student_enrollments where student_id=$1 and status='active'`, [saved.student_id])).rows[0].n) === 1 && !!moved.enrollment_id);

  const admission = (await db.query(`select admit_student_atomic($1,'Arday B',null,null,null,$2,null,$3) r`, [school, class1, year1])).rows[0].r;
  ok('enrolled admission is linked to a student', Number((await db.query(`select count(*) n from admissions where id=$1 and status='enrolled' and student_id is not null`, [admission.admission_id])).rows[0].n) === 1);
  ok('enrolled admission cannot be downgraded', await rejects(() => db.query(`update admissions set status='draft' where id=$1`, [admission.admission_id]), /cannot be downgraded/i));

  const guardianRetry1 = (await db.query(`select admit_student_atomic($1,'Arday C',null,null,null,$2,null,$3,null,null,null,'Waalid C','0630000000',null,'guardian',true) r`, [school, class1, year1])).rows[0].r;
  const guardianRetry2 = (await db.query(`select admit_student_atomic($1,'Arday C',null,null,null,$2,null,$3,$4,$5,null,'Waalid C','0630000000','waalid@test','father',true) r`, [school, class1, year1, guardianRetry1.admission_id, guardianRetry1.student_id])).rows[0].r;
  ok('guardian retry reuses the same parent and link', guardianRetry1.parent_id === guardianRetry2.parent_id && guardianRetry1.link_id === guardianRetry2.link_id);
  ok('guardian retry creates no duplicate parent or link',
    Number((await db.query(`select count(*) n from parents where school_id=$1 and phone='0630000000'`, [school])).rows[0].n) === 1
    && Number((await db.query(`select count(*) n from student_parents where student_id=$1`, [guardianRetry1.student_id])).rows[0].n) === 1);
  ok('guardian retry updates relationship/email and keeps a primary link',
    (await db.query(`select sp.relationship,sp.is_primary,p.email from student_parents sp join parents p on p.id=sp.parent_id where sp.id=$1`, [guardianRetry1.link_id])).rows[0].relationship === 'father'
    && (await db.query(`select sp.relationship,sp.is_primary,p.email from student_parents sp join parents p on p.id=sp.parent_id where sp.id=$1`, [guardianRetry1.link_id])).rows[0].is_primary === true
    && (await db.query(`select sp.relationship,sp.is_primary,p.email from student_parents sp join parents p on p.id=sp.parent_id where sp.id=$1`, [guardianRetry1.link_id])).rows[0].email === 'waalid@test');

  await db.close();
  console.log(failures === 0 ? '\nphase1_4_runtime_integrity: all assertions passed' : `\nphase1_4_runtime_integrity: ${failures} FAILED`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
