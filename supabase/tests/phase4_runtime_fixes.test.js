#!/usr/bin/env node
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, condition) => { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; };
const throws = async (fn) => { try { await fn(); return false; } catch (e) { return true; } };
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
  const dir = path.join(__dirname, '..', 'migrations');
  for (const file of fs.readdirSync(dir).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await db.exec(sql); console.log('applied', file);
  }
  const asService = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '', false)`); };
  const asClient = async (uid) => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid', '${uid}', false)`); await db.exec('set role authenticated'); };
  const id = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(4)}-${digit.repeat(12)}`;
  const superId = id('1'), adminA = id('2'), adminB = id('3'), parentLogin = id('4'), parentBLogin = id('5'), universityAdmin = id('6');

  await asService();
  for (const [uid, email] of [[superId, 'root@x.test'], [adminA, 'a@x.test'], [adminB, 'b@x.test'], [parentLogin, 'parent@x.test'], [parentBLogin, 'parent-b@x.test'], [universityAdmin, 'university@x.test']]) {
    await db.query('insert into auth.users (id,email) values ($1,$2)', [uid, email]);
  }
  await db.query(`update profiles set role='super_admin' where id=$1`, [superId]);
  await asClient(superId);
  const schoolA = (await db.query(`select create_school_as_super_admin('A','runtime-a','A','${adminA}','school','primary_middle') id`)).rows[0].id;
  const schoolB = (await db.query(`select create_school_as_super_admin('B','runtime-b','B','${adminB}','school','secondary') id`)).rows[0].id;
  const university = (await db.query(`select create_school_as_super_admin('U','runtime-u','U','${universityAdmin}','university',null) id`)).rows[0].id;

  await asClient(universityAdmin);
  ok('university admins cannot create school guardian directory rows', await throws(
    () => db.query(`insert into parents (school_id,full_name,phone) values ('${university}','Not Allowed','000')`)));
  await asService();
  ok('guardian trigger rejects university rows even when RLS is bypassed', await rejects(
    () => db.query(`insert into parents (school_id,full_name,phone) values ('${university}','Not Allowed','000')`), /only available to school/i));

  await asClient(adminB);
  await db.exec(`select assign_role('${parentBLogin}', 'parent', '${schoolB}')`);

  await asClient(adminA);
  await db.exec(`select assign_role('${parentLogin}', 'parent', '${schoolA}')`);
  const student1 = (await db.query(`insert into students (school_id,full_name,admission_number) values ('${schoolA}','Child One','A-1') returning id`)).rows[0].id;
  const student2 = (await db.query(`insert into students (school_id,full_name,admission_number) values ('${schoolA}','Child Two','A-2') returning id`)).rows[0].id;
  const unrelated = (await db.query(`insert into students (school_id,full_name,admission_number) values ('${schoolA}','Unrelated','A-3') returning id`)).rows[0].id;
  const guardian1 = (await db.query(`insert into parents (school_id,full_name,phone) values ('${schoolA}','Guardian One','111') returning id`)).rows[0].id;
  const guardian2 = (await db.query(`insert into parents (school_id,full_name,phone) values ('${schoolA}','Guardian Two','222') returning id`)).rows[0].id;
  const guardianLogin = (await db.query(`insert into parents (school_id,profile_id,full_name,phone) values ('${schoolA}','${parentLogin}','Guardian Login','333') returning id`)).rows[0].id;

  const link1 = (await db.query(`insert into student_parents (parent_id,student_id,relationship,is_primary,can_receive_messages)
    values ('${guardian1}','${student1}','hooyo',true,true) returning id,parent_profile_id`)).rows[0];
  ok('directory guardian without login links to one student', !!link1.id && link1.parent_profile_id === null);
  await db.query(`insert into student_parents (parent_id,student_id,relationship) values ('${guardian1}','${student2}','hooyo')`);
  let result = await db.query(`select count(*)::int count from student_parents where parent_id='${guardian1}'`);
  ok('guardian links to multiple siblings', result.rows[0].count === 2);
  await db.query(`insert into student_parents (parent_id,student_id,relationship) values ('${guardian2}','${student1}','aabe')`);
  result = await db.query(`select count(*)::int count from student_parents where student_id='${student1}'`);
  ok('student links to multiple guardians', result.rows[0].count === 2);
  ok('duplicate directory guardian/student link is rejected by the unique index', await rejects(() => db.query(`insert into student_parents (parent_id,student_id) values ('${guardian1}','${student1}')`), /unique|duplicate/i));

  await db.query(`update student_parents set relationship='ayeeyo',is_primary=false,can_receive_messages=false where id='${link1.id}'`);
  result = await db.query(`select relationship,is_primary,can_receive_messages from student_parents where id='${link1.id}'`);
  ok('relationship metadata update persists', result.rows[0].relationship === 'ayeeyo' && !result.rows[0].is_primary && !result.rows[0].can_receive_messages);

  await asClient(adminB);
  const studentB = (await db.query(`insert into students (school_id,full_name,admission_number) values ('${schoolB}','B Child','B-1') returning id`)).rows[0].id;
  const guardianB = (await db.query(`insert into parents (school_id,full_name,phone) values ('${schoolB}','B Guardian','444') returning id`)).rows[0].id;
  const linkB = (await db.query(`insert into student_parents (parent_id,student_id) values ('${guardianB}','${studentB}') returning id`)).rows[0].id;
  await asClient(adminA);
  ok('cross-school student link is rejected by the school guard', await rejects(() => db.query(`insert into student_parents (parent_id,student_id) values ('${guardian1}','${studentB}')`), /same school|another school/i));
  ok('cross-school guardian link is rejected by the school guard', await rejects(() => db.query(`insert into student_parents (parent_id,student_id) values ('${guardianB}','${student1}')`), /same school|another school/i));
  ok('moving a link across schools is rejected by the school guard', await rejects(() => db.query(`update student_parents set student_id='${studentB}' where id='${link1.id}'`), /same school|another school/i));
  result = await db.query(`select id from student_parents where id='${linkB}'`);
  ok('cross-school links are not readable', result.rows.length === 0);
  await db.query(`delete from student_parents where id='${linkB}'`);
  await asService();
  result = await db.query(`select id from student_parents where id='${linkB}'`);
  ok('cross-school unlink is blocked by RLS', result.rows.length === 1);
  await asClient(adminA);

  await db.query(`insert into student_parents (parent_id,parent_profile_id,student_id,relationship)
    values ('${guardianLogin}','${adminA}','${student1}','aabe')`);
  await asService();
  result = await db.query(`select parent_profile_id from student_parents where parent_id='${guardianLogin}' and student_id='${student1}'`);
  ok('server derives parent profile and ignores forged client profile id', result.rows[0].parent_profile_id === parentLogin);
  ok('same-school non-parent profile cannot be assigned to guardian directory', await rejects(
    () => db.query(`update parents set profile_id='${adminA}' where id='${guardianLogin}'`), /must be a parent|parent in the same school/i));
  ok('cross-school parent profile cannot be assigned to guardian directory', await rejects(
    () => db.query(`update parents set profile_id='${parentBLogin}' where id='${guardianLogin}'`), /same school/i));
  ok('direct profile-only link rejects a same-school non-parent profile', await rejects(
    () => db.query(`insert into student_parents (parent_profile_id,student_id) values ('${adminA}','${unrelated}')`), /must be a parent|parent profile/i));
  await asClient(parentLogin);
  result = await db.query(`select id from students order by id`);
  ok('linked parent reads only their linked child', result.rows.length === 1 && result.rows[0].id === student1);
  result = await db.query(`select id from student_parents`);
  ok('linked parent reads only their own link', result.rows.length === 1);
  result = await db.query(`select id from parents where id='${guardianLogin}'`);
  ok('linked parent reads their own guardian directory row', result.rows.length === 1);
  const parentWrite = await db.query(`update student_parents set relationship='forged' where parent_id='${guardianLogin}'`);
  ok('parent cannot update guardian links', (parentWrite.affectedRows || 0) === 0);

  await asClient(adminA);
  await db.exec(`select assign_role('${parentLogin}', 'teacher', '${schoolA}')`);
  await asClient(parentLogin);
  result = await db.query(`select is_parent_of('${student1}') allowed`);
  ok('changing a linked profile away from parent revokes parent helper access dynamically', result.rows[0].allowed === false);
  result = await db.query(`select id from student_parents where parent_id='${guardianLogin}'`);
  ok('changed-role profile no longer reads the parent link', result.rows.length === 0);
  result = await db.query(`select id from parents where id='${guardianLogin}'`);
  ok('changed-role profile no longer reads the guardian directory row', result.rows.length === 0);
  await asClient(adminA);
  await db.exec(`select assign_role('${parentLogin}', 'parent', '${schoolA}')`);

  const primaryLink = (await db.query(`insert into student_parents (parent_id,student_id,is_primary) values ('${guardian2}','${student2}',true) returning id`)).rows[0].id;
  ok('only one primary guardian per student is enforced', await rejects(
    () => db.query(`update student_parents set is_primary=true where parent_id='${guardian1}' and student_id='${student2}'`), /unique|duplicate/i));
  await db.query(`delete from student_parents where id='${primaryLink}'`);

  await asClient(adminA);
  await db.query(`delete from student_parents where id='${link1.id}'`);
  result = await db.query(`select id from student_parents where id='${link1.id}'`);
  ok('unlinking removes the relationship', result.rows.length === 0);
  await asClient(adminA); // simulated refresh/sign-in: new authenticated query
  result = await db.query(`select student_id from student_parents where parent_id='${guardian1}'`);
  ok('refresh preserves remaining Supabase relationships', result.rows.length === 1 && result.rows[0].student_id === student2);
  result = await db.query(`select id from students where id='${unrelated}'`);
  ok('unrelated same-school data remains intact', result.rows.length === 1);

  await db.exec('reset role');
  await db.exec(`select set_config('myapp.test_uid', '', false)`);
  await db.exec('set role anon');
  result = await db.query(`select is_parent_of('${student1}') allowed`);
  ok('anon retains EXECUTE on the read-only RLS helper and receives false', result.rows[0].allowed === false);

  await db.close();
  if (failures) { console.error(`phase4 runtime DB FAILED with ${failures} issue(s)`); process.exit(1); }
  console.log('phase4 runtime DB PASSED');
})().catch((error) => { console.error(error); process.exit(1); });
