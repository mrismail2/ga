# SUPABASE MIGRATION VERIFICATION

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`

## Migration set (current, this pass)

`supabase/migrations/` contains 19 migrations, `20260702000001` …
`20260723000002`. The newest,
`20260723000002_final_security_corrections.sql`, is NEW this pass —
**purely additive** on top of `20260723000001` (no table dropped, no
column dropped, no user row deleted, no already-applied migration file
edited). It:

- extends `phase4_guard_conversation_messages()` (`create or replace
  function`, same signature) so the legacy direct-message branch verifies
  the sender's school, rejects a forged `school_id`, and — when a
  `recipient_id` is present — rejects a recipient in a different school
- replaces the `messages` INSERT policy `"send messages in school"` with
  `"send direct messages in school"` (adds a same-school recipient check)
- replaces the `messages` SELECT policy `"read own messages"` with `"read
  own direct messages"` (adds a same-school sender/recipient check)
- replaces the `lesson_plans` SELECT policy `"staff read lesson_plans"`
  with `"teachers read own lesson_plans"` (`teacher_profile_id = my_uid()`
  only; the school admin's existing full-school `for all` policy is
  unchanged)
- extends `phase4_guard_lesson_plans()` (`create or replace function`,
  same signature) so a non-admin author's class/subject must match an
  active row in `teacher_assignments` for that teacher; a class/subject-less
  draft remains allowed unchanged
- adds a `teacher_assignments(teacher_id, class_id, subject_id)` index for
  the new guard/policy lookups

The conversation-based messaging path (`conversation_id IS NOT NULL`) and
every unrelated table/policy are untouched by this migration.

## Migration set (prior pass, unchanged this pass)

The previous newest migration,
`20260723000001_phase1_4_independent_audit_fixes.sql`, is unchanged this
pass —
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

Every suite boots a fresh pglite Postgres, applies ALL 19 migrations in
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
node phase1_4_audit_fixes.test.js
node final_security_corrections.test.js   # NEW this pass
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
| phase1_4_audit_fixes.test.js | 31 | PASS (exit 0) |
| **final_security_corrections.test.js (new)** | **19** | **PASS (exit 0)** |

Total: **313 assertions, 0 failures.** All 8 pre-existing suites were
re-run because the migration set (RLS/guard changes on `messages` and
`lesson_plans`) changed — they all still pass with `20260723000002`
applied, confirming the tightened policies introduced zero regressions.

Key new-suite evidence (`final_security_corrections.test.js`): a same-school
direct message is accepted; a cross-school direct message is rejected; a
forged `sender_id` is rejected; a false `school_id` claim is rejected; an
uninvolved cross-school user cannot read the message while the legitimate
recipient still can; conversation-member messaging is completely
unaffected; a teacher can create a lesson plan for an assigned class+subject
but not an unassigned one (class or subject alone), while a class/subject-less
draft remains allowed; a teacher reads their own plans but not another
teacher's; a school admin still reads every plan in their own school;
accountant/parent/student each read zero lesson plans; a teacher or admin
in another school reads zero of school A's plans.

## Application instructions (for later — NOT run against production here)

To apply to a real Supabase project, in order:

```
supabase db push   # or: run each file in supabase/migrations/ in filename
                    # order via the Supabase SQL editor / CLI migrate command
```

`20260717000001_additional_phase1_4_requirements.sql`,
`20260723000001_phase1_4_independent_audit_fixes.sql`, and
`20260723000002_final_security_corrections.sql` are all additive and safe
to run on a database that already has data — none drops a table, drops a
column, or deletes an existing row. Each depends on the previous one already
being applied (`20260723000002` replaces functions and policies first
created/altered in `20260723000001`/`20260717000001`).

## npm scripts

`supabase/tests/package.json` gained `test:final-security` (`node
final_security_corrections.test.js`), appended to the `test:phase4-db-rls`
script chain alongside the prior `test:audit-fixes`.
