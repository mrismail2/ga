# Kobciye — Phase 5 Correction & Completion Report (2026‑07‑26)

This report covers the **correction and real‑user‑workflow pass** on top of the
delivered Phase 5 archive. An independent review found that several Phase 5
database capabilities existed in migrations/services but lacked complete,
secure, role‑appropriate UIs, and that the landing login was still a mockup for
Students/Parents. This pass closes those gaps **additively** — no delivered
migration was rewritten, and no Phase 1–4 behaviour was changed.

> **Production‑readiness status (per §22): NOT claimed on source alone.**
> Every source‑level task in the brief is complete and the full automated
> suite is green (40/40), but the identifier‑login and provisioning flows
> depend on a live Supabase project, deployed Edge Functions, SMTP, and a
> browser session — **none of which are available in this environment**. All
> live/browser testing is therefore marked **BLOCKED** (see §7). Do not treat
> this as production‑verified until the manual browser checklist passes against
> a real project.

---

## 1. What was corrected / completed

### 1.1 Real landing login (§3) — replaces the Student/Parent mockup
- **`supabase/migrations/20260726000010_phase5_identifier_login.sql`** (new,
  additive, transactional, begins after `…000009`):
  - `schools.login_code` (public, human‑usable code) + backfill + **UNIQUE
    partial index**, plus a `BEFORE INSERT` trigger so RPC‑created schools also
    get a code. The client uses `login_code`, **never the UUID**.
  - `profiles.must_change_password` (forced first‑login change).
  - `login_attempts` table (super‑admin `SELECT` only) for rate‑limiting.
  - `resolve_login_email(school_code, student_id, kind)` — `SECURITY DEFINER`,
    **service‑role only**, resolves the internal email server‑side. For a
    parent it returns the **one** `student_parents.is_primary = true` login
    parent (deterministic lowest‑id tiebreak, §3.4). Returns `NULL` on any
    miss (no enumeration).
  - `is_login_locked`, `record_login_attempt` (audits **without** storing the
    password), `set_school_login_code`, `clear_must_change_password`.
- **`supabase/functions/identifier-login/index.ts`** (new): rate‑limit →
  resolve → anon `signInWithPassword` → record attempt → returns
  `{ok, access_token, refresh_token, must_change_password}`. **Generic 401** on
  every failure. Service‑role key is used **only** inside the function.
- **Client**: `services/supabase.js#signInWithIdentifier` invokes the function
  and installs a **real Supabase session** via `auth.setSession`;
  `context/AuthContext.js` exposes `signInWithSchoolIdentifier`;
  `screens/auth/LoginScreen.js` Student/Parent tabs are now real
  (School ID + Student ID + password, show/hide, forgot‑password link, generic
  errors). The **“Dhawaan / Coming Soon” mockup is gone**.

### 1.2 Account provisioning (§4)
- **`supabase/functions/provision-account/index.ts`**: a no‑email student now
  receives **one‑time credentials shown once** (`school_code`, `student_id`,
  `temp_password`) with `must_change_password = true`. The temp password is
  **never stored in plaintext**. Teacher/Parent invites take an editable,
  validated email before the invite is sent.
- **`screens/phase5/ProvisioningScreen.js`**: editable/validated email field
  (`EMAIL_RE`), one‑time credential modal, resend.

### 1.3 Role‑aware Phase 5 UI (§5) — hide before render
- **`src/domain/phase5Access.js`** (new, pure, unit‑tested): `canCreateModule`,
  `visibleRowActions`, `canRecordPayment`, `canMarkAttendance`. Unauthorised
  create buttons and row actions are **filtered out before render**, not merely
  rejected by RLS (RLS remains the real authority underneath).
- **`components/Phase5ModuleView.js`**: gates create + row actions through those
  rules, and **clears any in‑progress form/selection when the active school
  changes** (§5.5) so a Super‑Admin school switch can’t submit a stale pick.

### 1.4 Attendance role split (§6)
- **`screens/phase5/MyAttendanceScreen.js`** (new): read‑only attendance for
  Student (own) / Parent (linked children, with a child selector). It **never
  marks** (`saveAttendanceSession` absent).
- **`screens/phase5/liveRoutes.js`**: `AttendanceRoute` renders the marking
  screen for Teacher/Admin and the read‑only screen for everyone else.

### 1.5 Previously service‑only capabilities now wired to UI
| Brief | Capability | Screen |
|---|---|---|
| §9 | `enter_result` per‑student roster | `ResultEntryScreen.js` (exams → “Natiijo geli”, Teacher/Admin) |
| §9 | `create_exam_schedule` | `ExamScheduleScreen.js` (exams → “Qorshee”, Admin) |
| §8 | `create_submission` / `grade_submission` | `AssignmentSubmissionsScreen.js` (student submits; teacher grades) |
| §14 | `create_course_enrollment` / `upsert_course_result` | `CourseResultsScreen.js` (University shell → real **Results**) |
| §7 | `create_timetable_period` / `upsert_school_day` | `TimetableScreen.js` (3‑tab editor) |
| §12 | `report_teacher_assignments` / `report_results_summary` + **CSV export** | `ReportsLiveScreen.js` |
| Finance | `generate_invoice` | `FinanceLiveScreen.js` (“Samee biil”, finance staff only) |

Every one of these was verified reachable: routes are registered in
`RootNavigator.js`, `DesktopShell.js` and `domain/navigationPolicy.js` and are
role‑gated; `Phase5ModuleView` forwards `navigation` into row actions.

---

## 2. Security posture (§15)

- **No service‑role key in the client** — asserted by `phase5-ui-wiring` and the
  DB suite; the only service‑role use is inside the two Edge Functions.
- **No plaintext password stored, none logged** — `record_login_attempt` and the
  provisioning path store no password; asserted in `phase5_identifier_login`.
- **Rate‑limiting** (5 failures / 15 min) + **generic errors** + **no
  enumeration** — resolver returns `NULL` on any miss; the function returns a
  single generic 401.
- **RLS / tenant isolation** enforced and tested (cross‑school reads refused;
  teacher refused admin actions; student/parent scoped reads).
- **Validated selected school** — every school‑scoped service call requires a
  real UUID (`requireSchool`); Super‑Admin must pick a school (no `"*"`/null).
- **Privileged actions audited**; **server/DB is the authority** on every
  sensitive op; the client never decides authorization alone.

---

## 3. Migrations — order & policy

Delivered Phase 5 migrations `…000001`–`…000009` are **unchanged**. The single
corrective migration is **additive and transactional**:

```
20260726000010_phase5_identifier_login.sql   (new — the only DB change this pass)
```

Apply order is lexicographic (Supabase default). Run the **read‑only preflight**
`KOBCIYE_PHASE5_CORRECTION_PREFLIGHT_20260726.sql` against a branch/copy first;
proceed only when every `blocking_rows = 0`. No `supabase db reset` and no
remote deploy/reset were run.

---

## 4. Files added / changed (source)

**Added**
- `supabase/migrations/20260726000010_phase5_identifier_login.sql`
- `supabase/functions/identifier-login/index.ts`
- `supabase/tests/phase5_identifier_login.test.js`
- `mobile/src/domain/phase5Access.js`
- `mobile/src/screens/phase5/MyAttendanceScreen.js`
- `mobile/src/screens/phase5/ResultEntryScreen.js`
- `mobile/src/screens/phase5/ExamScheduleScreen.js`
- `mobile/src/screens/phase5/AssignmentSubmissionsScreen.js`
- `mobile/src/screens/phase5/CourseResultsScreen.js`
- `mobile/scripts/phase5-role-access.test.js`
- `KOBCIYE_PHASE5_CORRECTION_PREFLIGHT_20260726.sql`
- `KOBCIYE_PHASE5_CORRECTION_REPORT_20260726.md` (this file)
- `KOBCIYE_PHASE5_EDGE_FUNCTIONS_DEPLOY_20260726.md`
- `KOBCIYE_PHASE5_CORRECTION_MANUAL_BROWSER_TEST_20260726.md`

**Changed**
- `supabase/functions/provision-account/index.ts`
- `mobile/src/context/AuthContext.js`
- `mobile/src/services/supabase.js`, `mobile/src/services/phase5.js`
- `mobile/src/screens/auth/LoginScreen.js`
- `mobile/src/components/Phase5ModuleView.js`, `mobile/src/components/DesktopShell.js`
- `mobile/src/navigation/RootNavigator.js`, `mobile/src/navigation/UniversityAppShell.js`
- `mobile/src/domain/navigationPolicy.js`
- `mobile/src/screens/phase5/{AssignmentsScreen,ExamsResultsScreen,FinanceLiveScreen,ReportsLiveScreen,TimetableScreen,DisciplineScreen,ProvisioningScreen,liveRoutes}.js`
- `mobile/scripts/{onboarding-guards,phase5-ui-wiring}.test.js`, `mobile/package.json`

**Removed:** none (all changes are additive; no delivered migration rewritten).

---

## 5. Build verification

- `npm install` — dependencies already present; no changes required.
- `npx expo export --platform web --clear` — **clean**; 2 web bundles; browser
  title remains **`Kobciye School Management`**.

---

## 6. Automated test results — PASS

- **Mobile (source/logic) suites: 25 / 25 PASS** (`test:onboarding`,
  `test:phase5-ui`, `test:phase5-role-access`, all Phase 1–4 suites, …).
- **Supabase (pglite, real migrations) suites: 15 / 15 PASS** (`phase5_core`,
  `phase5_identifier_login`, `security`, all Phase 3/4 suites, …).
- **Total: 40 / 40 PASS.** No FAIL.

`phase5-role-access` executes the **real shipped** `phase5Access.js` rules
(logic test, not a source scan): teacher sees *Submit* but not
*Approve/Publish*; student/parent see no admin actions; only finance staff
record payments; student/parent get read‑only attendance; empty/garbage roles
fall back to admins‑only.

---

## 7. Live testing — BLOCKED (explained)

The following require a live Supabase project + deployed Edge Functions + SMTP
+ a browser, none available here. They are **not** claimed as verified:

- **BLOCKED** — Real identifier login producing a Supabase session (Student =
  School ID + Student ID + password; Parent = School ID + Child Student ID +
  parent password) end‑to‑end in a browser.
- **BLOCKED** — Rate‑limit lockout and generic‑error behaviour observed through
  the deployed `identifier-login` function.
- **BLOCKED** — Provisioning a no‑email student and using the one‑time
  credentials + forced password change.
- **BLOCKED** — Teacher/Parent email invite delivery (SMTP).
- **BLOCKED** — Boolean/enum insert coercion on live PostgREST for the new
  timetable period/day toggles, and `generate_invoice`/`enter_result`/
  `upsert_course_result` round‑trips under real RLS.

The **DB‑level** equivalents of the identifier‑login logic (resolver, primary‑
parent selection, cross‑school rejection, rate‑limit lockout, audit‑without‑
password) **are** proven by `phase5_identifier_login.test.js` against the real
migration in pglite.

Run `KOBCIYE_PHASE5_CORRECTION_MANUAL_BROWSER_TEST_20260726.md` against a real
project to clear these before declaring production readiness.

---

## 8. Deferred / remaining risks

- Live coercion + RLS round‑trips per §7 (BLOCKED here).
- Assignment/exam re‑grade semantics rely on the delivered RPC/insert paths
  (no duplicate‑guard UI beyond the friendly error) — behaves correctly but is
  worth a live pass.
- External payment gateway / mobile‑money and SMS delivery remain out of scope.

---

## 9. Confirmations

- **Phase 1–4 preserved** — all Phase 1–4 suites pass unchanged.
- **Valid Phase 5 DB work preserved** — migrations `…0001–0009` untouched; only
  additive `…0010` added.
- **Approved UI preserved** — landing, branding, dashboard, class layout,
  sidebar, LoadingScreen (K‑logo only), ForgotPasswordScreen, colours/spacing/
  typography unchanged; this pass only adds screens and reveals menu items.
- **No Demo Mode / fake data / static results / fake totals / local‑storage
  Live data / Gabiley Ice / placeholder / “coming soon”** — asserted by the
  wiring test across every Phase 5 screen.
- **No client service‑role secret; no plaintext password stored/logged.**
- **No remote database reset; no remote deployment; no `supabase db reset`.**
- **Production readiness is NOT claimed on source/migrations alone** (§22) —
  live/browser items above are explicitly BLOCKED.
