# Kobciye — Phase 4 Correction Pass

**Date:** 2026-07-24
**Base:** `kobciye_phase1_4_latest_20260724.zip` (continued in place — no older archive, no imports from previous branches)
**Scope:** correction of defects found in real Supabase + browser testing. No Phase 5, no redesign, no remote database work.

---

## 1. Summary

Four defects were reported from real browser testing. All four are fixed, plus the
non-Kobciye files that were still present in the repository root.

| # | Defect | Status |
|---|--------|--------|
| 1 | Super Admin → Classes: `invalid input syntax for type uuid: "*"` | **Fixed** |
| 2 | "Ku dar Arday" → "Kaydi" produced no visible student | **Fixed** |
| 3 | Admissions / guardian workflow failed | **Fixed** |
| 4 | Browser tab title read `undefined` | **Fixed** |
| 5 | Gabiley Ice (non-Kobciye) files in the repository root | **Removed** |

**No new database migration was required.** The existing, already-installed schema
already contained everything needed — including the `admit_student_atomic` RPC that
creates a student and its active enrollment in one transaction. The defects were
entirely in the frontend/application layer, which is where they were corrected.

---

## 2. Root cause analysis

### Defect 1 — `invalid input syntax for type uuid: "*"`

The app has two profile objects, and the school-scoped screens were reading the wrong one.

1. `src/data/roles.js` defines the **demo** Super Admin with `school_id = '*'`
   (a Phase 1/2 sentinel meaning "sees every demo row" when filtering in-memory arrays).
2. `App.js` → `useLiveRoleBridge()` injected the real identity into `RoleContext`, passing
   `school_id: profile.school_id`, which for a real `super_admin` is **`null`**
   (`getMyProfile` only loads a school for non-super, non-pending roles).
3. `RoleContext` merged it with `school_id: liveIdentity.school_id != null ? … : p.school_id`
   — so a `null` real school **fell back to the demo `'*'` sentinel**.
4. `ClassesScreen` (and Students/Teachers/ClassDetail) then did `const schoolId = profile.school_id`
   and passed it to `useCanonicalRows` → `p4List` → `.eq('school_id', '*')`.

Postgres rejected `'*'` as a `uuid`. The sentinel was never meant to leave demo mode; nothing
stopped it, and there was no Super Admin school-selection workflow at all.

### Defect 2 — "Ku dar Arday" saved nothing visible

`P4ModuleView.save()` had a branch for `module.enrollAtomic` (Admissions) but the **students**
module fell through to the generic `p4Create('students', …)`, which inserts a bare `students` row.

Every roster and count in the app deliberately reads the **canonical active-enrollment
collection**, never `students.class_id`:

- `StudentsScreen` / `P4ModuleView` filter students by active `student_enrollments`
- `ClassesScreen` counts `student_enrollments where status='active'`
- `ClassDetailScreen`'s roster is built from active enrollments

So the student *was* written to the database but had **no active enrollment**, making it
invisible in Ardayda, in the class, and in the class's active count — exactly the reported
symptom. It stayed invisible after refresh because the missing row was genuinely missing.

### Defect 3 — Admissions / guardian workflow

Two causes:
- `P4ModuleView` and `GuardianManagementView` read `useAuth().profile.school_id`, which is
  `null` for a Super Admin → `canUse` was false, or queries ran unscoped.
- `guardianLinks.requireSchoolAdmin()` hard-rejected any role that is not `school_admin`,
  so a Super Admin could never manage guardians even after picking a school — while the
  database's own `is_admin_of()` **does** permit it.

### Defect 4 — Browser title `undefined`

`app.json` declares `expo.web.name`, but nothing guaranteed it reached `document.title` at
runtime (a stale export or config drift yields literally `undefined`). The **standalone
landing page had no `<title>` tag at all**.

### Defect 5 — Non-Kobciye files

The repository root still tracked a Gabiley Ice site: `index.html` (`<title> Gabiley Ice</title>`),
`main.js`, `styles.css` and 11 `assets/*.png` ice-cream images.

---

## 3. Files changed

### New files

| File | Purpose |
|------|---------|
| `mobile/src/utils/uuid.js` | The single UUID guard. `isUuid()` / `asUuidOrNull()`. CommonJS so Node tests execute the real shipped guard. |
| `mobile/src/hooks/useActiveSchoolId.js` | The one hook screens use to resolve the active school UUID (+ `needsSchoolSelection`). |
| `mobile/src/components/SchoolSelector.js` | `SchoolSelectPrompt` ("Dooro Dugsi" + the required instruction copy) and `SuperAdminSchoolBar` (shows the active school, "Beddel dugsi" to switch). |
| `mobile/src/utils/webTitle.js` | Sets `document.title` to `Kobciye School Management` unconditionally on web. |
| `mobile/scripts/phase4-super-admin-school-context.test.js` | Section 9A tests. |
| `mobile/scripts/phase4-student-enrollment.test.js` | Section 9B/9C tests. |
| `mobile/scripts/phase4-correction-regression.test.js` | Section 9D tests. |
| `supabase/tests/student_enrollment_workflow.test.js` | Database-level workflow tests against the real migrations. |

### Modified files

| File | Change |
|------|--------|
| `mobile/src/context/SchoolContext.js` | Rewritten as the active-school authority. Super Admin loads the **real** school list via `listSchools()`, picks one, and the selection persists. `activeSchoolId` is always a real UUID or `null` — never `'*'`. School Admin keeps their own school with no selector. |
| `mobile/src/context/RoleContext.js` | Live `school_id` no longer falls back to the demo `'*'` sentinel; a real `null` stays `null`. **This is the direct fix for the crash.** |
| `mobile/src/services/phase4.js` | Added `requireSchoolUuid()` gate on `p4List`, `p4ActiveEnrollments`, `p4ActiveAcademicYear`, `p4Create`, `p4AdmitStudentAtomic`; `p4Counts` returns zeroes for a non-UUID. Added `p4SaveStudentWithEnrollment()`. `p4CreateClassCanonical` accepts an explicit `schoolId`. Friendly-error mapping for `22P02` / `invalid_school_id`. |
| `mobile/src/hooks/useCanonicalRows.js` | Stays inert (and clears rows) unless `schoolId` is a real UUID. |
| `mobile/src/components/P4ModuleView.js` | Uses `useActiveSchoolId()`. **Students module now saves through `p4SaveStudentWithEnrollment` (atomic student + active enrollment)** instead of a bare insert. Error handling keeps the form open. |
| `mobile/src/components/GuardianManagementView.js` | Uses `useActiveSchoolId()`, passes the school to every guardian call, shows the selection prompt when needed. |
| `mobile/src/services/guardianLinks.js` | `requireSchoolAdmin` → `requireSchoolManager(targetSchoolId)`: School Admin keeps their own school; Super Admin may manage the school they picked (UUID-validated). All queries scope to `effectiveSchoolId`. |
| `mobile/src/domain/guardianLinkPolicy.js` | `assertGuardianLinkScope` accepts a Super Admin with `effectiveSchoolId`; cross-school linking still rejected. |
| `mobile/src/services/lessonPlans.js` | Added the same `requireSchoolUuid` gate. |
| `mobile/src/services/supabase.js` | `getSchoolCounts` returns zeroes for a non-UUID school id. |
| `mobile/src/domain/navigationPolicy.js` | Added `canManageSchoolData()` (school-admin **and** super-admin) for **screen** access. `canAccessManagement()` (the nav **menu** item) is unchanged and still school-admin-only. |
| `mobile/src/screens/SchoolManagementScreen.js` | Admits Super Admin, gates on school selection, shows the active-school bar. |
| `mobile/src/screens/ClassesScreen.js` | Uses `useActiveSchoolId()`; selection gate; active-school bar; passes `schoolId` to `AddClassModal`. |
| `mobile/src/screens/StudentsScreen.js` | Uses `useActiveSchoolId()`; selection gate; active-school bar. |
| `mobile/src/screens/TeachersScreen.js` | Uses `useActiveSchoolId()`; selection gate; active-school bar via `headerExtra`. |
| `mobile/src/screens/ClassDetailScreen.js` | Uses `useActiveSchoolId()`. |
| `mobile/src/components/AddClassModal.js` | Accepts a `schoolId` prop for the resolved active school. |
| `mobile/src/screens/dashboards/RoleDashboards.js` | Super Admin dashboard gains a "Dooro Dugsi" / "Maamul \<school\>" entry point. |
| `mobile/App.js` | Calls `setWebTitle()` at startup. |
| `landing/index.html` | Added `<title>Kobciye School Management</title>`, description meta and favicon. |
| `mobile/package.json`, `supabase/tests/package.json` | Registered the new test scripts. |

### Deleted files (non-Kobciye)

`index.html`, `main.js`, `styles.css`, and `assets/` (11 Gabiley Ice images) — removed from the
repository root with `git rm`.

---

## 4. Database changes

**None.** No migration was added, altered or removed. The 21 existing migrations are untouched.

This was verified rather than assumed: `supabase/tests/student_enrollment_workflow.test.js`
applies the **existing** migrations to a disposable in-process Postgres and proves the required
behaviour is already there —

- `admit_student_atomic` creates student + **active** enrollment in one transaction
- a failure rolls the whole call back (no partial student)
- a class/year change closes the old enrollment (`transferred` + `ended_on`) and opens a new one
- guardians are reused, duplicate links rejected, cross-school rejected
- `is_admin_of()` already returns true for `super_admin`, so a Super Admin may operate a school

No remote database was contacted. `supabase db reset` was never run. Nothing was deployed.

---

## 5. Tests

### Run and passed — 29 suites, 0 failures

**Mobile (`cd mobile && npm run <script>`) — 18 suites**

| Suite | Result |
|-------|--------|
| `audit:foundation` | PASS |
| `test:onboarding` | PASS |
| `test:auth-routing` | PASS |
| `test:auth-race` | PASS |
| `test:institution-mode` | PASS |
| `test:university-registration` | PASS |
| `test:invite-callback` | PASS |
| `test:phase3-audit` | PASS |
| `test:phase4-ui` | PASS |
| `test:phase4-runtime` | PASS |
| `test:phase1-4-requirements` | PASS |
| `test:phase1-4-audit-fixes` | PASS |
| `test:phase1-4-final-security` | PASS |
| `test:phase1-4-privacy-security` | PASS |
| `test:phase1-4-membership-message-lesson-guards` | PASS |
| **`test:super-admin-school-context`** (new) | PASS |
| **`test:student-enrollment`** (new) | PASS |
| **`test:correction-regression`** (new) | PASS |

**Supabase — real Postgres via pglite (`cd supabase/tests && npm run <script>`) — 11 suites**

| Suite | Result |
|-------|--------|
| `test` (security) | PASS |
| `test:institution` | PASS |
| `test:invitations` | PASS |
| `test:phase4` | PASS |
| `test:phase4-runtime` | PASS |
| `test:phase4-operational` | PASS |
| `test:audit-fixes` | PASS |
| `test:final-security` | PASS |
| `test:final-privacy-security` | PASS |
| `test:final-membership-message-lesson-guards` | PASS |
| **`test:student-enrollment-workflow`** (new) | PASS |

**Build verification:** `npx expo export --platform web --clear` bundles cleanly
(699 modules, no errors) and the exported `index.html` contains
`<title>Kobciye School Management</title>`.

### Coverage against the requested test list

- **9A Super Admin school context** — no query sends `school_id = "*"`; no UUID filter receives an
  invalid identifier; the selector is shown; no school-specific query runs before selection;
  School A loads School A; switching to School B retains nothing from A; School Admin stays scoped.
- **9B Student creation** — creates `students`; creates **active** `student_enrollments`; correct
  class and academic year; appears in the student list, in Class Detail and in the class active
  count; a failed enrollment produces a visible error and leaves nothing behind; duplicate Save
  clicks create no duplicates.
- **9C Guardian/admissions** — new guardian, existing guardian (by reuse and by id), no guardian;
  enrolled admission creates student + active enrollment; previous enrollment history preserved;
  cross-school linking rejected (both client policy and database).
- **9D Regression** — all pre-existing security, lesson-plan and messaging suites still pass;
  Phase 5 tabs suppressed; no Demo Mode/fake data; browser title is not `undefined`.

### Blocked tests

- **Real Supabase browser testing** — cannot be executed from this environment (no browser session
  against the live project, and the instructions correctly forbid touching the remote database).
  Automated coverage substitutes a real Postgres running the real migrations, but the final
  sign-off must be the manual browser pass in section 6.

---

## 6. Manual test checklist

### School Admin
1. Create academic year → appears in the list
2. Create term
3. Create level (Qaybaha Dugsiga)
4. Create class → appears in Fasallada
5. Create section (Qaybaha Fasalka)
6. Create subject
7. Add teacher, then a teacher assignment
8. **Add student** (Maamulka Dugsiga → Ardayda → Ku dar Arday) — pick class + academic year → Kaydi
9. Link a guardian (Waalidiinta → Ku dar xiriir)
10. Confirm the student appears in **Ardayda**, in **Fasallada → that class → Ardayda**, and in the class's **active count**
11. Refresh the browser — everything above is still there
12. Sign out, sign in again — still there

### Super Admin
1. Sign in
2. Open the school selector ("Dooro Dugsi" on the dashboard, or any school screen)
3. Select a real school
4. **Open Classes — no UUID error** (this was the reported crash)
5. Open Students
6. Add a student
7. Confirm the student belongs to the selected school
8. Switch schools ("Beddel dugsi")
9. Confirm no data leaks between schools

### Teacher
1. See assigned class–subject pairs only
2. Create a lesson plan only for a valid assignment
3. Confirm unassigned pairs are unavailable

### Parent
1. See linked children only
2. Confirm no unrelated student is visible

### Student
1. See own data only
2. Confirm no administrative actions are available

---

## 7. Remaining risks

1. **Not verified in a real browser against the live Supabase project.** Everything is covered by
   automated tests including a real Postgres running the real migrations, but the reported defects
   were found in a browser and the fixes should be confirmed the same way. **The project should not
   be declared production-ready until the Super Admin and student workflows pass real Supabase
   browser testing** (section 6).
2. **Demo-mode `'*'` sentinels remain** in `data/access.js`, `data/identity.js`,
   `utils/dataSelectors.js`, `data/schools.js`, `services/appDataRepository.js`,
   `components/AddStudentModal.js` and `screens/ExamsScreen.js`. They filter in-memory demo arrays
   only. This is safe *because* none of those modules import the Supabase client — a test asserts
   exactly that, so wiring one of them to the database in future fails the suite rather than
   the browser.
3. **Super Admin nav.** A Super Admin still does not get the "Maamulka Dugsiga" menu item (an
   existing test asserts this, and it was preserved). They reach school management through the
   dashboard entry point and the school screens. If the menu item is wanted for Super Admin, that
   is a deliberate follow-up decision, not a bug fix.
4. **Guardian management for Super Admin** relies on `is_admin_of()` returning true for
   `super_admin` — verified in the database tests. RLS remains the authority; no service-role key
   is used anywhere in the client.
5. **`expo.web.name` vs runtime title.** Both are now set. If a stale web export is served, the
   runtime `setWebTitle()` still corrects the tab.

---

## 8. Confirmations

- **No non-Kobciye files are present.** The Gabiley Ice `index.html`, `main.js`, `styles.css` and
  `assets/` images were removed with `git rm`; an automated test scans the whole repository for
  any remaining Gabiley Ice content and passes.
- **No Phase 5 work was started.** Attendance, Timetable, Exams, Results, Finance/Fees,
  Discipline/Cases, Assignments, Transcripts and SMS/WhatsApp remain suppressed in Live Mode.
  Class Detail's only real Live tab is still **Ardayda** — asserted by test.
- **No remote database reset or deployment occurred.** No migration was added or changed;
  `supabase db reset` was never run; the only database used was a disposable in-process pglite
  instance for testing.
- **The approved UI was preserved.** The landing page markup, the dashboard tile grid, the
  Fasallada card grid and FAB are unchanged — asserted by test. The only additions are the
  Super Admin school selector and a compact active-school bar, both of which are new *states*
  required by the fix rather than redesigns of approved screens.
