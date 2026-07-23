#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 2 security test suite

   Applies every migration in supabase/migrations/ to a real, disposable
   Postgres instance (via @electric-sql/pglite — an in-process Postgres, not
   a mock/stub) and then attacks the exact things the security review
   flagged: privilege escalation via signup metadata, self-service role
   writes, admin bypass of assign_role(), unsanctioned school provisioning,
   cross-school data leakage, and direct execution of a SECURITY DEFINER
   function that should be unreachable. Every assertion is a real SQL
   statement expected to succeed or fail — nothing here is asserted from
   documentation.

   IMPORTANT: all "as a logged-in user" operations run as Postgres role
   `authenticated` (via SET ROLE), exactly like a real Supabase/PostgREST
   request — NOT as the pglite superuser. Row Level Security does not
   apply to a table's owner/superuser, so testing under the default
   superuser session would make every RLS policy look like it passes even
   when it doesn't. `asService()` drops back to superuser only for the
   handful of things a real client can never do (seeding auth.users, the
   way Supabase's own auth service does it outside PostgREST; bootstrapping
   the very first super_admin from the SQL Editor).

   Run:
     cd supabase/tests
     npm install
     npm test
   (or: node security.test.js  after `npm install` once)

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

  // ---- mock the Supabase-managed schemas/roles the migrations reference.
  // Supabase pre-grants table DML + function EXECUTE to anon/authenticated
  // by default (ALTER DEFAULT PRIVILEGES set at project bootstrap) — we
  // reproduce that here, applied BEFORE the migrations run, so it covers
  // every table/function the migrations go on to create. This means the
  // revoke statements in migrations 0007/0008 are tested against the real
  // starting condition, not a clean slate that would pass trivially. ----
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
    let sql = fs.readFileSync(path.join(dir, f), 'utf8')
      .replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
    console.log('applied', f);
  }
  console.log('');

  // ---- role helpers ----
  // asClient: the normal operating mode — Postgres role `authenticated`
  // (so RLS actually applies) with auth.uid() faked via a session GUC.
  const asClient = async (uid) => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '${uid || ''}', false)`);
    await db.exec('set role authenticated');
  };
  // asAnon: Postgres role `anon`, no session (matches an unauthenticated
  // request — auth.uid() is null).
  const asAnon = async () => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '', false)`);
    await db.exec('set role anon');
  };
  // asService: the pglite superuser — the only role that can seed
  // auth.users (what Supabase's own auth service does, outside PostgREST)
  // or bootstrap the very first super_admin from the SQL Editor.
  const asService = async () => {
    await db.exec('reset role');
    await db.exec(`select set_config('myapp.test_uid', '', false)`);
  };

  // RLS silently filters rows a policy doesn't cover — an UPDATE/DELETE
  // with no matching permissive policy affects 0 rows rather than raising
  // an exception. "Blocked" therefore means: it either throws, or it
  // succeeds while touching nothing.
  const writeIsBlocked = async (sql) => {
    try {
      const res = await db.query(sql);
      return (res.affectedRows ?? 0) === 0;
    } catch (e) {
      return true;
    }
  };
  const throws = async (fn) => {
    try { await fn(); return false; } catch (e) { return true; }
  };

  // ============================================================
  // 1. signup metadata cannot grant super_admin or school_admin
  // ============================================================
  await asService();
  const u1 = '11111111-1111-1111-1111-111111111111';
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'evil@x.com', '{"role":"super_admin","school_id":"22222222-2222-2222-2222-222222222222","full_name":"Evil"}'::jsonb)`,
    [u1]
  );
  let r = await db.query('select role, school_id, full_name from profiles where id = $1', [u1]);
  ok('signup metadata role=super_admin ignored -> pending, no school', r.rows[0].role === 'pending' && r.rows[0].school_id === null);
  ok('signup metadata full_name still copied (harmless field)', r.rows[0].full_name === 'Evil');

  const u1b = '66666666-6666-6666-6666-666666666666';
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'evil2@x.com', '{"role":"school_admin","full_name":"Evil2"}'::jsonb)`,
    [u1b]
  );
  r = await db.query('select role from profiles where id = $1', [u1b]);
  ok('signup metadata role=school_admin ignored -> pending', r.rows[0].role === 'pending');

  // ============================================================
  // 2. a normal (client-role) user cannot change role, school_id,
  //    created_at, or updated_at — allow-list, not deny-list
  // ============================================================
  await asClient(u1);
  ok('self UPDATE role=super_admin blocked',
    await throws(() => db.exec(`update profiles set role = 'super_admin' where id = '${u1}'`)));

  ok('self UPDATE school_id blocked',
    await throws(() => db.exec(`update profiles set school_id = '22222222-2222-2222-2222-222222222222' where id = '${u1}'`)));

  ok('self UPDATE created_at blocked',
    await throws(() => db.exec(`update profiles set created_at = '2000-01-01' where id = '${u1}'`)));

  ok('self UPDATE updated_at (manual) blocked',
    await throws(() => db.exec(`update profiles set updated_at = '2000-01-01' where id = '${u1}'`)));

  ok('self UPDATE id blocked',
    await throws(() => db.exec(`update profiles set id = '99999999-9999-9999-9999-999999999999' where id = '${u1}'`)));

  // ============================================================
  // safe profile updates still work, and updated_at still bumps
  // automatically (via the separate, untouched profiles_updated_at trigger)
  // ============================================================
  const before = (await db.query('select updated_at from profiles where id = $1', [u1])).rows[0].updated_at;
  await new Promise((res) => setTimeout(res, 5));
  await db.exec(`update profiles set full_name = 'Renamed', phone = '+252600000000' where id = '${u1}'`);
  r = await db.query('select full_name, phone, updated_at from profiles where id = $1', [u1]);
  ok('self UPDATE of full_name/phone still allowed', r.rows[0].full_name === 'Renamed' && r.rows[0].phone === '+252600000000');
  ok('updated_at still auto-bumps on a legitimate update (via the separate trigger)', new Date(r.rows[0].updated_at) > new Date(before));

  // ============================================================
  // 3. school provisioning is super_admin-only now
  // ============================================================

  // the OLD self-service path is fully disabled for every client role
  ok('pending user cannot call the old self-service provision_school() (EXECUTE revoked)',
    await throws(() => db.query(`select provision_school('Sneaky School', 'sneaky-school')`)));

  // a non-super_admin cannot create a school at all
  ok('pending user cannot call create_school_as_super_admin()',
    await throws(() => db.query(
      `select create_school_as_super_admin('X', 'x-slug', null, '${u1}')`
    )));

  // bootstrap the platform's first super_admin the documented way: a
  // no-JWT session (SQL Editor / service role)
  await asService();
  const superId = '77777777-7777-7777-7777-777777777777';
  await db.query(`insert into auth.users (id, email) values ($1, 'root@x.com')`, [superId]);
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [superId]);

  // super_admin creates School A and assigns the still-pending u1 as its
  // first school_admin
  await asClient(superId);
  const schoolA = (await db.query(
    `select create_school_as_super_admin('School A', 'school-a', 'Gabiley', '${u1}', 'school', 'primary_middle') as id`
  )).rows[0].id;

  r = await db.query('select role, school_id from profiles where id = $1', [u1]);
  ok('super_admin can securely assign a pending user as the first school_admin', r.rows[0].role === 'school_admin' && r.rows[0].school_id === schoolA);

  r = await db.query('select * from subscriptions where school_id = $1', [schoolA]);
  ok('create_school_as_super_admin creates a trial subscription', r.rows.length === 1 && r.rows[0].status === 'trialing');

  r = await db.query(`select * from audit_logs where action = 'school.provision_by_super_admin' and entity_id = $1`, [schoolA]);
  ok('school creation by super_admin is audited', r.rows.length === 1 && r.rows[0].actor_id === superId);

  r = await db.query('select role from school_members where profile_id = $1 and school_id = $2', [u1, schoolA]);
  ok('school_members synced automatically for the new school_admin', r.rows[0]?.role === 'school_admin');

  // a school_admin (u1, freshly promoted) cannot create ANOTHER school
  await asClient(u1);
  ok('school_admin cannot create a school',
    await throws(() => db.query(`select create_school_as_super_admin('School A2', 'school-a2', null, '${u1}', 'school', 'primary_middle')`)));

  // super_admin cannot use the function to hand school_admin to a
  // non-pending / already-assigned profile
  await asClient(superId);
  ok('create_school_as_super_admin refuses a non-pending target',
    await throws(() => db.query(`select create_school_as_super_admin('School A3', 'school-a3', null, '${u1}', 'school', 'primary_middle')`)));

  // ============================================================
  // school_admin can assign_role within their own school (unchanged from
  // migrations 0006/0007 — re-verified here on top of the new provisioning
  // flow)
  // ============================================================
  await asService();
  const u2 = '33333333-3333-3333-3333-333333333333';
  await db.query(`insert into auth.users (id, email) values ($1, 'teacher@x.com')`, [u2]);

  await asClient(u1);
  await db.exec(`select assign_role('${u2}', 'teacher', '${schoolA}')`);
  r = await db.query('select role, school_id from profiles where id = $1', [u2]);
  ok('school_admin can assign_role within their own school', r.rows[0].role === 'teacher' && r.rows[0].school_id === schoolA);

  const assignAudit = await db.query(`select * from audit_logs where action = 'profile.assign_role' and entity_id = $1`, [u2]);
  ok('assign_role is audited', assignAudit.rows.length === 1);

  await asClient(u2);
  ok('a teacher cannot call assign_role on themself',
    await throws(() => db.exec(`select assign_role('${u2}', 'school_admin', '${schoolA}')`)));

  await asClient(u1);
  ok('school_admin cannot grant super_admin via assign_role',
    await throws(() => db.exec(`select assign_role('${u2}', 'super_admin', '${schoolA}')`)));

  // ============================================================
  // school_admin cannot bypass assign_role through a direct profiles UPDATE
  // ============================================================
  await asClient(u1); // u1 is school_admin of schoolA
  ok('school_admin cannot change ANOTHER profile.role via direct UPDATE (must use assign_role)',
    await throws(() => db.exec(`update profiles set role = 'accountant' where id = '${u2}'`)));

  await asService();
  const u3 = '44444444-4444-4444-4444-444444444444';
  await db.query(`insert into auth.users (id, email) values ($1, 'pending3@x.com')`, [u3]);

  await asClient(u1);
  ok('school_admin cannot change ANOTHER profile.school_id via direct UPDATE',
    await throws(() => db.exec(`update profiles set school_id = '${u3}' where id = '${u2}'`)));

  // school_members is fully system-managed — no client, admin included, may write it
  ok('school_admin cannot INSERT school_members directly',
    await throws(() => db.exec(`insert into school_members (school_id, profile_id, role) values ('${schoolA}', '${u2}', 'school_admin')`)));

  ok('school_admin cannot UPDATE school_members directly',
    await writeIsBlocked(`update school_members set role = 'school_admin' where profile_id = '${u2}'`));

  ok('school_admin cannot DELETE school_members directly',
    await writeIsBlocked(`delete from school_members where profile_id = '${u2}'`));

  await asService();
  r = await db.query(`select role from school_members where profile_id = $1 and school_id = $2`, [u2, schoolA]);
  ok('school_members was still correctly synced by the system trigger (role=teacher)', r.rows[0]?.role === 'teacher');

  // ============================================================
  // School B, created the same super_admin-verified way, with u3 as its
  // first school_admin — used for the cross-school tests below
  // ============================================================
  await asClient(superId);
  const schoolB = (await db.query(
    `select create_school_as_super_admin('School B', 'school-b', null, '${u3}', 'school', 'secondary') as id`
  )).rows[0].id;
  r = await db.query('select role, school_id from profiles where id = $1', [u3]);
  ok('School B provisioned the same super_admin-verified way', r.rows[0].role === 'school_admin' && r.rows[0].school_id === schoolB);

  // ============================================================
  // school_admin cannot modify another school
  // ============================================================
  await asClient(u1); // school_admin of A
  ok("school_admin of A cannot UPDATE school B's row",
    await writeIsBlocked(`update schools set name = 'Hacked' where id = '${schoolB}'`));

  ok('school_admin of A cannot assign_role into school B',
    await throws(() => db.exec(`select assign_role('${u3}', 'teacher', '${schoolB}')`)));

  ok('school_admin of A cannot INSERT a class into school B (RLS)',
    await throws(() => db.exec(`insert into classes (school_id, name) values ('${schoolB}', 'Intruder Class')`)));

  // ============================================================
  // public/anon cannot call next_student_id directly
  // ============================================================
  await asAnon();
  ok('anon role cannot call next_student_id() directly (EXECUTE revoked)',
    await throws(() => db.query('select next_student_id($1)', [schoolA])));

  await asClient(u1);
  ok('authenticated role cannot call next_student_id() directly (EXECUTE revoked)',
    await throws(() => db.query('select next_student_id($1)', [schoolA])));

  // it still works from INSIDE the trigger (i.e. normal student creation)
  const classA = (await db.query(`insert into classes (school_id, name) values ($1, 'Form 1A') returning id`, [schoolA])).rows[0].id;
  const studentA = (await db.query(`insert into students (school_id, full_name, class_id) values ($1, 'S. A', '${classA}') returning id`, [schoolA])).rows[0].id;
  const idRow = await db.query('select student_id from students where id = $1', [studentA]);
  ok('next_student_id still works internally via the insert trigger (HID-### format)', /^HID-\d{3}$/.test(idRow.rows[0].student_id));

  // RLS helper functions must still be callable as anon/authenticated (RLS depends on them)
  let helpersOk = true;
  try { await db.query('select my_role(), my_school(), is_admin_of($1)', [schoolA]); }
  catch (e) { helpersOk = false; }
  ok('RLS helper functions (my_role/my_school/is_admin_of) remain callable by authenticated', helpersOk);

  // ============================================================
  // cross-school relationship inserts are rejected
  // ============================================================
  const subjA = (await db.query(`insert into subjects (school_id, name) values ($1, 'Xisaab') returning id`, [schoolA])).rows[0].id;

  await asClient(u3); // school_admin of B creates B's own subject
  const subjB = (await db.query(`insert into subjects (school_id, name) values ($1, 'Xisaab') returning id`, [schoolB])).rows[0].id;
  const classB = (await db.query(`insert into classes (school_id, name) values ($1, 'Form 1B') returning id`, [schoolB])).rows[0].id;
  const teacherB = (await db.query(`insert into teachers (school_id, full_name) values ($1, 'T. B') returning id`, [schoolB])).rows[0].id;
  const studentB = (await db.query(`insert into students (school_id, full_name) values ($1, 'S. B') returning id`, [schoolB])).rows[0].id;
  const examB = (await db.query(`insert into exams (school_id, class_id, subject_id, title) values ($1, '${classB}', '${subjB}', 'X') returning id`, [schoolB])).rows[0].id;

  // super_admin is used for the deliberately cross-school INSERT attempts
  // below (a school_admin would already be blocked by RLS row-scoping
  // before the trigger even runs — these prove the TRIGGER itself, not
  // just RLS, refuses cross-school data).
  await asClient(superId);

  ok('class_subjects rejects a cross-school pair',
    await throws(() => db.exec(`insert into class_subjects (class_id, subject_id) values ('${classA}', '${subjB}')`)));

  let notBlocked = true;
  try { await db.exec(`insert into class_subjects (class_id, subject_id) values ('${classA}', '${subjA}')`); } catch (e) { notBlocked = false; }
  ok('class_subjects allows a same-school pair (positive control)', notBlocked);

  ok('teacher_classes rejects a cross-school pair',
    await throws(() => db.exec(`insert into teacher_classes (teacher_id, class_id) values ('${teacherB}', '${classA}')`)));

  ok('a student cannot be assigned a class from another school',
    await throws(() => db.exec(`update students set class_id = '${classA}' where id = '${studentB}'`)));

  ok('results rejects an exam from another school',
    await throws(() => db.exec(`insert into results (school_id, exam_id, student_id, score) values ('${schoolA}', '${examB}', '${studentA}', 80)`)));

  ok('attendance rejects a class from another school',
    await throws(() => db.exec(`insert into attendance (school_id, class_id, student_id) values ('${schoolB}', '${classA}', '${studentA}')`)));

  await asService();
  const uParent = '55555555-5555-5555-5555-555555555555';
  await db.query(`insert into auth.users (id, email) values ($1, 'parent@x.com')`, [uParent]);
  await asClient(u3); // school_admin of B assigns a parent within B
  await db.exec(`select assign_role('${uParent}', 'parent', '${schoolB}')`);
  await asClient(superId);
  ok('student_parents rejects a parent from another school',
    await throws(() => db.exec(`insert into student_parents (parent_profile_id, student_id) values ('${uParent}', '${studentA}')`)));

  // ============================================================
  // RLS remains enabled on all protected tables
  // ============================================================
  await asService();
  const expectedTables = [
    'schools', 'profiles', 'subjects', 'classes', 'class_subjects', 'teachers',
    'teacher_classes', 'teacher_subjects', 'students', 'student_parents', 'terms',
    'exam_windows', 'exams', 'results', 'attendance', 'payments', 'billing_records',
    'incidents', 'messages', 'notices', 'grading_rules', 'academic_years',
    'school_members', 'subscriptions', 'audit_logs', 'parents', 'staff',
  ];
  const rlsRows = await db.query(`
    select relname, relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and relkind = 'r' and relname = any($1)
  `, [expectedTables]);
  const rlsMap = Object.fromEntries(rlsRows.rows.map((x) => [x.relname, x.relrowsecurity]));
  const missing = expectedTables.filter((t) => !(t in rlsMap));
  const disabled = expectedTables.filter((t) => rlsMap[t] === false);
  ok(`all ${expectedTables.length} protected tables exist`, missing.length === 0);
  ok('RLS is enabled on every one of them', disabled.length === 0);
  if (missing.length) console.log('  missing tables:', missing);
  if (disabled.length) console.log('  RLS disabled on:', disabled);

  // ============================================================
  // sanity: standardized role enum
  // ============================================================
  const enumVals = (await db.query(`select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' order by enumsortorder`)).rows.map((x) => x.enumlabel);
  ok('user_role enum is the standardized set', JSON.stringify(enumVals) === JSON.stringify(['super_admin', 'school_admin', 'teacher', 'accountant', 'parent', 'student', 'pending']));

  console.log('');
  console.log(`${failures === 0 ? 'All' : failures} assertion(s) ${failures === 0 ? 'passed.' : 'FAILED'}`);
  if (failures > 0) process.exit(1);
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
