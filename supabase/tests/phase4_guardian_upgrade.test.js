#!/usr/bin/env node
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.join(__dirname, '..', 'migrations');
const RUNTIME_MIGRATION = '20260711000001_phase4_guardian_links.sql';
const INTEGRITY_MIGRATION = '20260712000001_phase4_guardian_link_integrity.sql';
const GUARDIAN_MIGRATIONS = new Set([RUNTIME_MIGRATION, INTEGRITY_MIGRATION]);
let failures = 0;
const ok = (name, condition) => { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; };
const uuid = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;

async function newDb() {
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
  for (const file of fs.readdirSync(MIGRATIONS).sort()) {
    if (GUARDIAN_MIGRATIONS.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql);
  }
  return db;
}

async function asClient(db, uid) {
  await db.exec('reset role');
  await db.exec(`select set_config('myapp.test_uid', '${uid || ''}', false)`);
  await db.exec('set role authenticated');
}
async function asOwner(db) { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '', false)`); }
async function applyMigration(db, file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
  await db.exec(sql);
}
async function applyRuntime(db) {
  await applyMigration(db, RUNTIME_MIGRATION);
  await applyMigration(db, INTEGRITY_MIGRATION);
}
async function seedSchool(db, suffix) {
  const superId = uuid('1'), adminId = uuid('2'), parent1 = uuid('3'), parent2 = uuid('4'), parent3 = uuid('5');
  await asOwner(db);
  for (const [id, email] of [[superId, `root-${suffix}@x.test`], [adminId, `admin-${suffix}@x.test`], [parent1, `p1-${suffix}@x.test`], [parent2, `p2-${suffix}@x.test`], [parent3, `p3-${suffix}@x.test`]]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, email]);
  }
  await db.query(`update profiles set role='super_admin' where id='${superId}'`);
  await asClient(db, superId);
  const school = (await db.query(`select create_school_as_super_admin('Upgrade ${suffix}','upgrade-${suffix}','X','${adminId}','school','primary_middle') id`)).rows[0].id;
  await asClient(db, adminId);
  await db.exec(`select assign_role('${parent1}','parent','${school}'); select assign_role('${parent2}','parent','${school}'); select assign_role('${parent3}','parent','${school}')`);
  return { superId, adminId, parent1, parent2, parent3, school };
}

(async () => {
  const db = await newDb();
  const ids = await seedSchool(db, 'valid');
  await asClient(db, ids.adminId);
  const student1 = (await db.query(`insert into students(school_id,full_name) values('${ids.school}','Legacy Child 1') returning id`)).rows[0].id;
  const student2 = (await db.query(`insert into students(school_id,full_name) values('${ids.school}','Legacy Child 2') returning id`)).rows[0].id;
  const directory = (await db.query(`insert into parents(school_id,full_name,phone) values('${ids.school}','Legacy Directory','111') returning id`)).rows[0].id;
  await db.query(`insert into student_parents(parent_profile_id,parent_id,student_id,relationship) values('${ids.parent1}','${directory}','${student1}','hooyo')`);
  await db.query(`insert into student_parents(parent_profile_id,student_id,relationship) values('${ids.parent2}','${student2}','aabe')`);

  await asOwner(db);
  await applyRuntime(db);
  let rows = (await db.query(`select id,parent_id,parent_profile_id,student_id from student_parents order by student_id`)).rows;
  ok('upgrade preserves every legacy relationship and adds stable IDs', rows.length === 2 && rows.every((row) => row.id && row.parent_id));
  let parent = (await db.query(`select profile_id from parents where id='${directory}'`)).rows[0];
  ok('upgrade backfills an unambiguous directory profile', parent.profile_id === ids.parent1);
  parent = (await db.query(`select id from parents where profile_id='${ids.parent2}'`)).rows[0];
  ok('upgrade creates a directory row for a valid profile-only link', !!parent && rows.some((row) => row.parent_id === parent.id));
  await asClient(db, ids.parent1);
  rows = (await db.query(`select id from students where id='${student1}'`)).rows;
  ok('upgraded parent retains child access', rows.length === 1);
  await asClient(db, ids.parent2);
  rows = (await db.query(`select id from student_parents`)).rows;
  ok('upgraded profile-only parent sees exactly their own link', rows.length === 1);

  await asClient(db, ids.adminId);
  await db.query(`update parents set profile_id='${ids.parent3}' where id='${directory}'`);
  await asOwner(db);
  let link = (await db.query(`select parent_profile_id from student_parents where parent_id='${directory}' and student_id='${student1}'`)).rows[0];
  ok('guardian profile reassignment synchronizes the derived link cache', link.parent_profile_id === ids.parent3);
  await asClient(db, ids.parent1);
  rows = (await db.query(`select id from students where id='${student1}'`)).rows;
  ok('guardian profile reassignment revokes the former login', rows.length === 0);
  await asClient(db, ids.parent3);
  rows = (await db.query(`select id from students where id='${student1}'`)).rows;
  ok('guardian profile reassignment grants the replacement login', rows.length === 1);

  await asOwner(db);
  await db.query(`delete from profiles where id='${ids.parent3}'`);
  link = (await db.query(`select parent_profile_id from student_parents where parent_id='${directory}' and student_id='${student1}'`)).rows[0];
  ok('deleting an optional guardian login preserves the directory relationship', !!link);
  ok('profile deletion clears the derived cache without deleting the link', !!link && link.parent_profile_id === null);
  await asClient(db, ids.parent3);
  rows = (await db.query(`select id from students where id='${student1}'`)).rows;
  ok('deleted guardian login no longer receives child access', rows.length === 0);

  await asOwner(db);
  const otherSchool = (await db.query(`insert into schools(name,slug,location,institution_type,school_stage)
    values('Endpoint Other','endpoint-other-valid','X','school','secondary') returning id`)).rows[0].id;
  let endpointError = '';
  try { await db.query(`update parents set school_id='${otherSchool}' where id='${directory}'`); } catch (error) { endpointError = String(error && error.message); }
  ok('linked guardian endpoint cannot be moved across schools', /linked guardian|across schools/i.test(endpointError));
  endpointError = '';
  try { await db.query(`update students set school_id='${otherSchool}' where id='${student1}'`); } catch (error) { endpointError = String(error && error.message); }
  ok('linked student endpoint cannot be moved across schools', /guardian links|across schools/i.test(endpointError));
  await db.close();

  const collisionDb = await newDb();
  const collisionIds = await seedSchool(collisionDb, 'collision');
  await asClient(collisionDb, collisionIds.adminId);
  const child = (await collisionDb.query(`insert into students(school_id,full_name) values('${collisionIds.school}','Collision Child') returning id`)).rows[0].id;
  const guardian = (await collisionDb.query(`insert into parents(school_id,full_name) values('${collisionIds.school}','Collision Guardian') returning id`)).rows[0].id;
  await collisionDb.query(`insert into student_parents(parent_profile_id,parent_id,student_id) values('${collisionIds.parent1}','${guardian}','${child}')`);
  await collisionDb.query(`insert into student_parents(parent_profile_id,parent_id,student_id) values('${collisionIds.parent2}','${guardian}','${child}')`);
  await asOwner(collisionDb);
  let diagnostic = '';
  try { await applyRuntime(collisionDb); } catch (error) { diagnostic = String(error && error.message); }
  ok('dirty legacy collision fails with an explicit remediation diagnostic', /guardian migration blocked: duplicate legacy/i.test(diagnostic));
  rows = (await collisionDb.query(`select column_name from information_schema.columns where table_name='student_parents' and column_name='id'`)).rows;
  ok('preflight failure occurs before guardian schema mutation', rows.length === 0);
  await collisionDb.close();

  const universityDb = await newDb();
  const universitySuper = uuid('6'), universityAdmin = uuid('7');
  await asOwner(universityDb);
  await universityDb.query(`insert into auth.users(id,email) values('${universitySuper}','university-root@x.test'),('${universityAdmin}','university-admin@x.test')`);
  await universityDb.query(`update profiles set role='super_admin' where id='${universitySuper}'`);
  await asClient(universityDb, universitySuper);
  const university = (await universityDb.query(`select create_school_as_super_admin('Legacy University','legacy-university-guardian','X','${universityAdmin}','university',null) id`)).rows[0].id;
  await asOwner(universityDb);
  await universityDb.query(`insert into parents(school_id,full_name) values('${university}','Legacy University Guardian')`);
  await applyMigration(universityDb, RUNTIME_MIGRATION);
  let universityDiagnostic = '';
  try { await applyMigration(universityDb, INTEGRITY_MIGRATION); } catch (error) { universityDiagnostic = String(error && error.message); }
  ok('university legacy guardian preflight fails with an explicit remediation diagnostic', /university guardian directory rows require remediation/i.test(universityDiagnostic));
  rows = (await universityDb.query(`select is_nullable from information_schema.columns where table_name='student_parents' and column_name='parent_id'`)).rows;
  ok('university preflight failure occurs before integrity schema mutation', rows.length === 1 && rows[0].is_nullable === 'YES');
  await universityDb.close();

  if (failures) { console.error(`phase4 guardian upgrade FAILED with ${failures} issue(s)`); process.exit(1); }
  console.log('phase4 guardian upgrade PASSED');
})().catch((error) => { console.error(error); process.exit(1); });
