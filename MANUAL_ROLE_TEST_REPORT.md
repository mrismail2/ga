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
  (`mobile/scripts/phase1-4-requirements.test.js`, section E — PASS).
- Route-protection structure: protected shells render only when
  `auth.status === 'signed_in'` (App.js; unchanged behaviour, re-verified by
  the existing auth-routing suites — PASS).
- Database-level role rules (real Postgres, caller JWT semantics):
  admissions/guardian atomicity, duplicate + cross-school rejection,
  teacher/admin lesson-plan rules, members-only messaging —
  `supabase/tests/phase4_operational_roles.test.js`, 40 PASS.

These automated results are NOT claimed as live-browser testing.
