# SUPABASE MIGRATION VERIFICATION

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`

## Migration set

`supabase/migrations/` contains 18 migrations, `20260702000001` …
`20260723000001`. The last one,
`20260723000001_phase1_4_independent_audit_fixes.sql`, is NEW this session —
**purely additive** on top of `20260717000001` (no table dropped, no column
dropped, no user row deleted). It:

- narrows `classes`/`students` SELECT RLS: drops the blanket
  `"school members read classes"` / `"staff read students"` policies,
  replaces them with admin-full-school (unchanged) OR
  teacher-of-assigned-class/student (new, via 2 new `SECURITY DEFINER`
  functions: `is_teacher_of_class`, `is_teacher_of_student`)
- adds `class_exists_in_my_school(uuid)` — lets the client distinguish
  "class doesn't exist" from "exists but I'm not authorized" without
  leaking any class data across that boundary
- adds `student_enrollments.ended_on` and rewrites `admit_student_atomic`
  (`create or replace function`, same signature) so a class/stream/year
  change closes the current active enrollment and inserts a new one,
  instead of overwriting history in place
- completes the `lesson_plans` schema (`objectives`, `materials`,
  `lesson_content`, `homework_note`, `teacher_id`) and **widens** (never
  narrows) its status check to also accept `'ready'`
- completes the `conversations`/`messages` schema (`type`, `updated_at`,
  `message_type`, `attachment_uri`, `deleted_at`)
- adds a `teacher_assignments(class_id)` index for the new policy lookups

The prior session's `20260717000001_additional_phase1_4_requirements.sql`
(re-implementation of the previously-missing migration) is unchanged; it
still adds `student_enrollments`, `lesson_plans`, `conversations`,
`conversation_members`, `messages.conversation_id`, `admit_student_atomic`,
and `my_uid()`.

**No remote database was touched.** No deploy, no reset, no service-role key.
All verification ran against disposable in-process Postgres (pglite).

## Verification method

Every suite boots a fresh pglite Postgres, applies ALL 18 migrations in
filename order, then attacks the rules as `authenticated`/`anon` clients:

```
cd supabase/tests && npm ci
node security.test.js
node institution_type.test.js
node phase3_invitations.test.js
node phase4_core.test.js
node phase4_runtime_fixes.test.js
node phase4_guardian_upgrade.test.js
node phase4_operational_roles.test.js
node phase1_4_audit_fixes.test.js      # NEW this session
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
| phase4_operational_roles.test.js | 37 | PASS (exit 0) |
| **phase1_4_audit_fixes.test.js (new)** | **31** | **PASS (exit 0)** |

Total: **294 assertions, 0 failures.** All 7 pre-existing suites were
re-run because the migration set (and RLS on classes/students) changed —
they all still pass with `20260723000001` applied, confirming the narrowing
introduced zero regressions.

Key new-suite evidence (`phase1_4_audit_fixes.test.js`): a teacher can read
their assigned class and its enrolled students; cannot read an unassigned
class or its students, even in the same school; an admin still reads every
class/student in their own school; cross-school access stays blocked;
`class_exists_in_my_school` correctly distinguishes "not found" from
"exists but not authorized" without leaking data; a class transfer closes
the old enrollment (status='transferred', ended_on set, original class/date
untouched) and opens exactly one new active row; an identical resubmission
is a no-op; the `lesson_plans`/`conversations`/`messages` schema
completions are present and the widened status check still accepts every
pre-existing value.

## Application instructions (for later — NOT run against production here)

To apply to a real Supabase project, in order:

```
supabase db push   # or: run each file in supabase/migrations/ in filename
                    # order via the Supabase SQL editor / CLI migrate command
```

Both `20260717000001_additional_phase1_4_requirements.sql` and
`20260723000001_phase1_4_independent_audit_fixes.sql` are additive and safe
to run on a database that already has data — neither drops a table, drops a
column, or deletes an existing row. `20260723000001` depends on
`20260717000001` already being applied (it alters `student_enrollments`,
`lesson_plans`, `conversations`, `messages`, and replaces
`admit_student_atomic`, all first created there).

## npm scripts

`supabase/tests/package.json` gained `test:audit-fixes`
(`node phase1_4_audit_fixes.test.js`); `test:phase4-db-rls` now runs all 5
DB-RLS suites including it.
