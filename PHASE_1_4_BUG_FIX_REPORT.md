# PHASE 1–4 BUG FIX REPORT

Date: 2026-07-24 · Branch: `claude/kobciye-sms-continuation-9jw64v`
Baseline: ZIP `kobciye_phase4_corrected_audited` (commit `4ed2689`)

## FINAL VERIFIED RE-AUDIT PASS — 8 remaining defects (this update, same day follow-up)

The audit report file named in this correction request
(`KOBCIYE_FINAL_VERIFIED_REAUDIT_20260724.md`) was **not supplied**
anywhere reachable — the newly uploaded ZIP was confirmed **byte-identical**
to this session's own immediately-prior delivery (zero-output `diff -rq`).
The request's own defect list (sections 2–8) was used directly. Full
defect-by-defect detail: `KOBCIYE_FINAL_VERIFIED_REAUDIT_20260724.md`.

| # | Problem found | Fix | Files |
| --- | --- | --- | --- |
| 1 | `conversation_members.id` (the row's own primary key) was still mutable despite the prior pass's identity trigger | `id` added to the immutable-field list | migration `20260724000002` |
| 2 | `messages.id` and `messages.deleted_at` were still mutable by a recipient despite the prior pass's immutability trigger | both added to the immutable-field list (only `read_at` may change) | migration `20260724000002` |
| 3 | Direct-message SELECT policy proved school isolation only indirectly (sender/recipient join), never checked the row's own `school_id` | explicit `school_id = my_school()` predicate added | migration `20260724000002` |
| 4/5 | A teacher could still create a fully classless/subjectless lesson plan (the assignment-match guard only ran when a class/subject was supplied) | teacher-authored plans now require both non-null AND an exact `teacher_assignments` pair match (deliberate, disclosed change — supersedes the prior pass's "classless draft allowed" test, which is updated in place, not deleted) | migration `20260724000002` |
| 6/7 | `LessonPrepModal`'s Class/Subject pickers used two independently-flattened lists (could offer an invalid combination) and only computed their default selection once at mount (a race if real assignments arrived after the modal opened) | `myTeacherAssignments()` now returns canonical `pairs`; the modal derives class/subject options from those pairs and a dedicated effect re-initializes the selection whenever `pairs` itself changes | `lessonPlans.js`, `LessonsScreen.js`, `LessonPrepModal.js` |
| 8 | (re-confirmation only) Live Mode zero-assignment demo fallback | re-verified against the rewritten pairs-based source; no new defect found | — |

### Verification of this pass's fixes

- `supabase/tests/final_membership_message_lesson_guards.test.js` — 12 PASS
  (new suite, real disposable Postgres): 3 membership-identity assertions,
  5 message-immutability/policy assertions, 3 lesson-plan non-null
  assertions, 1 positive control.
- All 10 pre-existing DB suites re-run with the new migration applied —
  358 total assertions, 0 failures, exit 0 each. One pre-existing test's
  own assertion (`final_security_corrections.test.js` "3b.") was updated
  in place to match the deliberate class/subject non-null rule change
  (disclosed above, not silently altered); two other suites' teacher
  lesson-plan fixtures were given real `teacher_assignments` + non-null
  class/subject data (more realistic regardless of the rule change).
- `mobile/scripts/phase1-4-membership-message-lesson-guards.test.js` — 15
  PASS (new static suite): async-loading race, canonical-pairs-only
  selectors, zero-assignment re-confirmation.
- Two pre-existing static suites updated in place for the renamed
  `teacherAssignmentPairs` prop (was `teacherClassOpts`/`teacherSubjectOpts`):
  `phase1-4-final-security.test.js` §[4], `phase1-4-privacy-security.test.js`
  §[5] — both re-run, all PASS.
- Full existing mobile suite re-run (`audit:foundation`,
  `test:phase4-runtime`, `test:phase1-4-audit-fixes`,
  `test:phase1-4-requirements`, `test:phase1-4-final-security`,
  `test:phase1-4-privacy-security`) — every one PASS, zero regressions.
- `npx expo export --platform web --max-workers 1` — success; title
  exactly `Kobciye School Management`.

### Not fixed / out of scope (honest)

- Live-browser verification of the async-loading-race fix's actual
  interaction timing (open modal → assignments arrive later → selection
  populates) requires a real browser session and cannot be exercised by a
  static source-text test: **BLOCKED — credentials not supplied.**
- `npm run test:stabilization` still does not exist in this project
  (re-checked).
- A guarded soft-delete mechanism for `messages.deleted_at` was
  deliberately NOT implemented — nothing in the current codebase reads or
  writes that column, so the field is simply locked (immutable) alongside
  every other identity/content field until a real requirement exists.

## PRIOR SECURITY RE-AUDIT PASS — 6 remaining defects (2026-07-24, earlier same-day pass)

The audit report file named in this correction request
(`KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md`) was **not supplied**
anywhere reachable this session — verified absent from the workspace, and
the newly uploaded ZIP was byte-identical to this session's own prior
delivery. The request's own 6-item defect list was used directly. Full
defect-by-defect root cause/fix/verification:
`KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md`.

| # | Problem found | Fix | Files |
| --- | --- | --- | --- |
| 1 | A conversation member could UPDATE their own membership row's `conversation_id`/`joined_at` freely, moving themselves into a private conversation they were never invited to | immutable-identity trigger: only `last_read_at` may ever change | migration `20260724000001` |
| 2 | The legacy direct-message SELECT/INSERT policies never excluded conversation rows — a sender removed from a conversation could still read their old conversation message via the direct-message policy (`recipient_id is null` short-circuited the check) | both policies now require `conversation_id IS NULL` explicitly | migration `20260724000001` |
| 3 | A message recipient's UPDATE policy had no field restriction beyond "still my row" — body/sender_id/school_id/conversation_id/etc. were all mutable | immutable-fields trigger: only `read_at` may ever change | migration `20260724000001` |
| 4 | `lesson_plans` policies used `is_staff_of()` (includes accountant); an accountant could set `teacher_profile_id` to their own id and create/read a "teacher" plan; unresolved `teacher_profile_id` was silently ignored | policies now require `my_role()='teacher'` + a real `teachers` row; guard now rejects (never silently drops) an unresolvable `teacher_profile_id` | migration `20260724000001` |
| 5 | `LessonPrepModal` detected Live Mode by array *length*, not type — a Live Mode teacher with zero real assignments silently fell back to demo classes (`Form 5A`/`6B`/`7A`) and free-text subjects | Live Mode now detected by `Array.isArray`; zero-assignment case shows an honest disabled empty state, Save disabled | `LessonPrepModal.js` |
| 6 | `UniversityAppShell.js` had two rendered strings naming "Phase 4"/"Phase 5+" | phase references removed from both empty-state strings; sweep of the rest of the codebase found no other rendered occurrence | `UniversityAppShell.js` |

### Verification of this pass's fixes

- `supabase/tests/final_privacy_and_lesson_security.test.js` — 32 PASS (new
  suite, real disposable Postgres): 7 membership-immutability assertions,
  9 direct/conversation-message-separation assertions, 15 lesson-plan
  assertions (accountant self-insert hole explicitly closed).
- One pre-existing suite (`phase4_operational_roles.test.js`) needed a
  1-line test-setup fix (missing `teachers` row for its teacher fixture —
  tolerated by the old looser guard, correctly rejected by this pass's
  stricter rule); all its other 36 assertions unaffected.
- All 9 pre-existing DB suites re-run with the new migration applied —
  345 total assertions, 0 failures, exit 0 each.
- `mobile/scripts/phase1-4-privacy-security.test.js` — 13 PASS (new static
  suite): zero-assignment lesson state, dev-label removal.
- Full existing mobile suite re-run (`audit:foundation`,
  `test:phase4-runtime`, `test:phase1-4-audit-fixes`,
  `test:phase1-4-requirements`, `test:phase1-4-final-security`) — every
  one PASS, zero regressions.
- `npx expo export --platform web --max-workers 1` — success; title
  exactly `Kobciye School Management`.

### Not fixed / out of scope (honest)

- Live-browser verification of any of these fixes: **BLOCKED — credentials
  not supplied.**
- `npm run test:stabilization` still does not exist in this project
  (re-checked both package.json files).
- `mobile/src/data/landingPageHtml.js` (dead/unreferenced code, confirmed
  via `grep -rl` returning no importers) still contains one "Phase 3"
  string inside its embedded static HTML. Left untouched — it is not a
  runtime UI file (never imported by any active screen) — and disclosed
  here rather than silently ignored, per "do not rewrite unrelated code."

## PRIOR SECURITY CORRECTION PASS — 4 remaining audit defects (2026-07-23)

The audit report file named in this correction request
(`KOBCIYE_FINAL_CORRECTED_INDEPENDENT_AUDIT_20260723.md`) was **not
supplied** anywhere reachable this session — verified absent from the
workspace and from the newly uploaded ZIP (which was byte-identical to this
session's own prior delivery). The request's own 4-item defect list was
used directly. Full defect-by-defect root cause/fix/verification:
`KOBCIYE_FINAL_CORRECTED_INDEPENDENT_AUDIT_20260723.md`.

| # | Problem found | Fix | Files |
| --- | --- | --- | --- |
| 1 | Landing-page UI regressed — the approved phone/dashboard mockup hero was replaced with a paperwork-photo hero (commit `c8fa309`) | reverted (`git revert --no-commit c8fa309`, clean, zero conflicts); `git diff` against the last approved commit is now empty | `mobile/src/screens/landing/KobciyeLanding.js` |
| 2 | Legacy direct-message RLS never checked that sender/recipient/message all shared one school — a forged cross-school `recipient_id` or `school_id` was not rejected at the DB layer | trigger + INSERT/SELECT policies now verify sender/recipient share a school and the message's `school_id` matches both | migration `20260723000002` |
| 3 | Any teacher could read every other teacher's lesson plans; a teacher could create a plan for a class/subject not assigned to them | SELECT policy scoped to `teacher_profile_id = my_uid()`; guard trigger now checks `teacher_assignments` for a matching (class, subject) pair | migration `20260723000002`, `lessonPlans.js`, `LessonPrepModal.js`, `LessonsScreen.js` |
| 4 | ClassDetail Live Mode offered all 5 tabs, including 4 (Xaadiris/Natiijada/Lacagta/Kiisaska) still backed by the disconnected Phase 1/2 demo store | `LIVE_TABS = ['Ardayda']` restricts Live Mode to the one tab with real canonical wiring; demo mode unaffected | `ClassDetailScreen.js` |

### Verification of this pass's fixes

- `supabase/tests/final_security_corrections.test.js` — 19 PASS (new suite,
  real disposable Postgres): 7 direct-message assertions, 12 lesson-plan
  assertions.
- All 8 pre-existing DB suites re-run with the new migration applied —
  313 total assertions, 0 failures, exit 0 each.
- `mobile/scripts/phase1-4-final-security.test.js` — 16 PASS (new static
  suite): landing restoration, lesson-plan dropdown wiring, ClassDetail
  tab suppression, re-confirmed stable-classId routing.
- `npm run audit:foundation` caught the new `assignedClasses` prop name
  colliding with a pre-existing forbidden-legacy-token check; renamed to
  `teacherClassOpts`/`teacherSubjectOpts` — re-ran clean.
- Full existing mobile suite re-run (`test:phase4-runtime`,
  `test:phase1-4-audit-fixes`, `test:phase1-4-requirements`) — every one
  PASS, zero regressions.
- `npx expo export --platform web --max-workers 1` — success; title
  exactly `Kobciye School Management`; landing-page approved mockup
  present in the bundle, paperwork-photo strings absent.

### Not fixed / out of scope (honest)

- Live-browser verification of any of these fixes: **BLOCKED — credentials
  not supplied.**
- `npm run test:stabilization` still does not exist in this project
  (re-checked both package.json files) — reported as such, not fabricated.

## PRIOR CORRECTION PASS — independent-audit defects

The audit report file named in the correction request
(`KOBCIYE_PHASE1_4_INDEPENDENT_AUDIT_20260723.md`) was **not actually
supplied** anywhere reachable this session; the request's own numbered
defect list was used directly instead. Full defect-by-defect root
cause/fix/verification: `KOBCIYE_PHASE1_4_INDEPENDENT_AUDIT_20260723.md`.

| # | Problem found | Fix | Files |
| --- | --- | --- | --- |
| 12 | User-facing "Maamulka Dugsiga (Phase 4)" label | text corrected to "Maamulka Dugsiga" | `RoleDashboards.js` |
| 13 | ClassDetail routed by the entire class object/array, not a stable id; teacher access check compared against stale demo IDs that could never match real UUIDs | live navigation now passes `{ classId }` only; ClassDetailScreen loads the class from the canonical repository by id and treats RLS-scoped visibility as the authorization | `ClassesScreen.js`, `ClassDetailScreen.js`, `phase4.js` |
| 14 | Name-slugified class ids (`classId()` from `mock.js`) could theoretically leak into live routing | live mode never calls `classId()`; the canonical Supabase uuid is the only id used end to end | `ClassDetailScreen.js` |
| 15 | `ClassDetailScreen` fell back to `'school_001'` when a live class's school id was unavailable | fallback removed; live queries now short-circuit to "not loaded" instead of assuming a default school | `ClassDetailScreen.js` |
| 16 | RLS let any staff member (teacher, accountant) read every class/student in the school, not just assigned ones | `"school members read classes"`/`"staff read students"` dropped; replaced with admin-full-school OR teacher-of-assigned-class/student, via 2 new `SECURITY DEFINER` functions | migration `20260723000001` |
| 17 | `admit_student_atomic` overwrote the existing active enrollment row in place on a class change, destroying history | rewritten to close (status='transferred', ended_on=today) + insert-new; unchanged resubmission is a no-op | migration `20260723000001` |
| 18 | Student counts (dashboard, class card, ClassDetail roster, School Management) read raw `students`/`students.class_id`, not active enrollments | all four now derive from the canonical active `student_enrollments` collection | `supabase.js`, `phase4.js`, `ClassesScreen.js`, `ClassDetailScreen.js`, `P4ModuleView.js` |
| 19 | `lesson_plans` missing `objectives`/`materials`/`lesson_content`/`homework_note`/`teacher_id` | all 5 added (additive, nullable); status check **widened** (never narrowed) to also accept `'ready'`, preserving the shipped review workflow | migration `20260723000001` |
| 20 | `conversations`/`messages` missing `type`/`updated_at`/`message_type`/`attachment_uri`/`deleted_at` | all 5 added additively | migration `20260723000001` |

### Verification of the correction-pass fixes

- `supabase/tests/phase1_4_audit_fixes.test.js` — 30 PASS (new suite, real
  disposable Postgres): 14 teacher/admin RLS scoping assertions, 11
  enrollment-history assertions, 5 schema-completeness assertions.
- All 7 pre-existing DB suites re-run with the new migration applied —
  226+37=263 PASS total, exit 0 each (zero regressions from the RLS
  narrowing or the `admit_student_atomic` rewrite).
- `mobile/scripts/phase1-4-audit-fixes.test.js` — 27 PASS (new static
  suite).
- Full existing mobile suite re-run (11 scripts) — every one PASS.
- `npx expo export --platform web --max-workers 1` — success; title
  `Kobciye School Management`.

### Not fixed / out of scope (honest)

- Live-browser verification of any of these fixes: **BLOCKED — credentials
  not supplied**.
- `npm run test:stabilization` does not exist in this project (checked
  both package.json files and every script) — reported as such, not
  fabricated.
- `lesson_plans.status` intentionally still accepts the pre-existing
  `pending`/`approved`/`rejected` values alongside the newly-required
  `draft`/`ready` — narrowing would have deleted already-shipped,
  already-verified functionality (see the independent-audit write-up §9).

## ORIGINAL FIXES (prior session, preserved)

| # | Problem (in the imported baseline) | Fix | Files |
| --- | --- | --- | --- |
| 1 | Expo web entry pointed at `node_modules/expo/AppEntry.js` — web export brittle | standard `index.js` entry with `registerRootComponent`; `main` corrected | `mobile/index.js` (new), `mobile/package.json` |
| 2 | Maamulka Dugsiga and the main menu operated as separate systems (menu screens used demo arrays/local state even in live mode) | one canonical repository + change bus; menu screens read the same Supabase rows and reload on every canonical mutation | `mobile/src/services/canonicalStore.js` (new), `mobile/src/hooks/useCanonicalRows.js` (new), `mobile/src/services/phase4.js`, `ClassesScreen`, `TeachersScreen`, `StudentsScreen`, `ClassDetailScreen`, `P4ModuleView`, `RoleDashboards` |
| 3 | Fasallada could not create a canonical class (modal appended a display array only) | live path in the SAME modal saves through `p4CreateClassCanonical` — School Admin check, `profile.school_id`, active academic year, selected level → `school_sections`, duplicate-name protection, stable DB uuid, double-submit guard | `AddClassModal.js`, `phase4.js` |
| 4 | Admissions could not link a guardian; enrolment was a plain row insert (partial-student risk) | guardian selection/creation + relationship in the existing form; enrolment runs `admit_student_atomic` (one transaction, full rollback on failure, duplicate + cross-school links rejected) | `phase4Modules.js`, `P4ModuleView.js`, `phase4.js`, migration `20260717000001` |
| 5 | No student_enrollments/lesson_plans/conversations tables; no atomic RPC (the reported 20260717000001 migration was missing from every source) | migration re-implemented: `student_enrollments`, `lesson_plans`, `conversations`, `conversation_members`, `messages.conversation_id`, `admit_student_atomic`, guard triggers, RLS, `my_uid()` helper | `supabase/migrations/20260717000001_additional_phase1_4_requirements.sql` (new) |
| 6 | Web app had no Sign Out (sidebar footer showed profile only) | Sign Out button in the sidebar footer wired to the real `AuthContext.signOut` (Supabase session termination + full state clear); change-bus listeners dropped on live-mode end | `Sidebar.js`, `canonicalStore.js` |
| 7 | Macallimiinta showed static demo teachers in live mode; profile modal fabricated phone/email for real teachers | live branch renders canonical `teachers` only, with honest empty state; modal shows real fields or “—” live | `TeachersScreen.js`, `TeacherProfileModal.js` |
| 8 | Casharrada seeded demo LESSONS for every user, including live | `LessonsContext` live branch loads canonical `lesson_plans`; drafts persist; DB-enforced admin-only approval | `LessonsContext.js`, `mobile/src/services/lessonPlans.js` (new) |
| 9 | Messages showed fake contacts/threads/unread counts and simulated voice notes in live mode | live branch uses canonical conversations/members/messages; “Weli wada-hadal ma jiro.” empty state; unread via `last_read_at`; voice/photo disabled live (never simulated) | `MessagesScreen.js`, `mobile/src/services/messaging.js` (new) |
| 10 | Student/class cards would show fake “att%” for live records | attendance renders “—” when no live source exists (no fake numbers, no visual redesign) | `StudentRow.js`, `ClassesScreen.js` |
| 11 | RLS `INSERT … RETURNING` on conversations failed for the creator (not yet a member) | creator-visibility clause added to the conversations SELECT policy | migration `20260717000001` |

## Verification of the fixes

- `supabase/tests/phase4_operational_roles.test.js` — 40 PASS (new suite,
  real disposable Postgres via pglite).
- All six pre-existing DB suites re-run with the new migration applied —
  226 PASS total, exit 0 each.
- Full existing mobile suite re-run — every script PASS.
- `mobile/scripts/phase1-4-requirements.test.js` — 44 PASS (new static suite).
- `npx expo export --platform web` — success; `dist/index.html`, title
  `Kobciye`, bundle + assets produced.

## Not fixed / out of scope (honest)

- Live-browser role verification (Sign Out per role, live sync flows in a
  real browser against a real Supabase project): **BLOCKED — credentials not
  supplied**.
- Demo-mode behaviour intentionally untouched.
