#!/usr/bin/env node
/* ============================================================
   Kobciye Phase 5 — end-to-end database tests

   Applies EVERY migration (Phase 1–4 + the additive Phase 5 set) to a
   disposable in-process Postgres (pglite) and exercises the real RPCs,
   triggers and RLS under real per-role JWT contexts. No remote database is
   touched and no destructive CLI command is issued.

   Covers: account provisioning, timetable, attendance + automatic parent
   absence notifications, assignments, exams/results workflow, finance,
   discipline, university results/transcripts, reports, and cross-school
   isolation for each.
   ============================================================ */
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) failures += 1; };
const rejects = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(String(e && e.message)) : true; } };
const allows = async (fn) => { try { await fn(); return true; } catch (e) { console.log('   (unexpected error)', e.message); return false; } };

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
  for (const f of fs.readdirSync(dir).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8').replace(/create extension if not exists "pgcrypto";/g, ''));
  }
  console.log(`applied ${fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).length} migrations\n`);

  const svc = async () => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','',false)`); };
  const as = async (u) => { await db.exec('reset role'); await db.exec(`select set_config('myapp.test_uid','${u}',false)`); await db.exec('set role authenticated'); };
  const id = (d) => `${d.repeat(8)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(4)}-${d.repeat(12)}`;
  const one = async (q, p) => (await db.query(q, p)).rows[0];
  const n = async (q, p) => Number((await db.query(q, p)).rows[0].n);

  const superId = id('1'), adminA = id('2'), adminB = id('3'),
        teacherU = id('4'), studentU = id('5'), parentU = id('6'),
        teacherU2 = id('7'), uniAdmin = id('8'), uniStudentU = id('9');

  await svc();
  for (const [u, e] of [[superId, 'root@t'], [adminA, 'a@t'], [adminB, 'b@t'], [teacherU, 'teach@t'],
    [studentU, 'stud@t'], [parentU, 'parent@t'], [teacherU2, 'teach2@t'], [uniAdmin, 'uni@t'], [uniStudentU, 'unistud@t']]) {
    await db.query('insert into auth.users (id,email) values ($1,$2)', [u, e]);
  }
  await db.query(`update profiles set role='super_admin' where id=$1`, [superId]);

  await as(superId);
  const schoolA = (await one(`select create_school_as_super_admin('A','p5-a','A','${adminA}','school','secondary') id`)).id;
  const schoolB = (await one(`select create_school_as_super_admin('B','p5-b','B','${adminB}','school','secondary') id`)).id;
  const uni = (await one(`select create_school_as_super_admin('U','p5-u','U','${uniAdmin}','university',null) id`)).id;

  // ---- School A structure ----
  await as(adminA);
  const yearA = (await one(`insert into academic_years (school_id,name,status) values ('${schoolA}','2026/27','active') returning id`)).id;
  const termA = (await one(`insert into terms (school_id,name,academic_year_id) values ('${schoolA}','Term 1','${yearA}') returning id`)).id;
  const class1 = (await one(`insert into classes (school_id,name,academic_year_id) values ('${schoolA}','Form 1','${yearA}') returning id`)).id;
  const class2 = (await one(`insert into classes (school_id,name,academic_year_id) values ('${schoolA}','Form 2','${yearA}') returning id`)).id;
  const streamA = (await one(`insert into class_streams (school_id,class_id,name) values ('${schoolA}','${class1}','A') returning id`)).id;
  const subMath = (await one(`insert into subjects (school_id,name,class_id) values ('${schoolA}','Xisaab','${class1}') returning id`)).id;
  const subSci = (await one(`insert into subjects (school_id,name,class_id) values ('${schoolA}','Sayniska','${class1}') returning id`)).id;
  const teacherRec = (await one(`insert into teachers (school_id,full_name,email) values ('${schoolA}','Macallin A','teach@t') returning id`)).id;
  const teacherRec2 = (await one(`insert into teachers (school_id,full_name) values ('${schoolA}','Macallin B') returning id`)).id;
  const asgn = (await one(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,academic_year_id,is_active) values ('${schoolA}','${teacherRec}','${subMath}','${class1}','${yearA}',true) returning id`)).id;
  // a student with a linked parent, both provisioned below
  const stu = (await one(`select admit_student_atomic('${schoolA}','Arday A',null,null,null,'${class1}','${streamA}','${yearA}',null,null,null,'Waalid A','+2521','pa@t','father') r`)).r;
  const studentRec = stu.student_id, parentRec = stu.parent_id;

  // ============================================================
  // 1. ACCOUNT PROVISIONING
  // ============================================================
  console.log('\n-- account provisioning --');
  // teacher invite
  const invT = (await one(`select create_account_invitation('${schoolA}','teacher','${teacherRec}',null,null,'teach@t','Macallin A',null,'${teacherU}') id`)).id;
  ok('teacher invitation created', !!invT);
  ok('teacher invitation is pending', (await one(`select status from account_invitations where id='${invT}'`)).status === 'pending');
  // duplicate invite for same teacher is a resend, not a second row
  const invT2 = (await one(`select create_account_invitation('${schoolA}','teacher','${teacherRec}',null,null,'teach@t','Macallin A',null,'${teacherU}') id`)).id;
  ok('re-inviting the same teacher resends (no duplicate row)',
    invT2 === invT && await n(`select count(*) n from account_invitations where teacher_id='${teacherRec}'`) === 1);
  ok('resend bumped the counter', Number((await one(`select resend_count from account_invitations where id='${invT}'`)).resend_count) >= 1);
  // cross-school teacher rejected
  ok('inviting into a school you do not administer is rejected',
    await rejects(() => db.query(`select create_account_invitation('${schoolB}','teacher','${teacherRec}',null,null,'x@t','X',null,null)`), /only a school admin/i));
  // a teacher/non-admin cannot invite
  await as(teacherU);
  ok('a non-admin cannot create an invitation',
    await rejects(() => db.query(`select create_account_invitation('${schoolA}','teacher','${teacherRec2}',null,null,'y@t','Y',null,null)`), /only a school admin/i));

  // teacher accepts → profile linked to the EXISTING teacher record (no dup)
  await as(teacherU);
  await db.query(`select accept_account_invitation('${invT}')`);
  ok('teacher profile role is now teacher', (await one(`select role from profiles where id='${teacherU}'`)).role === 'teacher');
  ok('teacher profile school is School A', (await one(`select school_id from profiles where id='${teacherU}'`)).school_id === schoolA);
  ok('the EXISTING teacher record is linked (no second teacher row)',
    await n(`select count(*) n from teachers where school_id='${schoolA}'`) === 2
    && (await one(`select profile_id from teachers where id='${teacherRec}'`)).profile_id === teacherU);
  ok('invitation is now accepted', (await one(`select status from account_invitations where id='${invT}'`)).status === 'accepted');

  // student + parent provisioning
  await as(adminA);
  const invS = (await one(`select create_account_invitation('${schoolA}','student',null,'${studentRec}',null,null,'Arday A',null,'${studentU}') id`)).id;
  const invP = (await one(`select create_account_invitation('${schoolA}','parent',null,null,'${parentRec}','pa@t','Waalid A',null,'${parentU}') id`)).id;
  await as(studentU); await db.query(`select accept_account_invitation('${invS}')`);
  await as(parentU); await db.query(`select accept_account_invitation('${invP}')`);
  ok('student profile linked to existing student', (await one(`select profile_id from students where id='${studentRec}'`)).profile_id === studentU);
  ok('parent profile linked to existing parent', (await one(`select profile_id from parents where id='${parentRec}'`)).profile_id === parentU);
  ok('accepting linked the parent to their child (student_parents)',
    await n(`select count(*) n from student_parents where parent_id='${parentRec}' and parent_profile_id='${parentU}'`) === 1);


  // Public School ID + WhatsApp Forgot Password identity resolution.
  await as(adminA);
  await db.query(`select set_school_login_code('${schoolA}','SCH-A')`);
  await db.query(`select set_parent_login_phone('${schoolA}','${parentRec}','+2521',true)`);
  await svc();
  const resetStudent = (await one(`select resolve_student_password_reset_target('sch-a','  ARDAY   A ','form 1','+2521') r`)).r;
  const resetParent = (await one(`select resolve_parent_password_reset_target('SCH-A','+2521') r`)).r;
  ok('Student Forgot Password resolves full name + School ID + active class + linked Parent mobile',
    resetStudent && resetStudent.student_id === studentRec && resetStudent.profile_id === studentU);
  ok('Parent Forgot Password resolves School ID + own mobile',
    resetParent && resetParent.parent_id === parentRec && resetParent.profile_id === parentU);
  ok('Student Forgot Password rejects a wrong class without revealing another row',
    (await one(`select resolve_student_password_reset_target('SCH-A','Arday A','Form 2','+2521') r`)).r === null);
  await as(studentU);
  ok('authenticated clients cannot read OTP hashes/challenges',
    await rejects(() => db.query(`select otp_hash from password_reset_otp_challenges`), /permission|policy|denied/i));

  // revoke path + audit
  await as(adminA);
  const invR = (await one(`select create_account_invitation('${schoolA}','teacher','${teacherRec2}',null,null,'teach2@t','Macallin B',null,'${teacherU2}') id`)).id;
  await db.query(`select revoke_account_invitation('${invR}')`);
  ok('invitation revoke sets cancelled', (await one(`select status from account_invitations where id='${invR}'`)).status === 'cancelled');
  await svc();
  ok('provisioning writes audit rows',
    await n(`select count(*) n from audit_logs where action like 'account_invitation.%' and school_id='${schoolA}'`) >= 3);
  // expiry
  await db.query(`update account_invitations set expires_at = now() - interval '1 day' where id='${invR}'`);
  await as(adminA);
  // (already cancelled — create a fresh pending one to expire)
  const invE = (await one(`select create_account_invitation('${schoolA}','teacher','${teacherRec2}',null,null,'teach2@t','Macallin B',null,'${teacherU2}') id`)).id;
  await svc();
  await db.query(`update account_invitations set expires_at = now() - interval '1 day' where id='${invE}'`);
  await db.query(`select expire_stale_account_invitations()`);
  ok('a stale pending invitation expires', (await one(`select status from account_invitations where id='${invE}'`)).status === 'expired');

  // ============================================================
  // 2. TIMETABLE
  // ============================================================
  console.log('\n-- timetable --');
  await as(adminA);
  const period1 = (await one(`insert into timetable_periods (school_id,name,start_time,end_time,sort_order) values ('${schoolA}','P1','08:00','08:45',1) returning id`)).id;
  ok('valid timetable entry with a real teacher assignment',
    await allows(() => db.query(`insert into timetable_entries (school_id,academic_year_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time)
      values ('${schoolA}','${yearA}','${class1}','${subMath}','${teacherRec}',1,'08:00','08:45')`)));
  ok('a subject/class the teacher is NOT assigned to is rejected',
    await rejects(() => db.query(`insert into timetable_entries (school_id,academic_year_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time)
      values ('${schoolA}','${yearA}','${class1}','${subSci}','${teacherRec}',1,'09:00','09:45')`), /not assigned/i));
  ok('reversed time range is rejected',
    await rejects(() => db.query(`insert into timetable_entries (school_id,academic_year_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time)
      values ('${schoolA}','${yearA}','${class1}','${subMath}','${teacherRec}',2,'10:00','09:00')`), /after the start|end.*after/i));
  ok('a teacher time overlap on the same day is rejected',
    await rejects(() => db.query(`insert into timetable_entries (school_id,academic_year_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time)
      values ('${schoolA}','${yearA}','${class1}','${subMath}','${teacherRec}',1,'08:30','09:15')`), /teacher already has/i));
  // class overlap: assign teacher2 to same class different subject, then clash the class
  await db.query(`insert into teacher_assignments (school_id,teacher_id,subject_id,class_id,academic_year_id,is_active) values ('${schoolA}','${teacherRec2}','${subSci}','${class1}','${yearA}',true)`);
  ok('a class time overlap (different teacher) is rejected',
    await rejects(() => db.query(`insert into timetable_entries (school_id,academic_year_id,class_id,subject_id,teacher_id,day_of_week,start_time,end_time)
      values ('${schoolA}','${yearA}','${class1}','${subSci}','${teacherRec2}',1,'08:15','09:00')`), /class already has/i));
  // teacher sees only own timetable
  await as(teacherU);
  ok('teacher sees their own timetable entries', await n(`select count(*) n from timetable_entries`) === 1);
  await as(studentU);
  ok('student sees their class timetable', await n(`select count(*) n from timetable_entries`) === 1);
  await as(parentU);
  ok('parent sees linked child timetable', await n(`select count(*) n from timetable_entries`) === 1);
  await as(adminB);
  ok('School B admin sees NO School A timetable', await n(`select count(*) n from timetable_entries where school_id='${schoolA}'`) === 0);

  // ============================================================
  // 3. ATTENDANCE + PARENT ABSENCE NOTIFICATIONS
  // ============================================================
  console.log('\n-- attendance + notifications --');
  await as(teacherU);
  const recordsAbsent = JSON.stringify([{ student_id: studentRec, status: 'absent' }]);
  const save1 = (await one(`select save_attendance_session_atomic('${schoolA}','${class1}',current_date,'${recordsAbsent}'::jsonb,'${streamA}','${subMath}','${period1}') r`)).r;
  ok('attendance session saved with the absent student', save1.records_written === 1 && save1.absent_count === 1);
  ok('absent student created a parent notification', save1.notifications_created === 1);
  await svc();
  ok('notification is real, addressed to the linked parent',
    await n(`select count(*) n from notifications where recipient_id='${parentU}' and event_type='attendance.absence'`) === 1);
  ok('notification body has the required Somali wording + student name',
    /Arday A/.test((await one(`select body from notifications where recipient_id='${parentU}' limit 1`)).body)
    && /Fadlan la xiriir maamulka dugsiga/.test((await one(`select body from notifications where recipient_id='${parentU}' limit 1`)).body));

  // duplicate save → no duplicate notification, no duplicate session
  await as(teacherU);
  const save2 = (await one(`select save_attendance_session_atomic('${schoolA}','${class1}',current_date,'${recordsAbsent}'::jsonb,'${streamA}','${subMath}','${period1}') r`)).r;
  ok('re-saving the same slot reuses the session (no duplicate)',
    save2.session_id === save1.session_id && await n(`select count(*) n from attendance_sessions where class_id='${class1}'`) === 1);
  await svc();
  ok('re-saving creates no duplicate absence notification',
    await n(`select count(*) n from notifications where recipient_id='${parentU}' and event_type='attendance.absence'`) === 1);

  // present student → no absence notification
  await as(adminA);
  const stu2 = (await one(`select admit_student_atomic('${schoolA}','Arday B',null,null,null,'${class1}','${streamA}','${yearA}') r`)).r;
  await as(teacherU);
  const recordsPresent = JSON.stringify([{ student_id: stu2.student_id, status: 'present' }]);
  await db.query(`select save_attendance_session_atomic('${schoolA}','${class1}',current_date,'${recordsPresent}'::jsonb,'${streamA}','${subMath}','${period1}')`);
  await svc();
  ok('a present student generates no absence notification',
    await n(`select count(*) n from notifications where student_id='${stu2.student_id}' and event_type='attendance.absence'`) === 0);

  // correction: absent → present supersedes the original + adds a correction
  await as(teacherU);
  const recordsCorrect = JSON.stringify([{ student_id: studentRec, status: 'present' }]);
  await db.query(`select save_attendance_session_atomic('${schoolA}','${class1}',current_date,'${recordsCorrect}'::jsonb,'${streamA}','${subMath}','${period1}')`);
  await svc();
  ok('the original absence notification is marked superseded',
    (await one(`select superseded_at from notifications where recipient_id='${parentU}' and event_type='attendance.absence' limit 1`)).superseded_at !== null);
  ok('a correction notification is created', await n(`select count(*) n from notifications where recipient_id='${parentU}' and event_type='attendance.correction'`) === 1);
  ok('attendance correction history is preserved',
    await n(`select count(*) n from attendance_record_history arh join attendance_records ar on ar.id=arh.record_id where ar.student_id='${studentRec}'`) >= 1);

  // failed save creates no notification (bad status rolls the whole call back)
  await as(adminA);
  const stu3 = (await one(`select admit_student_atomic('${schoolA}','Arday C',null,null,null,'${class1}','${streamA}','${yearA}') r`)).r;
  await as(teacherU);
  const badRecords = JSON.stringify([{ student_id: stu3.student_id, status: 'absent' }, { student_id: stu3.student_id, status: 'not_a_status' }]);
  const notesBefore = await (async () => { await svc(); return n(`select count(*) n from notifications where school_id='${schoolA}'`); })();
  await as(teacherU);
  ok('an invalid attendance save is rejected', await rejects(() => db.query(
    `select save_attendance_session_atomic('${schoolA}','${class1}',current_date,'${badRecords}'::jsonb,'${streamA}','${subMath}','${period1}')`), /invalid attendance status/i));
  await svc();
  ok('a failed attendance save creates NO notification',
    await n(`select count(*) n from notifications where school_id='${schoolA}'`) === notesBefore);

  // unassigned teacher cannot mark / notify
  await as(teacherU);
  ok('a teacher cannot mark a class they are not assigned to',
    await rejects(() => db.query(`select save_attendance_session_atomic('${schoolA}','${class2}',current_date,'${recordsPresent}'::jsonb)`), /assigned|authorized/i));

  // student self-only, parent linked-only
  await as(studentU);
  ok('student reads only their own attendance', await n(`select count(*) n from attendance_records where student_id <> '${studentRec}'`) === 0);
  await as(parentU);
  ok('parent reads only linked child attendance', await n(`select count(*) n from attendance_records where student_id <> '${studentRec}'`) === 0);
  ok('parent reads only their own notifications', await n(`select count(*) n from notifications where recipient_id <> '${parentU}'`) === 0);

  // real statistics
  await as(adminA);
  const summ = (await one(`select attendance_summary('${schoolA}','${class1}') r`)).r;
  ok('attendance summary counts real records (total > 0)', Number(summ.total) > 0);

  // mark read persists
  await as(parentU);
  const notifId = (await one(`select id from notifications where recipient_id='${parentU}' limit 1`)).id;
  await db.query(`select mark_notification_read('${notifId}')`);
  ok('notification read state persists', (await one(`select read_at from notifications where id='${notifId}'`)).read_at !== null);

  // ============================================================
  // 4. ASSIGNMENTS
  // ============================================================
  console.log('\n-- assignments --');
  await as(teacherU);
  ok('assigned teacher creates an assignment',
    await allows(() => db.query(`insert into assignments (school_id,class_id,subject_id,teacher_id,title,status)
      values ('${schoolA}','${class1}','${subMath}','${teacherRec}','Homework 1','draft')`)));
  ok('unassigned subject is rejected',
    await rejects(() => db.query(`insert into assignments (school_id,class_id,subject_id,teacher_id,title)
      values ('${schoolA}','${class1}','${subSci}','${teacherRec}','Bad')`), /not assigned/i));
  const assignId = (await one(`select id from assignments where title='Homework 1'`)).id;
  await db.query(`update assignments set status='published' where id='${assignId}'`);
  await as(studentU);
  ok('student sees the published assignment', await n(`select count(*) n from assignments where id='${assignId}'`) === 1);
  const submissionId = (await one(`select submit_assignment_work('${schoolA}','${assignId}','my work','[]'::jsonb) id`)).id;
  ok('student submits work through the atomic RPC', !!submissionId);
  ok('a second submission is rejected when resubmission is disabled',
    await rejects(() => db.query(`select submit_assignment_work('${schoolA}','${assignId}','again','[]'::jsonb)`), /resubmission/i));
  ok('student cannot alter their own score/status after submission',
    await rejects(() => db.query(`update assignment_submissions set status='graded', score=10 where id='${submissionId}'`), /policy|students cannot edit|denied/i));
  await as(teacherU);
  ok('teacher grades the submission through the protected RPC',
    await allows(() => db.query(`select grade_assignment_submission('${schoolA}','${submissionId}',8,'Good',false)`)));
  await as(parentU);
  ok('parent sees the child submission', await n(`select count(*) n from assignment_submissions where student_id='${studentRec}'`) === 1);
  await as(adminB);
  ok('School B admin sees no School A assignments', await n(`select count(*) n from assignments where school_id='${schoolA}'`) === 0);

  // ============================================================
  // 5. EXAMS + RESULTS WORKFLOW
  // ============================================================
  console.log('\n-- exams + results --');
  await as(adminA);
  const examId = (await one(`insert into exams (school_id,class_id,subject_id,teacher_id,term_id,title,full_marks,status) values ('${schoolA}','${class1}','${subMath}','${teacherRec}','${termA}','Midterm',100,'published') returning id`)).id;
  const examScheduleId = (await one(`insert into exam_schedules (school_id,exam_id,class_id,stream_id,subject_id,exam_date,status) values ('${schoolA}','${examId}','${class1}','${streamA}','${subMath}',current_date+7,'published') returning id`)).id;
  ok('exam schedule created', !!examScheduleId);
  ok('schedule-date roster contains historically valid enrolled students',
    await n(`select count(*) n from exam_roster_for_schedule('${schoolA}','${examScheduleId}') where student_id='${studentRec}'`) === 1);
  ok('duplicate exam schedule slot rejected',
    await rejects(() => db.query(`insert into exam_schedules (school_id,exam_id,class_id,stream_id,subject_id,exam_date,status) values ('${schoolA}','${examId}','${class1}','${streamA}','${subMath}',current_date+7,'draft')`), /duplicate|unique/i));
  // teacher enters a result for an assigned class+subject
  await as(teacherU);
  ok('assigned teacher enters a schedule-validated result', await allows(() => db.query(`select enter_scheduled_result('${schoolA}','${examScheduleId}','${studentRec}',85)`)));
  ok('a negative score is rejected', await rejects(() => db.query(`select enter_result('${schoolA}','${examId}','${stu2.student_id}',-5)`), /negative/i));
  ok('a score above the max is rejected', await rejects(() => db.query(`select enter_result('${schoolA}','${examId}','${stu2.student_id}',150)`), /exceed/i));
  await db.query(`select submit_results('${schoolA}','${examId}')`);
  ok('results are submitted', (await one(`select status from results where exam_id='${examId}' and student_id='${studentRec}'`)).status === 'submitted');
  // teacher cannot approve
  ok('a teacher cannot approve results', await rejects(() => db.query(`select approve_results('${schoolA}','${examId}')`), /only a school admin/i));
  // student cannot see an unpublished result
  await as(studentU);
  ok('student cannot see an unpublished result', await n(`select count(*) n from results where exam_id='${examId}' and student_id='${studentRec}'`) === 0);
  // admin approves + publishes
  await as(adminA);
  await db.query(`select approve_results('${schoolA}','${examId}')`);
  await db.query(`select publish_results('${schoolA}','${examId}')`);
  ok('published result flips the legacy published flag',
    (await one(`select published,status from results where exam_id='${examId}' and student_id='${studentRec}'`)).published === true);
  await as(studentU);
  ok('student sees ONLY their own published result',
    await n(`select count(*) n from results where student_id='${studentRec}'`) === 1
    && await n(`select count(*) n from results where student_id <> '${studentRec}'`) === 0);
  await as(parentU);
  ok('parent sees the linked child published result', await n(`select count(*) n from results where student_id='${studentRec}'`) === 1);
  await svc();
  ok('result history is preserved', await n(`select count(*) n from result_history where student_id='${studentRec}'`) >= 1);
  ok('publishing a result notified the parent', await n(`select count(*) n from notifications where recipient_id='${parentU}' and event_type='result.published'`) === 1);

  // ============================================================
  // 6. FINANCE
  // ============================================================
  console.log('\n-- finance --');
  await as(adminA);
  const feeStruct = (await one(`insert into fee_structures (school_id,academic_year_id,name) values ('${schoolA}','${yearA}','Term 1 Fees') returning id`)).id;
  await db.query(`insert into fee_items (school_id,fee_structure_id,name,amount) values ('${schoolA}','${feeStruct}','Tuition',100),('${schoolA}','${feeStruct}','Books',20)`);
  const invId = (await one(`select generate_invoice('${schoolA}','${studentRec}','${feeStruct}') id`)).id;
  ok('invoice generated from the fee structure with the right total',
    Number((await one(`select amount_due from student_invoices where id='${invId}'`)).amount_due) === 120);
  ok('generating the same invoice twice is idempotent',
    (await one(`select generate_invoice('${schoolA}','${studentRec}','${feeStruct}') id`)).id === invId);
  ok('a negative payment is rejected', await rejects(() => db.query(`select record_payment('${schoolA}','${invId}',-10)`), /greater than zero/i));
  ok('an overpayment is rejected', await rejects(() => db.query(`select record_payment('${schoolA}','${invId}',500)`), /exceeds/i));
  await db.query(`select record_payment('${schoolA}','${invId}',50,'cash','REF-1')`);
  ok('partial payment updates balance to 70',
    Number((await one(`select balance from student_invoices where id='${invId}'`)).balance) === 70
    && (await one(`select status from student_invoices where id='${invId}'`)).status === 'part_paid');
  ok('a duplicate payment reference is rejected', await rejects(() => db.query(`select record_payment('${schoolA}','${invId}',10,'cash','REF-1')`), /reference already exists/i));
  await db.query(`select record_payment('${schoolA}','${invId}',70,'cash','REF-2')`);
  ok('full payment marks the invoice paid',
    (await one(`select status from student_invoices where id='${invId}'`)).status === 'paid'
    && Number((await one(`select balance from student_invoices where id='${invId}'`)).balance) === 0);
  await svc();
  ok('finance mutations are audited', await n(`select count(*) n from audit_logs where entity in ('payments','student_invoices','fee_structures') and school_id='${schoolA}'`) >= 1);
  await as(studentU);
  ok('student sees only their own invoices', await n(`select count(*) n from student_invoices where student_id <> '${studentRec}'`) === 0);
  await as(parentU);
  ok('parent sees only linked child invoices', await n(`select count(*) n from student_invoices where student_id <> '${studentRec}'`) === 0);
  ok('parent was notified of the recorded payment', await n(`select count(*) n from notifications where recipient_id='${parentU}' and event_type='payment.recorded'`) >= 1);

  // ============================================================
  // 7. DISCIPLINE
  // ============================================================
  console.log('\n-- discipline --');
  await as(adminA);
  const incId = (await one(`insert into incidents (school_id,student_id,reported_by,title,detail,category,severity,status,follow_up_on) values ('${schoolA}','${studentRec}','${adminA}','Late repeatedly','detail','punctuality','dhexe','open',current_date+3) returning id`)).id;
  await db.query(`insert into incident_notes (school_id,incident_id,note,is_confidential) values ('${schoolA}','${incId}','confidential note',true)`);
  await db.query(`insert into incident_actions (school_id,incident_id,action) values ('${schoolA}','${incId}','Verbal warning')`);
  await db.query(`update incidents set status='resolved' where id='${incId}'`);
  await svc();
  ok('incident status change is recorded in history', await n(`select count(*) n from incident_history where incident_id='${incId}'`) >= 1);
  ok('follow-up notified the case owner', await n(`select count(*) n from notifications where recipient_id='${adminA}' and event_type='incident.followup'`) >= 1);
  await as(parentU);
  ok('parent CANNOT read confidential incident notes', await n(`select count(*) n from incident_notes where incident_id='${incId}'`) === 0);
  ok('parent CAN read a non-confidential incident action', await n(`select count(*) n from incident_actions where incident_id='${incId}'`) === 1);
  await as(studentU);
  ok('student cannot read confidential incident notes', await n(`select count(*) n from incident_notes`) === 0);
  await as(teacherU2);
  // a teacher of School A but unrelated: staff can read incident header (existing policy), but not another school's
  await as(adminB);
  ok('School B admin cannot read School A incidents', await n(`select count(*) n from incidents where school_id='${schoolA}'`) === 0);

  // ============================================================
  // 8. UNIVERSITY RESULTS + TRANSCRIPTS (mode separation)
  // ============================================================
  console.log('\n-- university --');
  await as(uniAdmin);
  const faculty = (await one(`insert into faculties (school_id,name) values ('${uni}','Science') returning id`)).id;
  const dept = (await one(`insert into departments (school_id,faculty_id,name) values ('${uni}','${faculty}','CS') returning id`)).id;
  const prog = (await one(`insert into programmes (school_id,department_id,name,degree_level) values ('${uni}','${dept}','BSc CS','bachelor') returning id`)).id;
  const uniYear = (await one(`insert into academic_years (school_id,name,status) values ('${uni}','2026/27','active') returning id`)).id;
  const sem = (await one(`insert into semesters (school_id,academic_year_id,name) values ('${uni}','${uniYear}','Semester 1') returning id`)).id;
  const course = (await one(`insert into courses (school_id,programme_id,department_id,name,credit_hours) values ('${uni}','${prog}','${dept}','Intro',3) returning id`)).id;
  const uniStuRec = (await one(`insert into university_students (school_id,programme_id,full_name) values ('${uni}','${prog}','Uni Student') returning id`)).id;
  await db.query(`update university_students set profile_id='${uniStudentU}' where id='${uniStuRec}'`);
  await db.query(`update profiles set role='student', school_id='${uni}' where id='${uniStudentU}'`);
  const cEnrol = (await one(`insert into course_enrollments (school_id,university_student_id,course_id,semester_id,academic_year_id) values ('${uni}','${uniStuRec}','${course}','${sem}','${uniYear}') returning id`)).id;
  const cRes = (await one(`insert into course_results (school_id,course_enrollment_id,university_student_id,course_id,semester_id,score,grade,grade_point,credit_hours,status) values ('${uni}','${cEnrol}','${uniStuRec}','${course}','${sem}',85,'A',4.0,3,'published') returning id`)).id;
  ok('university course result created', !!cRes);
  ok('a school-mode admit RPC refuses a university school',
    await rejects(() => db.query(`select admit_student_atomic('${uni}','X')`), /School Mode|university/i));
  const transcript = (await one(`select issue_transcript('${uni}','${uniStuRec}','${uniYear}','${sem}') id`)).id;
  ok('transcript issued with a GPA snapshot',
    !!transcript && Number((await one(`select gpa from transcripts where id='${transcript}'`)).gpa) === 4.0);
  await as(uniStudentU);
  ok('a university student sees only their own published course results',
    await n(`select count(*) n from course_results where university_student_id='${uniStuRec}'`) === 1);
  ok('a university student sees their own transcript', await n(`select count(*) n from transcripts where university_student_id='${uniStuRec}'`) === 1);

  // ============================================================
  // 9. REPORTS (real data, role-scoped, never a silent zero on auth failure)
  // ============================================================
  console.log('\n-- reports --');
  await as(adminA);
  const enrolRep = (await one(`select report_enrollment_summary('${schoolA}') r`)).r;
  ok('enrollment report returns a real total_active > 0', Number(enrolRep.total_active) > 0);
  const feeRep = (await one(`select report_fee_balance_summary('${schoolA}') r`)).r;
  ok('fee report returns real totals (paid = 120)', Number(feeRep.total_paid) === 120);
  await as(teacherU);
  ok('a teacher is REFUSED an admin report (never a silent zero)',
    await rejects(() => db.query(`select report_enrollment_summary('${schoolA}')`), /not authorized/i));
  await as(adminB);
  ok('School B admin cannot read School A report',
    await rejects(() => db.query(`select report_enrollment_summary('${schoolA}')`), /not authorized/i));

  await db.close();
  console.log(failures === 0 ? '\nphase5_core: all assertions passed' : `\nphase5_core: ${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
