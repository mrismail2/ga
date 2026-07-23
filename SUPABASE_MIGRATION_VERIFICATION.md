# SUPABASE MIGRATION VERIFICATION

Date: 2026-07-24 · Branch: `claude/kobciye-sms-continuation-9jw64v`

## Migration set (current, this pass — 2026-07-24)

`supabase/migrations/` contains 20 migrations, `20260702000001` …
`20260724000001`. The newest,
`20260724000001_final_privacy_and_lesson_security.sql`, is NEW this pass —
**purely additive** on top of `20260723000002` (no table dropped, no
column dropped, no user row deleted, no already-applied migration file
edited). It:

- adds `phase4_guard_conversation_member_identity()`, a `BEFORE UPDATE`
  trigger on `conversation_members` that rejects any change to
  `conversation_id`, `profile_id`, or `joined_at` — only `last_read_at`
  may ever change on an existing membership row
- replaces the `messages` INSERT policy `"send direct messages in
  school"` and SELECT policy `"read own direct messages"` (both `create
  or replace`... i.e. `drop policy if exists` + `create policy`, same
  names) to additionally require `conversation_id IS NULL`, so neither
  policy can ever match a conversation message; the recipient `"marks
  read"` UPDATE policy gained the same guard
- adds `phase4_guard_message_immutability()`, a `BEFORE UPDATE` trigger on
  `messages` that rejects any change to `body`, `sender_id`,
  `recipient_id`, `school_id`, `conversation_id`, `message_type`,
  `attachment_uri`, or `created_at` — only `read_at` may ever change
- replaces the `lesson_plans` SELECT/INSERT/UPDATE teacher policies to
  require `my_role() = 'teacher'` and `school_id = my_school()` explicitly
  (not the broader `is_staff_of()`, which also matches accountant); INSERT/
  UPDATE additionally require a real, same-school `teachers` row linked to
  the caller
- extends `phase4_guard_lesson_plans()` (`create or replace function`,
  same signature) so an unresolvable `teacher_profile_id` (no matching
  `teachers` row) is **rejected**, not silently left `null`, for every
  caller including admins; the assignment-match check now reads the
  guaranteed-resolved `teacher_id` directly

The School Admin's own `"admins manage lesson_plans"` `for all` policy,
the conversation-message policies, and every unrelated table/policy are
untouched by this migration.

## Migration set (prior pass, unchanged this pass — 2026-07-23)

The previous newest migration,
`20260723000002_final_security_corrections.sql`, is unchanged this pass —
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

## Migration set (earlier pass, unchanged this pass — 2026-07-23, first correction)

`20260723000001_phase1_4_independent_audit_fixes.sql` is unchanged this
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

Every suite boots a fresh pglite Postgres, applies ALL 20 migrations in
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
node final_security_corrections.test.js
node final_privacy_and_lesson_security.test.js   # NEW this pass
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
| final_security_corrections.test.js | 19 | PASS (exit 0) |
| **final_privacy_and_lesson_security.test.js (new)** | **32** | **PASS (exit 0)** |

Total: **345 assertions, 0 failures.** All 9 pre-existing suites were
re-run because the migration set (immutability triggers + RLS/guard changes
on `conversation_members`, `messages`, `lesson_plans`) changed — they all
still pass with `20260724000001` applied, confirming the tightened
policies introduced zero regressions. One suite
(`phase4_operational_roles.test.js`) needed a 1-line test-setup fix (its
teacher fixture was missing an explicit `teachers` row — tolerated by the
old looser guard, correctly required by this pass's stricter rule); all its
other assertions were unaffected.

Key new-suite evidence (`final_privacy_and_lesson_security.test.js`): a
conversation member can update their own `last_read_at` but not
`conversation_id`/`profile_id`/`joined_at`, and cannot move their
membership into another same-school conversation; a non-member cannot
insert themselves into a private conversation; same-school direct
messaging works and cross-school is blocked; the direct-message policies'
deployed SQL is confirmed to require `conversation_id IS NULL`; a
conversation-message sender loses read access the moment they're removed
from `conversation_members` (the exact closed bug); a recipient can update
only `read_at` — not `body`/`sender_id`/`school_id`/`conversation_id`; a
teacher can create a plan for an assigned class+subject but not an
unassigned one, and cannot use another teacher's `teacher_profile_id`; an
accountant can no longer create a "teacher" plan for themselves (the exact
closed hole) and reads zero; parent/student are blocked from both read and
create; cross-school teacher/admin access stays blocked.

## Application instructions (for later — NOT run against production here)

To apply to a real Supabase project, in order:

```
supabase db push   # or: run each file in supabase/migrations/ in filename
                    # order via the Supabase SQL editor / CLI migrate command
```

`20260717000001_additional_phase1_4_requirements.sql`,
`20260723000001_phase1_4_independent_audit_fixes.sql`,
`20260723000002_final_security_corrections.sql`, and
`20260724000001_final_privacy_and_lesson_security.sql` are all additive
and safe to run on a database that already has data — none drops a table,
drops a column, or deletes an existing row. Each depends on the previous
one already being applied (`20260724000001` replaces functions and
policies first created/altered in the three earlier files).

## npm scripts

`supabase/tests/package.json` gained `test:final-privacy-security` (`node
final_privacy_and_lesson_security.test.js`), appended to the
`test:phase4-db-rls` script chain alongside the prior `test:audit-fixes`
and `test:final-security`.
