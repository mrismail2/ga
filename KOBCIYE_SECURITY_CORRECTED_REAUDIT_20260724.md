# KOBCIYE — SECURITY CORRECTED RE-AUDIT (this session's write-up)

Date: 2026-07-24 · Branch: `claude/kobciye-sms-continuation-9jw64v`
Baseline: uploaded ZIP `127d9bd7-kobciye_phase1_4_final_security_corrected_20260723.zip`

## Source of this correction request

The task asked this session to read
`KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md` as the independent audit
report. **That file does not exist anywhere reachable** — confirmed absent
from the workspace before any work began, and the newly uploaded ZIP was
confirmed byte-identical (`diff -rq`, except `.gitignore`) to this
session's own prior delivery — i.e. the user re-uploaded my own last
output, not a new audit document. This is the same situation as the two
prior passes, handled the same way: the correction request's own 5-item
list was used directly as the audit findings, and that is disclosed here
rather than fabricating a document that was never supplied.

## Defect-by-defect findings, root cause, fix, verification

### 1. Conversation-membership identity was not immutable

- **Root cause**: `"member updates own read state" on conversation_members
  for update using (profile_id = my_uid())` had no explicit `WITH CHECK`
  and no column restriction — Postgres reuses `USING` as the implicit
  `WITH CHECK` when none is given, which pins `profile_id` to the caller's
  own uid, but leaves `conversation_id` and `joined_at` completely
  unrestricted. A member could `UPDATE` their own membership row's
  `conversation_id` to point at a different same-school conversation they
  were never invited to — bypassing the creator/admin-only `INSERT` path
  entirely.
- **Fix**: new trigger `phase4_guard_conversation_member_identity()`
  (`BEFORE UPDATE` on `conversation_members`) rejects any change to
  `conversation_id`, `profile_id`, or `joined_at`; only `last_read_at` may
  ever change, regardless of which RLS policy allowed the `UPDATE`.
- **File**: `supabase/migrations/20260724000001_final_privacy_and_lesson_security.sql`.
- **Tests (6 required, all present)**: `supabase/tests/final_privacy_and_lesson_security.test.js`
  §"Conversation-membership identity immutability" — a member can update
  their own `last_read_at`; cannot change `conversation_id`; cannot change
  `profile_id`; cannot change `joined_at`; cannot move their membership
  into another same-school conversation (re-verified with a real second
  conversation, row confirmed unchanged); a non-member cannot insert
  themselves into a private conversation (regression check on the
  pre-existing creator/admin-only INSERT policy). **7 assertions, all PASS.**
- **Result: PASS.**

### 2. Direct-message policies did not exclude conversation messages

- **Root cause**: the legacy direct-message `SELECT`/`INSERT` policies
  never checked `conversation_id IS NULL`. In practice this meant a
  message's own **sender** could keep reading a **conversation** message
  forever via `"read own direct messages"`, even after being removed from
  `conversation_members` — because `recipient_id` is `null` on a
  conversation row, the policy's `(recipient_id is null or exists(...))`
  clause short-circuited to `true`, so the whole condition reduced to just
  `sender_id = auth.uid()`, with no membership check at all.
- **Fix**: both policies now require `conversation_id IS NULL` explicitly,
  so they can only ever grant access to true legacy direct messages;
  conversation messages remain governed exclusively by
  `"members read conversation messages"` / `"members send conversation
  messages"` (unchanged, membership-gated). The recipient `"marks read"`
  UPDATE policy gained the same `conversation_id IS NULL` guard.
- **File**: `supabase/migrations/20260724000001_final_privacy_and_lesson_security.sql`.
- **Tests (9 required, all present)**: same suite, §"Direct-message /
  conversation-message separation" — same-school direct messaging works;
  cross-school direct messaging blocked; both the SELECT and INSERT policy
  text is confirmed (via `pg_policy` introspection) to require
  `conversation_id IS NULL`; a sender who is still a member can read their
  own conversation message; after being removed from
  `conversation_members`, that same sender can no longer read it (the
  exact bug, closed). **9 assertions, all PASS** (4 + 4a/4 + 1 introspection
  extra = 9 total counting the 3b sub-check).
- **Result: PASS.**

### 3. Message recipients could rewrite any field, not just read_at

- **Root cause**: `"recipient marks read" on messages for update using
  (recipient_id = auth.uid())` had no field-level restriction — nothing
  stopped a recipient from rewriting `body`, `sender_id`, `school_id`,
  `conversation_id`, `message_type`, or `attachment_uri` on an update they
  were otherwise allowed to perform.
- **Fix**: new trigger `phase4_guard_message_immutability()` (`BEFORE
  UPDATE` on `messages`) rejects any change to `body`, `sender_id`,
  `recipient_id`, `school_id`, `conversation_id`, `message_type`,
  `attachment_uri`, or `created_at` — only `read_at` may ever change,
  regardless of which policy allowed the `UPDATE`.
- **File**: `supabase/migrations/20260724000001_final_privacy_and_lesson_security.sql`.
- **Tests**: same suite — a recipient can update `read_at`; cannot modify
  `body`; cannot modify `sender_id`; cannot modify `school_id` (rejected
  either by the new trigger or by the pre-existing sender/school
  consistency guard — both close the hole, so the test accepts either
  message); cannot re-attach a direct message to a conversation via
  `conversation_id`. **5 assertions, all PASS.**
- **Result: PASS.**

### 4. Lesson-plan policies used is_staff_of() (includes accountant) and never required a real teachers row

- **Root cause**: `is_staff_of()` matches `school_admin`, `teacher`, AND
  `accountant`. The `lesson_plans` INSERT policy only required
  `teacher_profile_id = my_uid()` — an **accountant** could set
  `teacher_profile_id` to their own profile id and successfully insert
  (and then read) a "teacher" lesson plan. Separately, the guard trigger's
  `teacher_id` derivation silently left `teacher_id` `null` when no
  matching `teachers` row existed, instead of rejecting the row.
- **Fix**: the `SELECT`/`INSERT`/`UPDATE` teacher policies now explicitly
  require `my_role() = 'teacher'` and `school_id = my_school()` (School
  Admin's separate `"admins manage lesson_plans"` `for all` policy is
  untouched and still covers "read/manage own-school plans"); the INSERT/
  UPDATE policies additionally require a real, same-school `teachers` row
  linked to the caller. The guard trigger now **rejects** (raises an
  exception) rather than silently ignoring a `teacher_profile_id` with no
  matching `teachers` row, for every caller including admins.
- **File**: `supabase/migrations/20260724000001_final_privacy_and_lesson_security.sql`.
  Collateral fix, same mechanism: a School Admin opening the "Diyaari
  Cashar" modal in Live Mode (which the client has never gated to teachers
  only) previously could silently create an orphaned lesson plan with a
  fabricated demo class label under their own non-teacher identity, because
  `teacher_id` was left unresolved rather than rejected. That path is now
  closed on both the DB side (this migration) and the client side (fix #5
  below — a non-teacher live user also has zero real assignments, so they
  now see the same honest empty/disabled state instead of the demo
  fallback).
- **Tests (11 required, all present)**: same suite, §"Lesson-plan
  authorization" — assigned class+subject accepted; unassigned class
  rejected; unassigned subject rejected; forged `teacher_profile_id`
  rejected; own-plan read works; other-teacher-plan read blocked; admin
  reads all school plans; **accountant cannot create a plan for themselves
  (the exact closed hole) and reads zero**; parent blocked (read + create);
  student blocked (read + create); cross-school teacher and cross-school
  admin both blocked. **15 assertions, all PASS.**
  One pre-existing DB suite (`phase4_operational_roles.test.js`) needed a
  one-line test-setup fix: its teacher fixture was created via
  `assign_role()` only, without an explicit `teachers` row — which the old,
  looser guard tolerated silently but this pass's stricter, correct rule
  now (correctly) requires. Added the missing `insert into teachers`
  seed row; all 37 of that suite's other assertions were otherwise
  unaffected and still pass.
- **Result: PASS.**

### 5. LessonPrepModal fell back to demo classes/free-text subjects for a Live Mode teacher with zero assignments

- **Root cause**: the modal detected "Live Mode with real options" by
  checking `teacherClassOpts && teacherClassOpts.length` — but Live Mode
  always passes an **array** (possibly empty), never `null`. An empty
  array is falsy under `.length`, so a Live Mode teacher with genuinely
  zero assignments silently fell through to the exact same branch as Demo
  Mode: the hardcoded `CLASS_OPTS` (`Form 5A`/`6B`/`7A`) and a free-text
  subject field — meaning a real teacher (or, per defect #4's collateral
  finding, a School Admin) could pick a fake class label and free-text
  subject and attempt to save a plan with no real `class_id`/`subject_id`.
- **Fix**: `mobile/src/components/LessonPrepModal.js` now detects Live Mode
  by **type** (`Array.isArray(teacherClassOpts)`), not by length. When
  Live Mode is signalled and the teacher has zero real
  class/subject assignments, the modal renders a dedicated empty/disabled
  explanation (reusing the existing dashed cover-box visual style — no new
  UI element) instead of any class or subject picker, and the Save button
  is disabled (`canSave = title.trim() && !liveHasNoAssignments`), with a
  matching early-return guard inside `save()` itself as defense in depth.
  Demo Mode (no live options passed at all — still `undefined`, not an
  empty array) is completely unaffected: it still renders the original
  `CLASS_OPTS` segmented picker and free-text subject field exactly as
  before.
- **File**: `mobile/src/components/LessonPrepModal.js`.
- **Tests (5 required, all present)**: `mobile/scripts/phase1-4-privacy-security.test.js`
  §[5] — Live Mode is detected by prop type, not length; the zero-assignment
  case is explicitly distinguished and renders the dedicated empty state
  (not the demo picker); Save is disabled in that state, both via the
  button's `disabled` prop and inside `save()` itself; the demo fallback
  is reachable only when Live Mode was never signalled; a Live Mode
  teacher WITH real assignments still gets the real segmented pickers,
  unaffected. **9 assertions, all PASS** (exceeding the 5 required).
- **Result: PASS.**

### 6. University development-phase labels in user-facing text

- **Finding**: `mobile/src/navigation/UniversityAppShell.js` had two
  rendered (not comment) strings naming a development phase: the
  Cohorts/Levels empty-state ("… looma baahna Phase 4.") and the generic
  "not built yet" empty-state ("… horumarinta (Phase 5+).").
- **Fix**: both strings had the parenthetical/trailing phase reference
  removed; the surrounding Somali sentence reads naturally without it. No
  layout, styling, spacing, or component structure was touched — only the
  two text nodes.
- **Sweep**: searched every `.js` file under `mobile/src` for `Phase
  [1-5]+`, `Frontend Preview`, and `Test Data` inside quoted/rendered
  contexts (not header comments). Every other hit across the codebase is
  inside a `/* ... */` doc-comment header (permitted — "development phase
  names may remain only in reports, tests, migrations and comments") or is
  an internal `throw new Error(...)` string in `services/phase4.js`
  (`'Unknown Phase 4 table: ' + table`) that can only fire from a
  programmer passing a hardcoded invalid table key — never reachable from
  user input, never rendered by any screen — left untouched as it is not
  user-facing UI text. One additional occurrence was found and reviewed:
  `mobile/src/data/landingPageHtml.js` (an old, completely unreferenced —
  confirmed via `grep -rl` returning nothing — static HTML string) contains
  "Secure login will be activated in Phase 3." This file is dead code, not
  a runtime UI file (never imported by any active screen), so it was left
  untouched per "do not rewrite unrelated code"; disclosed here rather than
  silently ignored.
- **File**: `mobile/src/navigation/UniversityAppShell.js`.
- **Tests**: `mobile/scripts/phase1-4-privacy-security.test.js` §[6] — the
  two empty-state strings no longer mention a Phase number; no rendered
  `<Text>` content in the file contains "Phase 4" or "Phase 5"; the header
  doc-comment is confirmed still present (comments are exempt). **4
  assertions, all PASS.**
- **Result: PASS.**

## PASS / FAIL / BLOCKED summary

| # | Defect | Result |
| --- | --- | --- |
| 1 | conversation_members identity fields immutable (last_read_at only) | **PASS** |
| 2 | Direct-message policies scoped to conversation_id IS NULL | **PASS** |
| 3 | Message recipients can update only read_at | **PASS** |
| 4 | Lesson-plan role/assignment authorization tightened (accountant hole closed) | **PASS** |
| 5 | Live zero-assignment lesson state — no demo fallback, Save disabled | **PASS** |
| 6 | University development-phase labels removed from rendered UI | **PASS** |
| — | Live-browser verification of any of the above | **BLOCKED — credentials not supplied** |

No item in this pass is reported as PASS while unresolved; no BLOCKED item
is reported as PASS. See `MANUAL_ROLE_TEST_REPORT.md` for the unchanged
live-browser BLOCKED status.
