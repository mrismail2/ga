#!/usr/bin/env node
/* ============================================================
   Kobciye Phase 5 — identifier login (Student/Parent) DB tests

   The Edge Function itself (identifier-login) cannot run in pglite, so this
   exercises the SECURITY-DEFINER resolution/rate-limit/audit functions it
   calls, plus the login_code + is_primary rules, against the real migrations.
   The password check (anon signInWithPassword) is the ONE part that only a
   live GoTrue can do and is marked BLOCKED in the report — everything the
   database is responsible for is proven here.
   ============================================================ */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (n, c) => { console.log(c ? 'PASS' : 'FAIL', n); if (!c) failures += 1; };
const rejects = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(String(e && e.message)) : true; } };

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    -- service_role mirrors production: full table access + BYPASSRLS
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('myapp.test_uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
  `);
  const dir = path.join(__dirname, '..', 'migrations');
  for (const f of fs.readdirSync(dir).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8').replace(/create extension if not exists "pgcrypto";/g, ''));
  }
  const svc = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','',false)`); };
  const as = async (u, role = 'authenticated') => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','${u}',false)`); await db.exec(`set role ${role}`); };
  const asService = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','',false)`); await db.exec('set role service_role'); };
  const id = (d) => `${d.repeat(8)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(12)}`;
  const one = async (q, p) => (await db.query(q, p)).rows[0];

  const superId = id('1'), adminA = id('2'), adminB = id('3'),
    studentProfile = id('4'), parentProfile = id('5'), parent2Profile = id('6');

  await svc();
  for (const [u, e] of [[superId, 'root@t'], [adminA, 'a@t'], [adminB, 'b@t'],
    [studentProfile, 'student+x@students.kobciye.local'], [parentProfile, 'parent@real.test'], [parent2Profile, 'parent2@real.test']]) {
    await db.query('insert into auth.users (id,email) values ($1,$2)', [u, e]);
  }
  await db.query(`update profiles set role='super_admin' where id=$1`, [superId]);
  await as(superId);
  const schoolA = (await one(`select create_school_as_super_admin('A','id-a','A','${adminA}','school','secondary') id`)).id;
  const schoolB = (await one(`select create_school_as_super_admin('B','id-b','B','${adminB}','school','secondary') id`)).id;

  // ---- login codes were backfilled ----
  await svc();
  const codeA = (await one(`select login_code from schools where id='${schoolA}'`)).login_code;
  const codeB = (await one(`select login_code from schools where id='${schoolB}'`)).login_code;
  ok('every school got a public login_code (not the UUID)', !!codeA && codeA.startsWith('SCH-') && codeA !== schoolA);
  ok('login codes are unique across schools', codeA !== codeB);

  // ---- School A structure + a student with a linked primary parent ----
  await as(adminA);
  const year = (await one(`insert into academic_years (school_id,name,status) values ('${schoolA}','Y','active') returning id`)).id;
  const cls = (await one(`insert into classes (school_id,name,academic_year_id) values ('${schoolA}','Form 1','${year}') returning id`)).id;
  const admit = (await one(`select admit_student_atomic('${schoolA}','Arday A',null,null,null,'${cls}',null,'${year}',null,null,null,'Waalid A','+2521','parent@real.test','father') r`)).r;
  const studentRec = admit.student_id;
  const parentRec = admit.parent_id;
  const studentPublicId = (await one(`select student_id from students where id='${studentRec}'`)).student_id;

  // link the student + parents to auth profiles (as provisioning acceptance would).
  // the guardian guard requires the parent profile to be role=parent in the same
  // school, so set the profiles up first (this is what accept_account_invitation does).
  await svc();
  await db.query(`update profiles set role='student', school_id='${schoolA}' where id='${studentProfile}'`);
  await db.query(`update profiles set role='parent', school_id='${schoolA}' where id='${parentProfile}'`);
  await db.query(`update profiles set role='parent', school_id='${schoolA}' where id='${parent2Profile}'`);
  await db.query(`update students set profile_id='${studentProfile}' where id='${studentRec}'`);
  await db.query(`update parents set profile_id='${parentProfile}' where id='${parentRec}'`);
  await db.query(`update student_parents set parent_profile_id='${parentProfile}', is_primary=true where parent_id='${parentRec}' and student_id='${studentRec}'`);
  // a SECOND guardian, NOT primary
  const parent2 = (await one(`insert into parents (school_id,full_name,phone,profile_id) values ('${schoolA}','Waalid B','+2522','${parent2Profile}') returning id`)).id;
  await db.query(`insert into student_parents (parent_id,student_id,parent_profile_id,relationship,is_primary) values ('${parent2}','${studentRec}','${parent2Profile}','mother',false)`);

  // ============================================================
  // resolve_login_email — server-side (service role) only
  // ============================================================
  await asService();
  const studentEmail = (await one(`select resolve_login_email('${codeA}','${studentPublicId}','student') e`)).e;
  ok('student login resolves the student\'s own auth email',
    studentEmail === 'student+x@students.kobciye.local');
  const parentEmail = (await one(`select resolve_login_email('${codeA}','${studentPublicId}','parent') e`)).e;
  ok('parent child-id login resolves the PRIMARY parent email', parentEmail === 'parent@real.test');
  ok('parent login never resolves the non-primary guardian', parentEmail !== 'parent2@real.test');

  ok('wrong school code resolves nothing (no enumeration)',
    (await one(`select resolve_login_email('SCH-NOPE','${studentPublicId}','student') e`)).e === null);
  ok('wrong student id resolves nothing',
    (await one(`select resolve_login_email('${codeA}','HID-999999','student') e`)).e === null);
  ok('a student id from another school does not resolve under school A',
    (await one(`select resolve_login_email('${codeB}','${studentPublicId}','student') e`)).e === null);

  // student with no linked profile does not resolve (must be activated first)
  await as(adminA);
  const admit2 = (await one(`select admit_student_atomic('${schoolA}','Arday B',null,null,null,'${cls}',null,'${year}') r`)).r;
  const student2Public = (await one(`select student_id from students where id='${admit2.student_id}'`)).student_id;
  await asService();
  ok('an un-activated student (no profile) does not resolve',
    (await one(`select resolve_login_email('${codeA}','${student2Public}','student') e`)).e === null);

  // ============================================================
  // client roles may NOT call the resolver (no enumeration surface)
  // ============================================================
  await as(adminA);
  ok('a school admin (authenticated) may NOT call resolve_login_email',
    await rejects(() => db.query(`select resolve_login_email('${codeA}','${studentPublicId}','student')`), /permission denied|not.*exist|denied/i));

  // ============================================================
  // rate limiting + audit
  // ============================================================
  await asService();
  for (let i = 0; i < 4; i++) {
    await db.query(`select record_login_attempt('${codeA}','${studentPublicId}','student', false, '1.2.3.4')`);
  }
  ok('4 failures do not lock yet', (await one(`select is_login_locked('${codeA}','${studentPublicId}','student') l`)).l === false);
  await db.query(`select record_login_attempt('${codeA}','${studentPublicId}','student', false, '1.2.3.4')`);
  ok('5 failures within the window lock the identifier',
    (await one(`select is_login_locked('${codeA}','${studentPublicId}','student') l`)).l === true);
  ok('a DIFFERENT identifier is not locked by another\'s failures',
    (await one(`select is_login_locked('${codeA}','${student2Public}','student') l`)).l === false);
  ok('login attempts are audited (no password stored)',
    Number((await one(`select count(*) n from audit_logs where action like 'auth.identifier_login.%'`)).n) >= 5
    && Number((await one(`select count(*) n from login_attempts where identifier is not null`)).n) >= 5);

  // ============================================================
  // set_school_login_code — admin only, unique, validated
  // ============================================================
  await as(adminA);
  const newCode = (await one(`select set_school_login_code('${schoolA}','SCH-0042') c`)).c;
  ok('a school admin can set a friendly login code', newCode === 'SCH-0042');
  ok('a too-short code is rejected', await rejects(() => db.query(`select set_school_login_code('${schoolA}','AB')`), /at least 4/i));
  await as(adminB);
  ok('an admin cannot take another school\'s code', await rejects(() => db.query(`select set_school_login_code('${schoolB}','SCH-0042')`), /already in use/i));
  ok('a non-admin cannot set a login code for a school they don\'t run',
    await rejects(() => db.query(`select set_school_login_code('${schoolA}','SCH-9999')`), /only a school admin/i));

  // ============================================================
  // must_change_password flag
  // ============================================================
  await svc();
  await db.query(`update profiles set must_change_password=true where id='${studentProfile}'`);
  await as(studentProfile);
  await db.query(`select clear_must_change_password()`);
  await svc();
  ok('a user can clear their own must_change_password flag',
    (await one(`select must_change_password from profiles where id='${studentProfile}'`)).must_change_password === false);

  await db.close();
  console.log(failures === 0 ? '\nphase5_identifier_login: all assertions passed' : `\nphase5_identifier_login: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
