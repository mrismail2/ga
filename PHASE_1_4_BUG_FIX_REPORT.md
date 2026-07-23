# PHASE 1–4 BUG FIX REPORT

Date: 2026-07-23 · Branch: `claude/kobciye-sms-continuation-9jw64v`
Baseline: ZIP `kobciye_phase4_corrected_audited` (commit `4ed2689`)

## Fixes completed in this session

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
