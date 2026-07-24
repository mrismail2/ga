# PHASE 1–4 MANUAL TEST PLAN

For live verification against a real Supabase project with real accounts.
Every test below that needs real credentials is currently
**BLOCKED — credentials not supplied** (see MANUAL_ROLE_TEST_REPORT.md).
Automated equivalents that already ran are noted per section.

## 0. Setup

1. `cd mobile && npm ci`
2. Configure `mobile/.env` from `mobile/.env.example` (never commit it).
3. Apply all migrations in `supabase/migrations/` (in order) to the project.
4. `npm run web` (or serve `dist/` from `npx expo export --platform web`).

## 1. School Management → Menu

1. Sign in as School Admin. Open Maamulka Dugsiga → Fasallada module → create a class.
2. Open the main-menu Fasallada screen. **Expect:** the class appears.
3. Refresh the browser. **Expect:** the class remains.

*Automated now:* both screens read the same `classes` table
(`phase1-4-requirements` assertions; DB persistence in the pglite suites).

## 2. Menu → School Management

1. In the main-menu Fasallada screen press the existing + button; create a class.
2. Open Maamulka Dugsiga → Fasallada. **Expect:** the SAME class appears, once.
3. **Expect:** one canonical record (same uuid in both views). Refresh → persists.

## 3. Admission and parent linking

1. Maamulka Dugsiga → Diiwaangelinta → add an application; set XAALADDA =
   “La diiwaangeliyay”, choose a class, and EITHER pick an existing guardian
   (WAALID JIRA) OR enter a new guardian name + phone; pick a relationship.
2. **Expect:** the student appears in Ardayda and inside the assigned class.
3. Sign in as the linked parent (once parent accounts are activated).
   **Expect:** parent sees only their linked student.
4. Repeat the same guardian link. **Expect:** rejected (duplicate).
5. Attempt a guardian from another school (API-level). **Expect:** rejected.
6. Refresh. **Expect:** student, admission and link persist.

*Automated now:* the full atomic path, duplicate and cross-school rejection,
and rollback are proven in `supabase/tests/phase4_operational_roles.test.js`
(assertions 1–6b) against a real Postgres.

## 4. Web Sign Out (per role: Super Admin, School Admin, Teacher, Parent, Student)

1. Log in through the web app.
2. Press Sign Out (sidebar footer on desktop; Dheeraad → “Ka bax” on mobile).
3. **Expect:** Supabase session terminated (no auth token in storage),
   routed to Landing/Login.
4. Refresh. **Expect:** still signed out; protected screens unreachable.
5. Browser Back. **Expect:** no protected data reappears.

## 5. Demo removal (new empty school)

1. Open Macallimiinta. **Expect:** zero teachers, honest empty state, no
   demo teacher cards.
2. Open Casharrada. **Expect:** zero lessons, approved empty state.
3. Open Fariimaha. **Expect:** “Weli wada-hadal ma jiro.” — no contacts,
   conversations, messages or unread counts.
4. Create one teacher in Maamulka Dugsiga → appears in Macallimiinta at once;
   dashboard teacher count updates; persists after refresh; not visible to
   another school.

## 6. Expo web export

`cd mobile && npx expo export --platform web --max-workers 1` → **Expect:**
exit 0, `dist/` with `index.html` (title “Kobciye School Management”), JS
bundle and assets. *(Already ran — PASS.)*

## 7. Teacher / Student RLS scoping (new — independent-audit correction)

1. As School Admin, create two classes and assign a teacher to only ONE of
   them (Maamulka Dugsiga → Qoondaynta Macallimiinta).
2. Sign in as that teacher. Open Fasallada. **Expect:** only the assigned
   class appears.
3. Attempt to open the unassigned class directly (e.g. by URL/deep link
   with its id). **Expect:** “Fasalkan lama helin” or a permission-denied
   message — never the class's data.
4. Admit a student into the assigned class. **Expect:** the teacher can see
   this student (in Ardayda scoped to the class, or via ClassDetail).
5. Admit a student into the UNassigned class. **Expect:** the teacher
   cannot see this student anywhere.

*Automated now:* all 5 of these, plus cross-school and admin-full-access
checks, are proven in `supabase/tests/phase1_4_audit_fixes.test.js`
(14 assertions) against a real Postgres.

## 8. Student enrollment history (new — independent-audit correction)

1. Admit a student into Class A.
2. Later, re-run the admission (or a future transfer action) moving the
   same student to Class B.
3. **Expect:** the student's CURRENT class is B (Fasallada, ClassDetail,
   dashboard counts all agree).
4. **Expect:** a query of `student_enrollments` for this student shows TWO
   rows: the original (Class A, `status='transferred'`, `ended_on` set) and
   the new one (Class B, `status='active'`).
5. **Expect:** exactly one row has `status='active'`.

*Automated now:* all 5, plus a no-op-on-resubmission check and a
year-only-change check, are proven in
`supabase/tests/phase1_4_audit_fixes.test.js` (11 assertions).

## 9. Student counts consistency (new — independent-audit correction)

1. In a school with 2 active students and 1 transferred-away student,
   compare: the Dashboard "Tirada Ardayda" count, a class card's student
   count, ClassDetail's roster length, and Maamulka Dugsiga → Ardayda's
   row count.
2. **Expect:** all four agree, and all four count 2 (never 3 — the
   transferred-away student's historical enrollment is excluded).

*Automated now:* `mobile/scripts/phase1-4-audit-fixes.test.js` §8 confirms
every one of these four surfaces reads the same active-enrollment source;
`supabase/tests/phase1_4_audit_fixes.test.js` §5/5b/8 confirm the
underlying enrollment data is correct after a transfer.
