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

`cd mobile && npx expo export --platform web` → **Expect:** exit 0, `dist/`
with `index.html` (title “Kobciye School Management”), JS bundle and assets. *(Already ran —
PASS.)*
