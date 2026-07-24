# KOBCIYE — FINAL CORRECTED INDEPENDENT AUDIT (this session's write-up)

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`
Baseline: uploaded ZIP `bd3a073f-kobciye_phase1_4_final_corrected_20260723.zip`

## Source of this correction request

The task asked this session to read
`KOBCIYE_FINAL_CORRECTED_INDEPENDENT_AUDIT_20260723.md` as the independent
audit report. **That file does not exist anywhere reachable** — it was not
present in the workspace before this pass, and it was not present in the
newly uploaded ZIP (`diff -rq` against the existing workspace showed the ZIP
was byte-identical to this session's own prior delivery — i.e. the user
re-uploaded my own last output, not a new audit document). This is the same
situation as the previous pass's `KOBCIYE_PHASE1_4_INDEPENDENT_AUDIT_20260723.md`,
handled the same way: the correction request's own numbered defect list (4
items) was used directly as the audit findings, and that is disclosed here
rather than fabricating a document that was never supplied. This file is
this session's honest write-up of that defect list, in report form, per the
task's own instruction that this filename be produced with defect-by-defect
detail.

## Defect-by-defect findings, root cause, fix, verification

### 1. Landing-page UI regression

- **Finding**: `mobile/src/screens/landing/KobciyeLanding.js` had been
  visually changed by commit `c8fa309` (replacing the phone/dashboard
  mockup hero with a paperwork-photo hero, removing the arrow glyph, and
  adding new copy/bottom-bar text) during the "paperwork" request earlier
  in this session. Under this task's UI-preservation rule, an unrequested
  visual change to an already-approved screen is a regression, regardless
  of whether an earlier message in the conversation asked for it — the
  correction task's instruction is to restore the immediately previous
  **approved** source.
- **Root cause**: the paperwork-photo hero replacement, though it was a
  direct, explicit user request at the time, was still a landing-page UI
  redesign; this correction pass treats the state immediately before that
  commit as the approved baseline to restore.
- **Fix**: `git revert --no-commit c8fa309` — clean, zero conflicts (the
  paperwork-hero commit touched an isolated wrapper `<div>` region distinct
  from the unrelated logo-swap commit `5a80b2e`). Committed as `b3eecf1
  Restore approved landing-page hero mockup (revert c8fa309)`.
- **File**: `mobile/src/screens/landing/KobciyeLanding.js`.
- **Proof of exact restoration, no unrelated changes**:
  ```
  git diff 5a80b2e HEAD -- mobile/src/screens/landing/KobciyeLanding.js
  ```
  produces **zero output** — the file at the current HEAD (`b3eecf1`) is
  byte-identical to commit `5a80b2e` (the last commit before the
  paperwork-photo change, which itself only swapped the logo asset — an
  earlier, separately approved change that remains intact). The same empty-diff
  check was run against every other landing-related file in the tree
  (`mobile/src/screens/LandingScreen.js`, `mobile/src/data/landingHtml.js`,
  `mobile/src/data/landingPageHtml.js`) — all zero output, confirming no
  unrelated landing-page file was touched by this pass, and the corrected
  browser title (`Kobciye School Management`, commit `84d4c5c`, predates
  `5a80b2e`) remains in place because it was never part of the reverted
  commit.
- **Verification**: `mobile/scripts/phase1-4-final-security.test.js` §[2] —
  5 static assertions (phone-mockup block present, paperwork-hero string
  gone, paperwork bottom-bar string gone, logo swap still present, web
  title still `Kobciye School Management`) — PASS.
- **Result: PASS.**

### 2. Cross-school direct messages not blocked at the database layer

- **Finding**: the legacy (non-conversation) `messages` INSERT/SELECT
  policies checked `sender_id = auth.uid()` / `sender_id/recipient_id =
  auth.uid()` but never verified that the recipient's `school_id` matched
  the sender's, or that the message's own `school_id` matched either
  participant. A same-school-only client UI made this hard to trigger
  normally, but nothing in the database itself would reject a forged
  cross-school `recipient_id` or `school_id` sent directly to the API.
- **Root cause**: the original `20260717000001` migration's direct-message
  policies were written for "any authenticated sender/recipient", not
  "same-school sender/recipient" — the school-boundary check that exists
  everywhere else in the schema (classes, students, lesson_plans, …) was
  missing for this one legacy path.
- **Fix**: new additive migration
  `supabase/migrations/20260723000002_final_security_corrections.sql`:
  - `phase4_guard_conversation_messages()` trigger (`create or replace
    function`, same signature) extended: its legacy direct-message branch
    now resolves the sender's `school_id` from `profiles`, rejects a
    `school_id` on the row that doesn't match the sender's school, and — if
    a `recipient_id` is present — rejects a recipient whose `school_id`
    doesn't match the sender's.
  - `messages` INSERT policy `"send direct messages in school"` (replaces
    `"send messages in school"`): sender must be the caller, `school_id`
    must equal `my_school()`, and any `recipient_id` must resolve to a
    profile in that same school.
  - `messages` SELECT policy `"read own direct messages"` (replaces `"read
    own messages"`): caller must be sender or recipient, AND — for a
    recipient present — sender and recipient must share the same school
    (blocks a same-row read that was somehow inserted before this
    correction, and blocks any future drift).
  - The `conversation_id IS NOT NULL` branch (conversation-based messaging)
    is completely untouched by this migration.
- **Files**: `supabase/migrations/20260723000002_final_security_corrections.sql`.
- **Tests (6 required, all present)**:
  `supabase/tests/final_security_corrections.test.js` §"Direct-message
  cross-school isolation" — 7 assertions: same-school message accepted;
  cross-school message rejected; forged `sender_id` rejected; false
  `school_id` rejected; cross-school read blocked; legitimate recipient can
  still read; conversation-member messaging unaffected. **All PASS.**
- **Result: PASS.**

### 3. Lesson-plan access too broad

- **Finding**: `lesson_plans` SELECT policy `"staff read lesson_plans"` let
  every school-staff member (any teacher, plus accountant, in the same
  school) read every other teacher's lesson plans. The INSERT/UPDATE guard
  validated same-school class/subject/teacher references but never checked
  that the class+subject was actually **assigned** to the creating teacher.
- **Root cause**: the original policy scoped by school only, not by
  teacher ownership; the guard trigger's authorization logic stopped at
  "does this class/subject/teacher exist in my school" rather than "is this
  teacher assigned to this class+subject."
- **Fix**: same migration (`20260723000002_final_security_corrections.sql`):
  - `lesson_plans` SELECT policy `"teachers read own lesson_plans"`
    (replaces `"staff read lesson_plans"`): a teacher may read only rows
    where `teacher_profile_id = my_uid()`. The school admin's existing
    `for all` (full-school) policy is untouched, so admins are unaffected.
    Parent/student/accountant roles have no `lesson_plans` policy at all
    (unchanged) — they get zero rows.
  - `phase4_guard_lesson_plans()` (`create or replace function`, same
    signature) extended: for a non-admin author, when a `class_id` and/or
    `subject_id` is supplied, the trigger now requires a matching, active
    row in `teacher_assignments` (same teacher, same class where supplied,
    same subject where supplied) — otherwise the insert/update is rejected.
    A draft with no class/subject is still allowed unchanged (backward
    compatible with the existing draft workflow). The existing
    admin-only approve/reject check is untouched.
  - New index `teacher_assignments_teacher_class_subject` on
    `teacher_assignments(teacher_id, class_id, subject_id)` for the new
    lookup.
- **Client wiring**: `mobile/src/services/lessonPlans.js` gained
  `myTeacherAssignments(schoolId, profileId)` (real
  `teacher_assignments` → `classes`/`subjects` join, never a hardcoded
  list) and `createLessonPlan` now persists `class_id`/`subject_id` when
  supplied. `mobile/src/components/LessonPrepModal.js` accepts
  `teacherClassOpts`/`teacherSubjectOpts` props — when the caller (Live
  Mode) supplies the teacher's real assignments, the SAME segmented-picker
  visual style sources its options from them instead of the demo
  `CLASS_OPTS`/free-text subject field; when not supplied (demo mode, or a
  teacher with zero assignments yet), the existing behaviour is 100%
  unchanged. `mobile/src/screens/LessonsScreen.js` fetches the signed-in
  teacher's own assignments in Live Mode and passes them through. The
  database guard is the actual enforcement boundary in every case — a
  forged class/subject id can never be saved regardless of what the client
  UI offers.
- **Files**: `supabase/migrations/20260723000002_final_security_corrections.sql`,
  `mobile/src/services/lessonPlans.js`, `mobile/src/components/LessonPrepModal.js`,
  `mobile/src/screens/LessonsScreen.js`.
- **Tests (8 required, all present)**:
  `supabase/tests/final_security_corrections.test.js` §"Lesson-plan
  authorization" — 12 assertions covering: assigned class+subject accepted;
  unassigned class rejected; unassigned subject rejected; class/subject-less
  draft still allowed; own-plan read works; other-teacher-plan read
  blocked; admin reads all school plans; accountant/parent/student blocked
  (0 rows each); cross-school teacher blocked; cross-school admin blocked.
  **All PASS.**
  `mobile/scripts/phase1-4-final-security.test.js` §[4] — 6 static
  assertions confirming the real-assignment wiring exists end to end and
  the demo fallback is untouched. **All PASS.**
- **Result: PASS.**

### 4. Phase-5-style ClassDetail tabs exposed in Live Mode

- **Finding**: `ClassDetailScreen.js` offered all 5 tabs
  (Ardayda/Xaadiris/Natiijada/Lacagta/Kiisaska) to an authenticated Live
  Mode user whenever the base authorization check passed. Only Ardayda
  (the student roster) has real Phase 1–4 canonical wiring (the active-
  enrollment collection); Xaadiris (attendance), Natiijada (results),
  Lacagta (fees), and Kiisaska (discipline cases) still read the Phase 1/2
  demo/AsyncStorage store, which is empty and disconnected in Live Mode —
  offering them is misleading and is later-phase functionality that should
  not be reachable pre-Phase-5.
- **Root cause**: the tab-visibility computation
  (`allowedTabs = isLive ? (allowed ? TABS : []) : ...`) used the full
  5-tab `TABS` constant for any authorized Live Mode user instead of a
  Live-Mode-specific subset.
- **Fix**: `mobile/src/screens/ClassDetailScreen.js` — added `const
  LIVE_TABS = ['Ardayda']` and changed the Live Mode branch to `isLive ?
  (allowed ? LIVE_TABS : [])`. This reuses the exact existing mechanism the
  tab bar already uses to hide a tab (simple array membership/omission) —
  no new UI component, no visual change to the tab bar itself, no source
  file deleted (the module-level `TABS` constant and the four tabs' source
  remain in the file, unused in Live Mode only, per "smallest necessary
  change" — nothing there needs deleting to satisfy the requirement).
  Demo mode is completely unaffected — it still computes its tab set from
  the existing role-aware `getAllowedClassTabs(profile, cls)`.
- **Files**: `mobile/src/screens/ClassDetailScreen.js`.
- **Tests (5 required, all present)**:
  `mobile/scripts/phase1-4-final-security.test.js` §[5] — 3 static
  assertions (LIVE_TABS constant restricts to Ardayda only; allowedTabs
  uses LIVE_TABS when live; demo mode's tab set is unaffected) plus §[—]
  re-confirms the prior pass's 3 stable-classId-routing assertions still
  hold (ClassesScreen navigates with `{ classId }` only; ClassDetailScreen
  loads by canonical id; not-found vs permission-denied distinction
  intact) — **6 total, all PASS**, exceeding the 5 required.
- **Result: PASS.**

## PASS / FAIL / BLOCKED summary

| # | Defect | Result |
| --- | --- | --- |
| 1 | Landing-page UI restored to approved baseline | **PASS** |
| 2 | Cross-school direct messages blocked (DB/RLS) | **PASS** |
| 3 | Lesson-plan access restricted to own/assigned (DB/RLS + client) | **PASS** |
| 4 | Phase-5-style ClassDetail tabs suppressed in Live Mode | **PASS** |
| — | Live-browser verification of any of the above | **BLOCKED — credentials not supplied** |

No item in this pass is reported as PASS while unresolved; no BLOCKED item
is reported as PASS. See `MANUAL_ROLE_TEST_REPORT.md` for the unchanged
live-browser BLOCKED status.
