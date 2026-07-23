# SUPABASE MIGRATION VERIFICATION

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`

## Migration set

`supabase/migrations/` contains 17 migrations, `20260702000001` …
`20260717000001`. The last one,
`20260717000001_additional_phase1_4_requirements.sql`, is NEW in this session
(a re-implementation of the previously reported but unrecoverable migration).
It adds:

- `student_enrollments` (one active enrollment per student; same-school guard
  trigger; staff-read / admin-manage RLS)
- `lesson_plans` (teacher-owned drafts, DB-enforced admin-only
  approve/reject, per-school RLS)
- `conversations`, `conversation_members`, `messages.conversation_id`
  (members-only RLS, same-school guard triggers, `last_read_at` unread state,
  legacy direct-message rows untouched)
- `admit_student_atomic(...)` — SECURITY DEFINER RPC: school-admin check,
  same-school validation for class/stream/year/admission/guardian, creates
  student + enrollment + admission + optional parent + guardian link in ONE
  transaction; duplicate guardian links raise `23505`; any failure rolls the
  whole admission back
- `my_uid()` helper (mirrors the `my_role()`/`my_school()` RLS convention)
- anon fully revoked from every new table

**No remote database was touched.** No deploy, no reset, no service-role key.
All verification ran against disposable in-process Postgres (pglite).

## Verification method

Every suite boots a fresh pglite Postgres, applies ALL migrations in filename
order, then attacks the rules as `authenticated`/`anon` clients:

```
cd supabase/tests && npm ci
node security.test.js
node institution_type.test.js
node phase3_invitations.test.js
node phase4_core.test.js
node phase4_runtime_fixes.test.js
node phase4_guardian_upgrade.test.js
node phase4_operational_roles.test.js   # NEW
```

## Results

| Suite | Assertions | Result |
| --- | --- | --- |
| security.test.js | 46 | PASS (exit 0) |
| institution_type.test.js | 27 | PASS (exit 0) |
| phase3_invitations.test.js | 60 | PASS (exit 0) |
| phase4_core.test.js | 48 | PASS (exit 0) |
| phase4_runtime_fixes.test.js | 28 | PASS (exit 0) |
| phase4_guardian_upgrade.test.js | 17 | PASS (exit 0) |
| **phase4_operational_roles.test.js (new)** | **40** | **PASS (exit 0)** |

Total: **266 assertions, 0 failures.** The six pre-existing suites were
re-run because the migration set changed; they all still pass with
`20260717000001` applied.

Key new-suite evidence: atomic admission happy path; admission-upgrade path;
guardian reuse; duplicate-link rejection; cross-school guardian/class/
admission rejection with **zero partial rows left behind**; teacher cannot
enrol; foreign admin cannot enrol; lesson-plan role rules; members-only
conversations incl. cross-school isolation and `last_read_at` unread
transitions; anon locked out of all new tables.

## npm scripts

`supabase/tests/package.json` gained `test:phase4-operational`, and
`test:phase4-db-rls` now includes the new suite.
