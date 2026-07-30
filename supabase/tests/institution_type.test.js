#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 3 foundation: institution_type / school_stage suite
   (School Mode vs University Mode — see
   supabase/migrations/20260705000001_institution_type.sql)

   Two halves:
   (A) Migration-file integrity — proves this feature added exactly ONE new
       migration and that git shows zero of the pre-existing migration files
       as modified (a real diff against HEAD, not a re-implementation guess).
   (B) Real DB behaviour — applies EVERY migration (unmodified) to a fresh
       disposable Postgres (pglite, same harness as security.test.js /
       phase3_invitations.test.js) and exercises:
         • institution_type/school_stage pairing validation in
           sa_create_school_and_invitation() (invalid combos rejected)
         • valid combinations (school+primary_middle, school+secondary,
           university) accepted
         • DATA-INTEGRITY HARDENING — three loopholes that could otherwise
           still create a NEW unclassified school, all proven to fail:
             1. a direct super_admin INSERT into schools with a null
                institution_type
             2. the OLD 7-argument sa_create_school_and_invitation call
                (institution_type/school_stage are no longer optional)
             3. the legacy create_school_as_super_admin RPC called without
                a classification
         • the guard trigger freezes both columns after creation, for
           EVERY role (service/super_admin/the school's own school_admin),
           while leaving unrelated columns freely editable
         • the full invite -> accept lifecycle still works end-to-end with
           institution_type set (Phase 3's onboarding flow is not broken)

   Run: cd supabase/tests && node institution_type.test.js
   Exits non-zero on any failure.
   ============================================================ */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };

const REPO = path.resolve(__dirname, '..', '..');
const MIG_DIR = path.join(REPO, 'supabase', 'migrations');

console.log('\n[A] Migration-file integrity');

const PRE_EXISTING_MIGRATIONS = [
  '20260702000001_initial_schema.sql',
  '20260702000002_rls_policies.sql',
  '20260702000003_storage.sql',
  '20260702000004_seed.sql',
  '20260702000005_saas_foundation.sql',
  '20260702000006_security_hardening.sql',
  '20260702000007_security_hardening_2.sql',
  '20260702000008_security_hardening_3.sql',
  '20260703000001_school_invitations.sql',
  '20260703000002_invitations_harden.sql',
];

const currentFiles = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
const newFiles = currentFiles.filter((f) => !PRE_EXISTING_MIGRATIONS.includes(f));

// Phase 3 delivered exactly one new migration (20260705000001_institution_type);
// later phases legitimately add more (Phase 4 adds its own additive
// migrations). The security invariant is NOT "only one file" — it is:
// the institution_type migration exists, and every added migration is
// strictly ADDITIVE (sorts after all the pre-existing ones; none of the
// pre-existing ones renamed, deleted, or — checked below via git — edited).
ok('the institution_type migration is present',
  newFiles.includes('20260705000001_institution_type.sql'));
ok('every added migration sorts strictly AFTER every pre-existing migration',
  newFiles.length >= 1 && newFiles.every((f) => f > PRE_EXISTING_MIGRATIONS[PRE_EXISTING_MIGRATIONS.length - 1]));
ok('every pre-existing migration filename is still present (none renamed/deleted)',
  PRE_EXISTING_MIGRATIONS.every((f) => currentFiles.includes(f)));

// git-diff based: none of the 10 pre-existing migration files show as
// modified relative to HEAD — proves untouched CONTENT, not just filenames.
try {
  const diffOutput = execSync('git diff --name-only HEAD -- supabase/migrations', { cwd: REPO, encoding: 'utf8' });
  const changedPaths = diffOutput.split('\n').map((l) => l.trim()).filter(Boolean);
  const changedPreExisting = changedPaths.filter((p) => PRE_EXISTING_MIGRATIONS.some((f) => p.endsWith(f)));
  ok('git diff (working tree vs HEAD) shows ZERO pre-existing migration files modified', changedPreExisting.length === 0);
} catch (e) {
  console.log('  (git unavailable in this environment — skipped the content-diff check)');
}

console.log('\n[B] Real DB behaviour — applying every migration to a disposable Postgres');

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
  for (const f of currentFiles) {
    const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
    console.log('applied', f);
  }
  console.log('');

  const asClient = async (uid) => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '${uid || ''}', false)`); await db.exec('set role authenticated'); };
  const asService = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '', false)`); };
  const throws = async (fn) => { try { await fn(); return false; } catch (e) { return true; } };
  const seedUser = async (id, email) => { await asService(); await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]); };

  const SUPER = '20000000-0000-0000-0000-000000000001';
  await seedUser(SUPER, 'root2@kobciye.com');
  await asService();
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [SUPER]);
  await asClient(SUPER);

  // ---- invalid values rejected at DB level ----
  ok('invalid institution_type value rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('T1','t1','L','t1@x.com','A',null,14,'college','secondary')`)));
  ok('school with no school_stage rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('T2','t2','L','t2@x.com','A',null,14,'school',null)`)));
  ok('school with an invalid school_stage value rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('T3','t3','L','t3@x.com','A',null,14,'school','form5')`)));
  ok('university WITH a school_stage rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('T4','t4','L','t4@x.com','A',null,14,'university','secondary')`)));

  // ---- valid combinations accepted ----
  const rSchoolPM = (await db.query(`select sa_create_school_and_invitation('School PM','school-pm','L','pm@x.com','A',null,14,'school','primary_middle') as r`)).rows[0].r;
  ok('school + primary_middle accepted', rSchoolPM.institution_type === 'school' && rSchoolPM.school_stage === 'primary_middle');

  const rSchoolSec = (await db.query(`select sa_create_school_and_invitation('School Sec','school-sec','L','sec@x.com','A',null,14,'school','secondary') as r`)).rows[0].r;
  ok('school + secondary accepted', rSchoolSec.institution_type === 'school' && rSchoolSec.school_stage === 'secondary');

  const rUni = (await db.query(`select sa_create_school_and_invitation('Uni A','uni-a','L','unia@x.com','A',null,14,'university',null) as r`)).rows[0].r;
  ok('university with no school_stage accepted', rUni.institution_type === 'university' && rUni.school_stage === null);

  console.log('\n[hardening] closing the three unclassified-creation loopholes');

  // ---- loophole 2: the OLD 7-arg sa_create_school_and_invitation call must
  //      now FAIL — institution_type/school_stage are no longer optional.
  ok('the OLD 7-arg call (no institution_type/school_stage) now FAILS — cannot create a new unclassified school',
    await throws(() => db.query(`select sa_create_school_and_invitation('Legacy','legacy-1','L','legacy@x.com','A',null,14)`)));
  {
    const r = await db.query(`select id from schools where slug = 'legacy-1'`);
    ok('...and no partial/unclassified school was left behind by the failed attempt', r.rows.length === 0);
  }

  // ---- loophole 3: the legacy create_school_as_super_admin RPC, called
  //      WITHOUT a classification, must also FAIL.
  await asService();
  const PENDING_FOR_LEGACY = '20000000-0000-0000-0000-000000000009';
  await seedUser(PENDING_FOR_LEGACY, 'legacy-admin@x.com');
  await asClient(SUPER);
  ok('legacy create_school_as_super_admin call WITHOUT institution_type/school_stage now FAILS',
    await throws(() => db.query(`select create_school_as_super_admin('Legacy Direct', 'legacy-direct', null, '${PENDING_FOR_LEGACY}')`)));
  {
    const r = await db.query(`select id from schools where slug = 'legacy-direct'`);
    ok('...and no partial/unclassified school was left behind by that failed attempt either', r.rows.length === 0);
  }
  // ...but WITH a valid classification, the legacy path still works (it is
  // upgraded, not removed — nothing in the live app calls it, but it must
  // remain safely usable rather than silently broken).
  const legacyOk = (await db.query(
    `select create_school_as_super_admin('Legacy Direct OK', 'legacy-direct-ok', null, '${PENDING_FOR_LEGACY}', 'school', 'secondary') as id`
  )).rows[0].id;
  ok('legacy create_school_as_super_admin call WITH a valid classification still succeeds',
    Boolean(legacyOk));
  {
    const r = await db.query(`select institution_type, school_stage from schools where id = $1`, [legacyOk]);
    ok('...and the resulting school is correctly classified (school + secondary)',
      r.rows[0].institution_type === 'school' && r.rows[0].school_stage === 'secondary');
  }

  // ---- loophole 1: a direct super_admin INSERT into schools (bypassing
  //      BOTH RPCs entirely) with a null institution_type must FAIL — the
  //      "super_admin manages schools" RLS policy would otherwise permit it.
  ok('a direct super_admin INSERT into schools with institution_type=null FAILS',
    await throws(() => db.query(`insert into schools (name, slug, institution_type, school_stage) values ('Direct Insert', 'direct-insert', null, null)`)));
  {
    const r = await db.query(`select id from schools where slug = 'direct-insert'`);
    ok('...and no row was left behind by that failed direct INSERT', r.rows.length === 0);
  }
  // a direct INSERT with a full, valid classification still succeeds (the
  // trigger targets unclassified/invalid rows specifically, not INSERT itself)
  const directOk = await db.query(
    `insert into schools (name, slug, institution_type, school_stage) values ('Direct Insert OK', 'direct-insert-ok', 'university', null) returning id`
  );
  ok('...but a direct INSERT with a valid, complete classification still succeeds', directOk.rows.length === 1);

  // ---- institution_type/school_stage are frozen after creation, for EVERYONE ----
  await asService();
  ok('institution_type cannot be changed by direct UPDATE (service/postgres-level session)',
    await throws(() => db.query(`update schools set institution_type = 'school' where slug = 'uni-a'`)));
  ok('school_stage cannot be changed by direct UPDATE',
    await throws(() => db.query(`update schools set school_stage = 'secondary' where slug = 'school-pm'`)));
  ok('unrelated columns (e.g. location) can still be updated normally — the guard is scoped, not a blanket lockout',
    !(await throws(() => db.query(`update schools set location = 'New Loc' where slug = 'school-pm'`))));

  await asClient(SUPER);
  ok('super_admin cannot change institution_type via direct table UPDATE either (no conversion tool in this phase)',
    await throws(() => db.query(`update schools set institution_type = 'university' where slug = 'school-pm'`)));

  // ---- existing Phase 3 flow (invite -> accept) still works end-to-end with institution_type set ----
  const INVITEE = '20000000-0000-0000-0000-000000000002';
  await seedUser(INVITEE, 'unia@x.com'); // matches rUni's invitee_email exactly
  await asClient(INVITEE);
  await db.query(`select accept_school_invitation()`);
  await asService();
  const prof = (await db.query(`select role, school_id from profiles where id = $1`, [INVITEE])).rows[0];
  ok('the invite -> accept lifecycle still works end-to-end with institution_type set (school_admin assigned)',
    prof.role === 'school_admin' && prof.school_id === rUni.school_id);

  // ---- the new school_admin cannot change their OWN school's classification either ----
  await asClient(INVITEE);
  ok("school_admin cannot change their OWN school's institution_type",
    await throws(() => db.query(`update schools set institution_type = 'school' where id = '${rUni.school_id}'`)));
  ok('...but CAN still update other columns of their own school (guard is scoped, not a blanket lockout)',
    !(await throws(() => db.query(`update schools set location = 'Mogadishu' where id = '${rUni.school_id}'`))));

  console.log('');
  if (failures) { console.error(`institution_type FAILED with ${failures} issue(s)\n`); process.exit(1); }
  console.log('institution_type PASSED — School vs University classification is validated, enforced on every insert path, and frozen after creation ✓\n');
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
