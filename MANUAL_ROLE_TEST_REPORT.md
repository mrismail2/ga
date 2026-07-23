# MANUAL ROLE TEST REPORT

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`

No real account credentials (and no reachable live Supabase project) were
supplied to this session. Live-browser role testing therefore remains
**BLOCKED** and is NOT reported as PASS. Nothing in this report is invented
test evidence.

## Live browser Sign Out verification

| Role | Result |
| --- | --- |
| Super Admin | **BLOCKED — credentials not supplied** |
| School Admin | **BLOCKED — credentials not supplied** |
| Teacher | **BLOCKED — credentials not supplied** |
| Parent | **BLOCKED — credentials not supplied** |
| Student | **BLOCKED — credentials not supplied** |

## Live browser synchronization / admissions / demo-removal walkthroughs

All live-browser walkthroughs from PHASE_1_4_MANUAL_TEST_PLAN.md:
**BLOCKED — credentials not supplied.**

## What DID run (automated, honest evidence)

- Sign-out logic: static assertions confirm the sidebar action calls the real
  `AuthContext.signOut`, which awaits Supabase `signOut()` and clears
  session/profile/role/mode state; App.js renders Landing/Login for
  `signed_out`, unmounting all protected screens
  (`mobile/scripts/phase1-4-requirements.test.js`, section E — PASS,
  unchanged this pass).
- Route-protection structure: protected shells render only when
  `auth.status === 'signed_in'` (App.js; unchanged behaviour, re-verified by
  the existing auth-routing suites — PASS).
- Database-level role rules (real Postgres, caller JWT semantics):
  admissions/guardian atomicity, duplicate + cross-school rejection,
  teacher/admin lesson-plan rules, members-only messaging —
  `supabase/tests/phase4_operational_roles.test.js`, 37 PASS.
- **New this pass** — Teacher/Student RLS scoping (independent-audit
  correction): a teacher can read an assigned class and its enrolled
  students, cannot read an unassigned class or its students even in the
  same school, an unassigned teacher reads zero classes/students, a school
  admin still reads everything in their own school, and cross-school access
  stays blocked — `supabase/tests/phase1_4_audit_fixes.test.js`, 14
  assertions, real Postgres, PASS.
- **New this pass** — enrollment-history preservation on class transfer:
  the original enrollment row is preserved untouched (class, date) and
  marked `transferred`/`ended_on`; exactly one new `active` row exists
  after a transfer; an identical resubmission is a no-op —
  `supabase/tests/phase1_4_audit_fixes.test.js`, 11 assertions, PASS.
- **New this pass (final security correction)** — cross-school direct
  messages: same-school message accepted, cross-school message rejected,
  forged sender/school_id rejected, cross-school read blocked while the
  legitimate recipient can still read, conversation-based messaging
  unaffected — `supabase/tests/final_security_corrections.test.js`, 7
  assertions, real Postgres, PASS.
- **New this pass (final security correction)** — lesson-plan
  authorization: a teacher can create a plan for an assigned class+subject
  but not an unassigned one, can read their own plans but not another
  teacher's, a school admin still reads every plan in their own school,
  accountant/parent/student each read zero plans, cross-school
  teacher/admin access stays blocked —
  `supabase/tests/final_security_corrections.test.js`, 12 assertions, PASS.
- **New this pass (final security correction)** — ClassDetail Live Mode
  tab restriction and landing-page restoration: static-source assertions
  confirm the Live Mode tab set is `['Ardayda']` only, the approved
  landing-page mockup is back, and the paperwork-photo replacement is gone
  — `mobile/scripts/phase1-4-final-security.test.js`, 16 assertions, PASS.

These automated results are NOT claimed as live-browser testing. Live
role/browser verification (this pass's direct-message and lesson-plan
fixes included) remains **BLOCKED — credentials not supplied**, unchanged
from every prior report.
