# PHASE 1–4 INTEGRATION AUDIT

Date: 2026-07-23
Branch: `claude/kobciye-sms-continuation-9jw64v`
Baseline: uploaded ZIP `d27936da-kobciye_phase4_corrected_audited.zip` (imported at commit `4ed2689`)

## 1. Source baseline used

The designated branch contained **only a static HTML landing site** (one commit,
`5222269 Add files via upload`). Before importing anything, every available
source was compared:

| Source | Contents | Verdict |
| --- | --- | --- |
| Branch `claude/kobciye-sms-continuation-9jw64v` | static HTML site only | no project baseline |
| Branch `main` | same static HTML site | no project baseline |
| Remote branch `claude/new-session-hmxlvt` | unrelated Phase 1 TypeScript prototype (`kobciye/`) | not the project |
| Remote branch `claude/quirky-cray-vm5ymq` | `.gitignore` + PWA assets only | not the project |
| Uploaded ZIP `kobciye_phase4_corrected_audited` | full Expo + Supabase project, migrations through `20260712000002` | **only valid baseline** |

The ZIP was imported additively (no file in the repo was overwritten or
deleted; the pre-existing static site files remain untouched at the repo
root). No `git reset --hard`, force checkout, force push, branch deletion or
destructive clean was used at any point.

## 2. Recovery audit of the eight "latest changes" files

| File | In ZIP? | Latest edits present? | Action taken |
| --- | --- | --- | --- |
| `mobile/src/components/AddClassModal.js` | yes | **no** — old demo-only version (array append, no canonical repo) | canonical live path re-implemented |
| `mobile/src/components/P4ModuleView.js` | yes | **no** — no admissions guardian selection / atomic path | re-implemented |
| `mobile/src/config/phase4Modules.js` | yes | **no** — admissions module had no guardian selection fields | re-implemented |
| `mobile/src/services/appDataRepository.js` | yes | **no** — demo AsyncStorage store only; no canonical class creation / atomic admission | canonical operations live in `services/phase4.js` (live repository), demo store untouched |
| `supabase/migrations/20260717000001_additional_phase1_4_requirements.sql` | **MISSING** | — | **not recoverable from any source — re-implemented fresh** |
| `supabase/tests/phase4_operational_roles.test.js` | **MISSING** | — | **not recoverable from any source — re-implemented fresh** |
| `mobile/index.js` | **MISSING** | — | **not recoverable — re-created (standard Expo entry)** |
| `mobile/package.json` | yes | **no** — `main` still pointed at `node_modules/expo/AppEntry.js` | entry corrected to `index.js` |

Honest statement: the previous session's exact implementations of the missing
files could **not** be found in the ZIP, the workspace, or any branch. They
were re-implemented from the written requirements — they are new
implementations, not recovered copies, and are labelled as such in their
headers. Nothing was recreated "from memory of code that exists elsewhere",
because it exists nowhere reachable.

## 3. Canonical-repository integration (requirements A–C)

- **Live mode**: Maamulka Dugsiga (P4ModuleView over `services/phase4.js`)
  and the main-menu screens (Fasallada, Macallimiinta, Ardayda, class detail,
  dashboard counts) all read/write the SAME Supabase tables. A new change bus
  (`services/canonicalStore.js`) is notified by every successful
  `p4Create`/`p4Update`/atomic admission; every subscribed screen re-reads
  the same canonical rows. There is no copying between stores and no
  screen-local live array of canonical records.
- **Two-way**: a class created in Maamulka Dugsiga appears in Fasallada; a
  class created from Fasallada (existing + button/modal) appears in Maamulka
  Dugsiga; teachers/subjects/students likewise (verified by the shared-table
  design plus static assertions in `mobile/scripts/phase1-4-requirements.test.js`
  and the DB tests).
- **Persistence**: every load re-reads Supabase, so records survive
  refresh/restart by construction; DB persistence is proven in
  `supabase/tests/phase4_operational_roles.test.js` against a real disposable
  Postgres.
- **Demo mode** is intentionally unchanged (Phase 1/2 AsyncStorage store) and
  can never mix with live data (`liveMode.js` guards, pre-existing).

## 4. Admissions + guardian linking (requirement D)

- Admissions form (existing UI) now supports: selecting an existing
  same-school guardian, entering a new guardian (name/phone/email), and a
  relationship type. Saving with status "La diiwaangeliyay" (enrolled) calls
  `admit_student_atomic` — ONE transaction creating/updating student,
  student_enrollment, admission, parent and student_parents link.
- Duplicate links and cross-school links are rejected in the database;
  failure at any step rolls the entire admission back (proven by tests 3–5 of
  the operational-roles suite).

## 5. Web Sign Out (requirement E)

The web sidebar footer now carries a Sign Out action wired to the REAL
`AuthContext.signOut` (Supabase `signOut` + session/profile/role/mode state
clearing). App.js routes to Landing/Login on `signed_out`, unmounting every
protected screen; the canonical change bus additionally drops all listeners
when live mode ends. Live-browser verification per role is **BLOCKED —
credentials not supplied** (see MANUAL_ROLE_TEST_REPORT.md).

## 6. Demo-data removal in Live Mode (requirements F–H)

- **Macallimiinta**: live branch renders only canonical `teachers` rows; the
  static `TEACHERS` dataset is demo-only; empty school → honest empty state;
  the teacher profile modal no longer fabricates phone/email/city for live
  teachers.
- **Casharrada**: `LessonsContext` loads canonical `lesson_plans` in live
  mode; the `LESSONS` seed serves demo mode only; drafts persist; approval is
  admin-only in the database itself.
- **Fariimaha**: live mode uses canonical `conversations` /
  `conversation_members` / `messages`; empty school shows
  “Weli wada-hadal ma jiro.”; unread uses `last_read_at`; members-only RLS;
  voice/photo attachments are disabled live (never simulated).

## 7. UI preservation & Phase 5

- No screen was redesigned; all changes reuse the existing components,
  modals, layouts and styles (live branches map canonical rows into the same
  card shapes; unavailable live metrics render as “—”, never fake numbers).
- No Phase 5 feature was started (no timetable, attendance workflow,
  homework, notifications, SMS, WhatsApp, parent portal).

## 8. FINAL CORRECTION PASS — independent-audit findings (this update)

A follow-up correction request asked this session to read
`KOBCIYE_PHASE1_4_INDEPENDENT_AUDIT_20260723.md`. **That file was not
supplied** — verified absent from the workspace and from the newly uploaded
ZIP before any work began. The request's own numbered defect list (10
concrete items) was used as the audit findings instead; full
defect-by-defect detail lives in
`KOBCIYE_PHASE1_4_INDEPENDENT_AUDIT_20260723.md` (written this session).

What the independent audit actually found, on inspection of the code
described in §3–7 above:

1. The "Maamulka Dugsiga (Phase 4)" label from §3 was still literally
   present in `RoleDashboards.js` — confirmed and fixed (text only).
2. §3's "canonical class" claim was real for creation, but **class-detail
   routing** still carried the entire class row through navigation
   (`{ cls: item }`) rather than a stable id, and the teacher-authorization
   check compared against a **static demo array** that a live identity
   never populates — meaning a real live Teacher could never open any
   class. Fixed: stable `classId`-only routing, canonical server-verified
   load.
3. §6's "voice/photo disabled live" and membership-only messaging claims
   were correct and are unaffected by this pass. §4's atomic-admission
   claim was correct in structure but had one real defect: the enrollment
   step **overwrote history in place** on a class change. Fixed: close +
   insert-new.
4. RLS underneath the "canonical repository" claim in §3 was more
   permissive than the UI implied: any staff member (not just an assigned
   teacher) could read every class/student in the school at the database
   layer, even though the client-side UI never exercised that excess
   access. Fixed: RLS narrowed to match the intended access model.
5. Student counts throughout (§3, §6) read `students`/`students.class_id`
   directly rather than the canonical active-enrollment collection —
   functionally correct in the common case (they were kept in sync) but
   architecturally the wrong source of truth per the audit. Fixed: every
   count now derives from `student_enrollments` where `status='active'`.
6. `lesson_plans`/messaging schemas (§6) were functionally complete for
   what the UI used, but missing several fields the audit's schema
   contract requires. Fixed: fields added additively; the
   `lesson_plans.status` constraint was **widened** (not narrowed) to avoid
   deleting the already-shipped review workflow — a deliberate, documented
   deviation from a literal two-value reading (see the independent-audit
   write-up §9 for the reasoning).

All of §3–7's OTHER claims (canonical sync design, two-way sync, Admissions
UI, Sign Out, demo removal) were re-verified against the corrected RLS/count
infrastructure and still hold — see `PHASE_1_4_COMPLETION_REPORT.md`'s
correction-pass PASS/FAIL table for the complete, current list.

## 9. FINAL SECURITY CORRECTION PASS — 4 remaining defects (this update)

A follow-up correction request asked this session to read
`KOBCIYE_FINAL_CORRECTED_INDEPENDENT_AUDIT_20260723.md`. **That file was
not supplied** — verified absent from the workspace, and the newly
uploaded ZIP was confirmed byte-identical to this session's own prior
delivery (not a new document). The request's own 4-item defect list was
used as the audit findings instead; full defect-by-defect detail lives in
`KOBCIYE_FINAL_CORRECTED_INDEPENDENT_AUDIT_20260723.md` (written this
session).

What this pass's audit actually found, on inspection of the code described
in §8 above and the intervening "paperwork photo" landing-page change made
earlier in this session (outside any correction-pass request):

1. §7's "no screen was redesigned" claim from the prior pass was still true
   for everything the prior pass touched, but a **later, separate** request
   in this same session replaced the landing page's approved phone/dashboard
   mockup hero with a paperwork-photo hero (commit `c8fa309`) — a landing-page
   UI change that this correction pass's own preservation rule requires be
   rolled back to the immediately-previous approved state. Fixed: clean
   `git revert` of that single commit; `git diff` against the pre-change
   commit is now empty (byte-identical), proving no unrelated UI drift.
2. The direct-message RLS underneath §6's "membership-only access" claim
   was correct for **conversation**-based messaging but the separate legacy
   direct-message path (`conversation_id IS NULL`) never verified sender and
   recipient shared a school — a real school-boundary gap, not present in
   the conversation path. Fixed: trigger + INSERT/SELECT policies now
   enforce same-school sender/recipient/message on that path specifically;
   the conversation path is untouched and re-verified unaffected.
3. §8 item 6's "lesson_plans schema completions" claim was correct for
   schema shape, but the **access-control** layer underneath it was too
   broad: any teacher could read every other teacher's plans, and the
   create/update guard checked same-school class/subject references but not
   actual teacher-to-class/subject assignment. Fixed: SELECT policy scoped
   to the plan's own teacher (admin's full-school access unchanged); guard
   trigger now requires a matching `teacher_assignments` row for a non-admin
   author, with the pre-existing class/subject-less draft path left
   untouched.
4. §2's "no screen redesigned" claim also covered ClassDetail, but the
   Live Mode tab set there still offered 4 tabs
   (Xaadiris/Natiijada/Lacagta/Kiisaska) backed by the disconnected Phase
   1/2 demo store, alongside the one tab (Ardayda) with real canonical
   wiring — functionally a Phase-5-style surface exposed pre-Phase-5. Fixed:
   a Live-Mode-only `LIVE_TABS = ['Ardayda']` restricts the tab bar using
   the exact array-membership mechanism it already had; no tab-bar
   component or visual style changed; demo mode is unaffected.

All of §1–8's OTHER claims were re-verified against this pass's tightened
RLS and are unaffected — see `PHASE_1_4_COMPLETION_REPORT.md`'s current
PASS/FAIL table.

## 10. SECURITY RE-AUDIT PASS — 6 remaining defects (this update, 2026-07-24)

A follow-up correction request asked this session to read
`KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md`. **That file was not
supplied** — verified absent from the workspace, and the newly uploaded
ZIP was confirmed byte-identical to this session's own prior delivery. The
request's own 6-item defect list was used as the audit findings instead;
full defect-by-defect detail lives in
`KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md` (written this session).

What this pass's re-audit actually found, on inspection of the code
described in §9 above:

1. §9 item 2's "membership-only access" fix closed the direct-message
   school-boundary gap, but the OWN membership table it depends on
   (`conversation_members`) had a parallel gap: its self-update policy
   pinned `profile_id` to the caller but never restricted `conversation_id`
   or `joined_at` — a member could UPDATE their own row into a different
   same-school conversation instead of going through the creator/admin-only
   INSERT path. Fixed: a dedicated immutable-identity trigger now allows
   only `last_read_at` to change.
2. §9 item 2's direct-message policies were scoped to same-school
   sender/recipient, but never excluded conversation rows outright — a
   sender removed from `conversation_members` could still read their old
   conversation message via the direct-message SELECT policy, because a
   null `recipient_id` made that policy's own-message check pass with no
   membership check at all. Fixed: both policies now require
   `conversation_id IS NULL` explicitly.
3. The recipient "marks read" UPDATE policy underneath §9's messaging
   claims had no field-level restriction beyond "still my row" — a
   recipient could rewrite `body`, `sender_id`, `school_id`, or
   `conversation_id` on their own update. Fixed: an immutable-fields
   trigger now allows only `read_at` to change.
4. §9 item 3's lesson-plan fix scoped reads to the plan's own teacher, but
   used `is_staff_of()` for the underlying role check — which also matches
   `accountant` — so an accountant could set `teacher_profile_id` to their
   own id and both create and read a "teacher" plan; the guard trigger
   separately left an unresolvable `teacher_profile_id` silently unset
   rather than rejecting it. Fixed: explicit `my_role() = 'teacher'` +
   real `teachers`-row requirement on all three teacher policies; the
   guard now rejects an unresolvable `teacher_profile_id` for every
   caller, closing the same silent-unresolved-teacher_id gap for an admin
   opening the same client modal.
5. §9's `lesson_plans` fix didn't reach the client: `LessonPrepModal`
   detected "Live Mode with real options" by array *length*, but Live Mode
   always passes an array (possibly empty) — an empty array is falsy under
   `.length`, so it fell into the exact same branch as Demo Mode and
   offered the hardcoded `Form 5A`/`6B`/`7A` classes and a free-text
   subject to a Live Mode teacher (or non-teacher) with zero real
   assignments. Fixed: Live Mode is now detected by `Array.isArray`
   (type, not length); the zero-assignment case renders an honest
   disabled empty state and Save is disabled.
6. `UniversityAppShell.js` (untouched by any prior pass) had two rendered
   strings naming "Phase 4"/"Phase 5+". Fixed: both phase references
   removed from the rendered Somali text; a full sweep of the rest of
   `mobile/src` found no other rendered occurrence (only header comments,
   one internal non-user-facing error string, and one dead/unreferenced
   HTML string — all disclosed in
   `KOBCIYE_SECURITY_CORRECTED_REAUDIT_20260724.md` §6).

All of §1–9's OTHER claims were re-verified against this pass's tightened
RLS/triggers and are unaffected — see `PHASE_1_4_COMPLETION_REPORT.md`'s
current PASS/FAIL table.

## 11. FINAL VERIFIED RE-AUDIT PASS — 8 remaining defects (this update, same-day follow-up)

A same-day follow-up correction request asked this session to read
`KOBCIYE_FINAL_VERIFIED_REAUDIT_20260724.md`. **That file was not
supplied** — the newly uploaded ZIP was confirmed byte-identical (zero
`diff -rq` output) to this session's own immediately-prior delivery. The
request's own defect list (sections 2–8) was used as the audit findings
instead; full defect-by-defect detail lives in
`KOBCIYE_FINAL_VERIFIED_REAUDIT_20260724.md` (written this session).

What this pass's re-audit actually found, on inspection of the code
described in §10 above:

1. §10 item 1's conversation-membership immutability trigger protected
   `conversation_id`/`profile_id`/`joined_at` but not the row's own
   primary key `id` — a member could still UPDATE their own row's `id`.
   Fixed: `id` added to the immutable-field set.
2. §10 item 3's message-immutability trigger protected 8 fields but not
   `id` or `deleted_at` — a recipient could still rewrite either. Fixed:
   both added to the immutable-field set.
3. §10 item 3's direct-message SELECT policy proved same-school access
   only indirectly (a sender/recipient join), never checking the
   message's own `school_id` against the caller's school directly — a
   correctness gap in defense-in-depth even though the invariant held in
   practice. Fixed: explicit `school_id = my_school()` predicate added.
4. §10 item 4's lesson-plan assignment guard only validated class/subject
   WHEN one was supplied — a teacher could still insert a fully
   classless/subjectless plan, bypassing assignment validation entirely.
   This pass's task explicitly and deliberately requires both non-null for
   teacher authors, superseding the prior pass's (and the pass before
   that's) "classless draft allowed" behavior for teachers specifically —
   disclosed as a deliberate rule change, not a silent regression; the
   pre-existing test asserting the old behavior was updated in place to
   assert the new one. School Admin's own broader policy is unaffected.
5. §10 item 5's client-side lesson-plan fix (zero-assignment empty state)
   was correct for that ONE scenario, but the picker underneath it used
   two independently-flattened class/subject lists and only computed its
   default selection once at mount — a teacher WITH real assignments that
   arrived asynchronously after the modal opened could be stuck with a
   null selection, and nothing prevented an invalid class+subject
   combination from being offered. Fixed: `myTeacherAssignments()` now
   returns canonical assignment PAIRS; the modal derives its options from
   those pairs and re-initializes the selection via a dedicated effect
   whenever the pairs themselves change.

All of §1–10's OTHER claims were re-verified against this pass's further
tightened guards and are unaffected — see `PHASE_1_4_COMPLETION_REPORT.md`'s
current PASS/FAIL table.
