#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 3 school-onboarding / invitation security suite

   Applies EVERY migration in supabase/migrations/ (Phase 2 + the new Phase 3
   school_invitations migration) to a real, disposable Postgres (pglite — an
   in-process Postgres, not a mock) and then exercises the exact security
   requirements of Phase 3:

     • only a real super_admin can create a school + invitation
     • anon / pending / school_admin cannot
     • no self-promotion via role/school_id payload
     • the invitation is created + audited securely
     • the invited user does NOT get school_admin merely from having a row
     • only the matching invited user can accept
     • expired / cancelled / already-accepted invites cannot be accepted
     • resend + cancel are super_admin-only and audited
     • role + membership assignment writes audit logs
     • a newly accepted admin sees ONLY their own (empty) school — no demo data
     • an invitee cannot read the invitations table directly (RLS)

   Every assertion is a real SQL statement expected to succeed or fail — like
   the Phase 2 suite, all "logged-in" operations run as Postgres role
   `authenticated` (SET ROLE) so RLS actually applies; asService() drops to
   superuser only for what Supabase's own Auth service / the SQL Editor do.

   Run:
     cd supabase/tests && npm install && node phase3_invitations.test.js
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

  // Reproduce Supabase's default bootstrap grants + the auth/storage schemas
  // the migrations reference (same harness as the Phase 2 suite).
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
  const throws = async (fn) => { try { await fn(); return false; } catch (e) { return true; } };
  // RLS silently filters rows with no matching policy — an UPDATE/DELETE then
  // affects 0 rows rather than raising. "Blocked" = throws OR touches nothing.
  const writeIsBlocked = async (sql) => {
    try { const res = await db.query(sql); return (res.affectedRows ?? 0) === 0; }
    catch (e) { return true; }
  };
  const seedUser = async (id, email, meta) => {
    await asService();
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
      [id, email, JSON.stringify(meta || {})]
    );
  };

  const SUPER = '10000000-0000-0000-0000-000000000001';
  const OUTSIDER = '10000000-0000-0000-0000-000000000002'; // a pending user, not invited
  const INVITEE = '10000000-0000-0000-0000-000000000003'; // matches invite email
  const INVITEE2 = '10000000-0000-0000-0000-000000000004';
  const INVITEE3 = '10000000-0000-0000-0000-000000000005';
  const INVITEE4 = '10000000-0000-0000-0000-000000000006';

  // bootstrap the platform super_admin the documented way (no-JWT session)
  await seedUser(SUPER, 'root@kobciye.com');
  await asService();
  await db.query(`update profiles set role = 'super_admin' where id = $1`, [SUPER]);

  // pending outsider + invited users (invitees created as pending profiles by
  // the handle_new_user trigger, exactly like a real Supabase Auth invite)
  await seedUser(OUTSIDER, 'outsider@x.com');
  await seedUser(INVITEE, 'admin@newschool.com');
  await seedUser(INVITEE2, 'admin2@x.com');
  await seedUser(INVITEE3, 'admin3@x.com');
  await seedUser(INVITEE4, 'admin4@x.com');

  // ============================================================
  // 1. only a real super_admin can create a school + invitation
  // ============================================================
  await asAnon();
  ok('anon cannot create a school+invitation',
    await throws(() => db.query(
      `select sa_create_school_and_invitation('S','s','L','admin@newschool.com','A','+252600000000',14,'school','primary_middle')`)));

  await asClient(OUTSIDER); // pending
  ok('pending user cannot create a school+invitation',
    await throws(() => db.query(
      `select sa_create_school_and_invitation('S','s','L','admin@newschool.com','A','+252600000000',14,'school','primary_middle')`)));

  // super_admin succeeds
  await asClient(SUPER);
  const created = (await db.query(
    `select sa_create_school_and_invitation('Dugsiga Cusub','dugsiga-cusub','Gabiley','Admin@NewSchool.com','Cabdi Admin','+252 61 1234567',14,'school','primary_middle') as r`
  )).rows[0].r;
  const schoolId = created.school_id;
  const inviteId = created.invitation_id;
  ok('super_admin creates a school + invitation', Boolean(schoolId && inviteId) && created.idempotent === false);
  ok('invitee_email is normalized to lowercase', created.invitee_email === 'admin@newschool.com');

  // trial subscription created
  let r = await db.query(`select status from subscriptions where school_id = $1`, [schoolId]);
  ok('school gets a trialing subscription', r.rows[0]?.status === 'trialing');

  // invitation row is pending with correct fields
  await asService();
  r = await db.query(`select status, intended_role, invited_by, invitee_auth_user_id from school_invitations where id = $1`, [inviteId]);
  ok('invitation is pending / school_admin / invited_by super_admin',
    r.rows[0].status === 'pending' && r.rows[0].intended_role === 'school_admin' && r.rows[0].invited_by === SUPER);
  ok('invitation has NO auth user id until a server result attaches one', r.rows[0].invitee_auth_user_id === null);

  // audit logs written for creation
  r = await db.query(`select action from audit_logs where entity_id = $1`, [schoolId]);
  ok('school.create audited', r.rows.some((x) => x.action === 'school.create'));
  r = await db.query(`select action from audit_logs where entity_id = $1`, [inviteId]);
  ok('invitation.create audited', r.rows.some((x) => x.action === 'invitation.create'));

  // ============================================================
  // 2. the invited user does NOT get school_admin merely from the row /
  //    from client metadata; they are still pending until they accept
  // ============================================================
  await asService();
  r = await db.query(`select role, school_id from profiles where id = $1`, [INVITEE]);
  ok('invited user is still pending with no school BEFORE accepting',
    r.rows[0].role === 'pending' && r.rows[0].school_id === null);

  // self-promotion attempts by the invitee are blocked
  await asClient(INVITEE);
  ok('invitee cannot self-assign school_admin via direct profile UPDATE',
    await throws(() => db.exec(`update profiles set role = 'school_admin', school_id = '${schoolId}' where id = '${INVITEE}'`)));
  ok('invitee cannot read the invitations table directly (RLS: super_admin only)',
    (await db.query(`select * from school_invitations`)).rows.length === 0);

  // ============================================================
  // 3. school_admin cannot create a school (privilege boundary)
  //    (first, accept as INVITEE to become a school_admin)
  // ============================================================
  await asClient(INVITEE);
  const accepted = (await db.query(`select accept_school_invitation('${inviteId}') as r`)).rows[0].r;
  ok('matching invitee can accept the invitation', accepted.school_id === schoolId && accepted.role === 'school_admin');

  await asService();
  r = await db.query(`select role, school_id from profiles where id = $1`, [INVITEE]);
  ok('after accept, invitee is school_admin of ONLY their new school',
    r.rows[0].role === 'school_admin' && r.rows[0].school_id === schoolId);
  r = await db.query(`select status, accepted_at, invitee_auth_user_id from school_invitations where id = $1`, [inviteId]);
  ok('invitation flips to accepted + records the real auth user id from the JWT',
    r.rows[0].status === 'accepted' && r.rows[0].accepted_at !== null && r.rows[0].invitee_auth_user_id === INVITEE);
  r = await db.query(`select role from school_members where profile_id = $1 and school_id = $2`, [INVITEE, schoolId]);
  ok('school_members synced automatically for the accepted admin', r.rows[0]?.role === 'school_admin');
  r = await db.query(`select action from audit_logs where entity_id = $1`, [inviteId]);
  ok('invitation.accept audited', r.rows.some((x) => x.action === 'invitation.accept'));
  r = await db.query(`select action, detail from audit_logs where entity_id = $1 and action = 'profile.assign_role'`, [INVITEE]);
  ok('role assignment on accept is audited', r.rows.length >= 1);

  // now the freshly-minted school_admin must NOT be able to create a school
  await asClient(INVITEE);
  ok('school_admin cannot create a school',
    await throws(() => db.query(
      `select sa_create_school_and_invitation('X','x-school','L','someone@x.com','N','+252600000000',14,'school','primary_middle')`)));

  // ============================================================
  // 4. a newly accepted admin sees ONLY their own EMPTY school — no demo data
  // ============================================================
  await asClient(INVITEE);
  r = await db.query(`select count(*)::int n from schools`);
  ok('new school_admin sees exactly ONE school (their own) via RLS', r.rows[0].n === 1);
  r = await db.query(`select id from schools`);
  ok('...and it is their own school', r.rows[0].id === schoolId);
  // the Phase 2 seed schools (Dugsiga Hidaayada / Nuurul Cilmi) must be invisible
  r = await db.query(`select count(*)::int n from schools where slug in ('hidaayada','nuurul-cilmi')`);
  ok('new school_admin can NOT see the demo seed schools (no Dugsiga Hidaayada)', r.rows[0].n === 0);
  // their school starts empty
  for (const t of ['students', 'classes', 'payments', 'attendance', 'exams', 'results']) {
    r = await db.query(`select count(*)::int n from ${t}`);
    ok(`new school_admin's ${t} is empty (0 rows, no demo records)`, r.rows[0].n === 0);
  }

  // ============================================================
  // 5. only the matching invited user can accept
  // ============================================================
  await asClient(SUPER);
  const c2 = (await db.query(
    `select sa_create_school_and_invitation('School Two','school-two','Loc','admin2@x.com','Admin Two','+252600000002',14,'school','primary_middle') as r`
  )).rows[0].r;
  ok('a wrong (non-matching) user cannot accept another user invite',
    await (async () => { await asClient(OUTSIDER); return throws(() => db.query(`select accept_school_invitation('${c2.invitation_id}')`)); })());
  // OUTSIDER (email outsider@x.com) also has no pending invite of their own
  ok('a user with no invitation cannot accept by email lookup',
    await throws(() => db.query(`select accept_school_invitation(null)`)));

  // ============================================================
  // 6. cancelled invite cannot be accepted; cancel is super_admin-only
  // ============================================================
  await asClient(INVITEE); // school_admin, not super_admin
  ok('non-super_admin cannot cancel an invitation',
    await throws(() => db.query(`select sa_cancel_invitation('${c2.invitation_id}')`)));
  await asClient(SUPER);
  const cancelledRes = (await db.query(`select sa_cancel_invitation('${c2.invitation_id}') as r`)).rows[0].r;
  ok('super_admin can cancel an invitation', cancelledRes.status === 'cancelled');
  await asService();
  r = await db.query(`select action from audit_logs where entity_id = $1`, [c2.invitation_id]);
  ok('invitation.cancel audited', r.rows.some((x) => x.action === 'invitation.cancel'));
  await asClient(INVITEE2); // matches admin2@x.com
  ok('cancelled invitation cannot be accepted',
    await throws(() => db.query(`select accept_school_invitation('${c2.invitation_id}')`)));

  // ============================================================
  // 7. expired invite cannot be accepted; resend re-arms expiry
  // ============================================================
  await asClient(SUPER);
  const c3 = (await db.query(
    `select sa_create_school_and_invitation('School Three','school-three','Loc','admin3@x.com','Admin Three','+252600000003',14,'school','primary_middle') as r`
  )).rows[0].r;
  // force it into the past
  await asService();
  await db.query(`update school_invitations set expires_at = now() - interval '1 day' where id = $1`, [c3.invitation_id]);
  await asClient(INVITEE3);
  ok('an expired (past-due) invitation cannot be accepted',
    await throws(() => db.query(`select accept_school_invitation('${c3.invitation_id}')`)));

  // resend is super_admin-only and re-arms expiry to the future
  await asClient(INVITEE3);
  ok('non-super_admin cannot resend an invitation',
    await throws(() => db.query(`select sa_resend_invitation('${c3.invitation_id}', 14)`)));
  await asClient(SUPER);
  const resendRes = (await db.query(`select sa_resend_invitation('${c3.invitation_id}', 14) as r`)).rows[0].r;
  ok('super_admin can resend; invite is pending again', resendRes.status === 'pending');
  await asService();
  r = await db.query(`select status, expires_at > now() as future from school_invitations where id = $1`, [c3.invitation_id]);
  ok('resend refreshed expiry into the future', r.rows[0].status === 'pending' && r.rows[0].future === true);
  r = await db.query(`select action from audit_logs where entity_id = $1`, [c3.invitation_id]);
  ok('invitation.resend audited', r.rows.some((x) => x.action === 'invitation.resend'));

  // after a valid resend, the matching invitee can now accept
  await asClient(INVITEE3);
  const acc3 = (await db.query(`select accept_school_invitation('${c3.invitation_id}') as r`)).rows[0].r;
  ok('after resend the matching invitee can accept', acc3.school_id === c3.school_id);

  // ============================================================
  // 8. accepted invite cannot be accepted twice
  // ============================================================
  await asClient(INVITEE3);
  ok('an already-accepted invitation cannot be accepted again',
    await throws(() => db.query(`select accept_school_invitation('${c3.invitation_id}')`)));

  // resend on an accepted invite is refused
  await asClient(SUPER);
  ok('resend refuses an already-accepted invitation',
    await throws(() => db.query(`select sa_resend_invitation('${c3.invitation_id}', 14)`)));
  ok('cancel refuses an already-accepted invitation',
    await throws(() => db.query(`select sa_cancel_invitation('${c3.invitation_id}')`)));

  // ============================================================
  // 9. idempotency: a duplicate "Create & Invite" for the same slug+email
  //    returns the existing ids instead of creating duplicates
  // ============================================================
  await asClient(SUPER);
  const dup1 = (await db.query(
    `select sa_create_school_and_invitation('Dup School','dup-school','Loc','admin4@x.com','Admin Four','+252600000004',14,'school','primary_middle') as r`
  )).rows[0].r;
  const dup2 = (await db.query(
    `select sa_create_school_and_invitation('Dup School','dup-school','Loc','admin4@x.com','Admin Four','+252600000004',14,'school','primary_middle') as r`
  )).rows[0].r;
  ok('duplicate Create&Invite is idempotent (same ids, no duplicate school/invite)',
    dup2.idempotent === true && dup1.school_id === dup2.school_id && dup1.invitation_id === dup2.invitation_id);
  await asService();
  r = await db.query(`select count(*)::int n from schools where slug = 'dup-school'`);
  ok('...exactly one school row exists for the slug', r.rows[0].n === 1);
  r = await db.query(`select count(*)::int n from school_invitations where school_id = $1 and status = 'pending'`, [dup1.school_id]);
  ok('...exactly one pending invitation exists', r.rows[0].n === 1);

  // a DIFFERENT slug reusing an existing slug string is rejected (not silent)
  ok('creating a school with an already-used slug (no pending invite match) is rejected',
    await (async () => { await asClient(SUPER); return throws(() => db.query(
      `select sa_create_school_and_invitation('Other','dugsiga-cusub','L','different@x.com','N','+252600000009',14,'school','primary_middle')`)); })());

  // ============================================================
  // 10. input validation is enforced server-side
  // ============================================================
  await asClient(SUPER);
  ok('invalid slug rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('X','Bad Slug!','L','ok@x.com','N',null,14,'school','primary_middle')`)));
  ok('invalid email rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('X','ok-slug','L','not-an-email','N',null,14,'school','primary_middle')`)));
  ok('too-short name rejected',
    await throws(() => db.query(`select sa_create_school_and_invitation('X','ok-slug2','L','ok@x.com','N',null,14,'school','primary_middle')`)));

  // ============================================================
  // 11. RLS still enabled on the new table + Phase 2 tables (spot check)
  // ============================================================
  await asService();
  r = await db.query(`select relrowsecurity from pg_class where relname = 'school_invitations'`);
  ok('RLS is enabled on school_invitations', r.rows[0].relrowsecurity === true);

  // ============================================================
  // 12. school_invitations is WRITE-ONLY-VIA-SERVER (migration 0002):
  //     a super_admin CLIENT can READ but cannot directly INSERT/UPDATE/DELETE
  //     — every write must go through the SECURITY DEFINER RPCs.
  // ============================================================
  await asClient(SUPER);
  // read is allowed (dashboard list)
  r = await db.query(`select count(*)::int n from school_invitations`);
  ok('super_admin can READ invitations directly (dashboard list)', r.rows[0].n >= 1);

  // direct writes are blocked (no write policy exists anymore)
  ok('super_admin cannot directly INSERT into school_invitations',
    await throws(() => db.query(
      `insert into school_invitations (school_id, invitee_email, intended_role) values ('${schoolId}', 'hacker@x.com', 'school_admin')`)));
  ok('super_admin cannot directly UPDATE school_invitations status (e.g. force-accept)',
    await writeIsBlocked(`update school_invitations set status = 'accepted' where id = '${dup1.invitation_id}'`));
  ok('super_admin cannot directly DELETE school_invitations',
    await writeIsBlocked(`delete from school_invitations where id = '${dup1.invitation_id}'`));

  // but the SECURITY DEFINER RPC path still works (bypasses RLS as the owner)
  const relive = (await db.query(`select sa_cancel_invitation('${dup1.invitation_id}') as r`)).rows[0].r;
  ok('the secure RPC path can still write (sa_cancel_invitation works for super_admin)', relive.status === 'cancelled');

  // ============================================================
  // 13. email delivery status (migration 0002) is server-recorded
  // ============================================================
  await asClient(SUPER);
  const delSchool = (await db.query(
    `select sa_create_school_and_invitation('Delivery School','delivery-school','Loc','deliver@x.com','D','+252600000010',14,'school','primary_middle') as r`
  )).rows[0].r;
  await asService();
  r = await db.query(`select email_delivery_status from school_invitations where id = $1`, [delSchool.invitation_id]);
  ok('a new invitation starts as pending_delivery', r.rows[0].email_delivery_status === 'pending_delivery');

  // only super_admin may record delivery
  await asClient(INVITEE); // school_admin
  ok('non-super_admin cannot record invitation delivery',
    await throws(() => db.query(`select sa_mark_invitation_delivery('${delSchool.invitation_id}', 'sent')`)));

  await asClient(SUPER);
  await db.query(`select sa_mark_invitation_delivery('${delSchool.invitation_id}', 'failed', 'SMTP not configured')`);
  await asService();
  r = await db.query(`select email_delivery_status, email_last_error from school_invitations where id = $1`, [delSchool.invitation_id]);
  ok('super_admin can mark delivery failed (with error recorded)', r.rows[0].email_delivery_status === 'failed' && /SMTP/.test(r.rows[0].email_last_error));
  r = await db.query(`select action from audit_logs where entity_id = $1 and action = 'invitation.delivery'`, [delSchool.invitation_id]);
  ok('invitation.delivery is audited', r.rows.length >= 1);

  console.log('');
  console.log(`${failures === 0 ? 'All' : failures} assertion(s) ${failures === 0 ? 'passed.' : 'FAILED'}`);
  if (failures > 0) process.exit(1);
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
