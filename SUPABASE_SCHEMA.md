# Kobciye — Database Schema Reference (Phase 2)

Multi-school (multi-tenant) SaaS schema. Every school-owned row carries a
`school_id`; Row Level Security guarantees a school only ever sees its own
rows. UUID primary keys throughout; `created_at`/`updated_at` timestamps and
status fields where useful.

## Tenancy & people

| Table | Purpose |
|-------|---------|
| `schools` | One row per school (tenant). Holds plan, status, logo, and the per-school student-ID generator (`student_id_prefix`, `next_student_sequence`). |
| `profiles` | One row per **auth user** (`id` = `auth.users.id`, created automatically by the `handle_new_user()` trigger on signup). Carries the user's primary `role` and `school_id`. |
| `school_members` | Membership + role per school. Auto-synced from `profiles` for the single-school case; lets one person hold roles in several schools later. |
| `subscriptions` | Per-school plan/billing state (`trialing → active → past_due → canceled`), first-month-free trial field, price per student. One non-canceled row per school. |
| `audit_logs` | Append-only action trail (`actor`, `action`, `entity`, `detail` JSON). Insert-only by design — no update/delete policies exist. |

## Academics

| Table | Purpose |
|-------|---------|
| `academic_years` | School year container (`2026/2027`); only one `is_current` per school (partial unique index). |
| `terms` | Term 1/2/3 per school; optional `academic_year_id`. |
| `classes` | Form 5A … per school, with capacity + status. |
| `subjects` | Xisaab, Sayniska … unique per school. |
| `class_subjects` | Which subjects a class takes (join table). |

## People in a school

| Table | Purpose |
|-------|---------|
| `students` | Core student record. `student_id` is the public display ID (`HID-001`) generated per school by the `next_student_id()` function + trigger — no duplicates possible (unique `(school_id, student_id)` and a row-locked counter). |
| `parents` | Parent directory per school; `profile_id` links to a login once the parent has one. |
| `student_parents` | Parent ↔ child links (by parent login and/or directory row). Drives everything a parent may see. |
| `teachers` | Teacher directory; `teacher_classes` / `teacher_subjects` record assignments — the basis for Phase 3 “teachers only touch their own classes/subjects” rules. |
| `staff` | Non-teaching staff (school admins, accountants). |

## Module tables (ready for Phase 3 features)

`exam_windows` (admin opens marking window for a teacher/subject/term),
`exams`, `results` (score, computed percentage, publish flag), `attendance`,
`payments`, `billing_records`, `incidents`, `messages`, `notices`,
`grading_rules`. All carry `school_id` and already have RLS, so attendance,
finance, exams/results, messaging and notifications modules can be built on
them without schema rework. Files/photos live in the two storage buckets.

## Roles

| DB value (`user_role` enum) | App key (`mobile/src/data/roles.js`) | App label | Scope |
|---|---|---|---|
| `super_admin` | `superadmin` | Super Admin | Platform owner — manages all schools |
| `school_admin` | `schooladmin` | Maamulaha Dugsiga | Everything inside their school |
| `teacher` | `teacher` | Macalin | School data; writes attendance/exams/results/incidents |
| `accountant` | `accountant` | Xisaabiye | Finance inside the school |
| `parent` | `parent` | Waalid | Only rows about their linked children |
| `student` | `student` | Arday | Only rows about themselves |
| `pending` | *(none yet)* | — | No school, no access — the only role a public signup can ever receive |

The DB enum uses `super_admin`/`school_admin` (snake_case, matching the
spec); the frontend's preview-only role keys are `superadmin`/`schooladmin`
(no underscore, unchanged from Phase 1 to avoid touching the UI). Phase 3's
auth wiring is where these two get mapped — do it in one place (e.g. a
`DB_ROLE_TO_APP_ROLE` table next to `dataProvider.js`), not scattered across
screens.

Role data lives in the database (`profiles.role`, `school_members.role`) and
is enforced by RLS — the mobile app's role state is presentation only and is
never trusted by the backend. **A role can only ever change through
`provision_school()` or `assign_role()`** (see "Privilege escalation
defenses" below) — nothing else, including the user themself, may write
`profiles.role` or `profiles.school_id`.

## Privilege escalation defenses (Phase 2 security hardening — 3 rounds)

1. **`handle_new_user()`** (signup trigger) never reads `role` or
   `school_id` from `raw_user_meta_data` — that field is client-supplied and
   trivially forgeable (`{"role":"super_admin"}`). Every signup becomes
   `role = 'pending'`, `school_id = null`, full stop.
2. **`guard_profile_privileged_fields()`** (`BEFORE INSERT OR UPDATE` on
   `profiles`) — RLS's `"update own profile"`/`"admins manage school
   profiles"` policies scope *rows*, not *columns*; without this trigger a
   user could write any column directly. **As of migration `0008` this is
   an allow-list, not a deny-list**: only `full_name`, `phone`, `avatar_url`
   may differ between the old and new row on a direct client `UPDATE` —
   `id`, `role`, `school_id`, `created_at`, `updated_at`, and any column a
   future migration adds are all rejected by default, without this trigger
   needing to be touched again. (Round 1 enumerated `role`/`school_id`
   specifically and missed `created_at`/`updated_at`; a later review caught
   that a client could still run `update profiles set created_at =
   '2000-01-01' where id = auth.uid()` — the allow-list closes that and
   every similar gap at once.) The only way through is a transaction-local
   flag (`kobciye.bypass_profile_guard`) set exclusively inside
   `assign_role()`/`create_school_as_super_admin()` around their own
   `UPDATE`, or a session with no JWT at all (SQL Editor / service role,
   trusted for bootstrapping the first `super_admin`). There is **no**
   `is_admin_of()` exception — round 1 had one, an independent review
   flagged that a `school_admin` could use it to set a colleague's role
   directly, and it was removed in round 2.
   `updated_at` is deliberately *included* in the diff, not excluded: the
   guard trigger (`profiles_guard_privileged`) sorts alphabetically before
   the automatic-timestamp trigger (`profiles_updated_at`), so it inspects
   the client's submitted value first — a manual `updated_at` is caught
   here, and the legitimate automatic bump happens afterward, in a separate
   trigger, on a statement that already passed this check.
3. **`create_school_as_super_admin()`** / **`assign_role()`** — the only
   two RPCs allowed to move a profile out of `pending`, both audited to
   `audit_logs`. **School creation is `super_admin`-only, not
   self-service**: as of migration `0008`, `provision_school()` (the
   original self-service "sign up and become admin of your own school"
   path) has `EXECUTE` revoked from every client role and is permanently
   disabled — kept defined only for history. `create_school_as_super_admin
   (name, slug, location, initial_admin_profile_id)` checks the caller's
   `profiles.role` is exactly `super_admin` (from the database, never
   client input) and that the target profile is `pending` with no school,
   then creates the school, its trial subscription, assigns the target as
   `school_admin`, and writes the audit entry — matching the product rule
   that only a verified super_admin provisions schools.
4. **`school_members` has no write policy at all** (migration `0007`
   dropped `"admins manage memberships"`) — it is 100% system-managed,
   kept in sync by `sync_primary_membership()` (fires off
   `profiles.role`/`school_id`, which itself only changes per #2 above). No
   client, `school_admin` included, can INSERT/UPDATE/DELETE it through the
   table API. `subscriptions` and other privileged tables were already
   default-deny for normal users (no self-service write policy) — checked,
   unchanged.
5. **Function-level lockdown (migration `0007`)** — every `SECURITY
   DEFINER` function was individually reviewed:
   - `next_student_id(uuid)` mutates `schools` and is `SECURITY DEFINER` —
     `EXECUTE` is revoked from `public`, `anon`, `authenticated`. It is
     reachable **only** through the students-insert trigger
     (`students_fill_student_id()`, itself made `SECURITY DEFINER` so its
     internal call runs as the function owner, not the original caller —
     otherwise revoking `EXECUTE` would also break normal student
     creation).
   - All other trigger functions (`handle_new_user`, the guard triggers,
     `sync_primary_membership`, the 9 cross-school guards) have `EXECUTE`
     revoked too, as defense-in-depth/hygiene — Postgres already refuses to
     invoke a `RETURNS TRIGGER` function via a direct call, and firing a
     trigger never requires the DML-issuing role to hold `EXECUTE` on it.
   - The 6 read-only RLS helpers (`my_role`, `my_school`, `is_staff_of`,
     `is_admin_of`, `is_parent_of`, `is_self_student`) keep `EXECUTE` for
     `anon`/`authenticated` — they run *inside* every RLS policy
     expression, evaluated as the querying client's role, so revoking this
     would break RLS entirely, not make it safer.
   - `create_school_as_super_admin`/`assign_role` are granted to
     `authenticated` only (not `anon`, which could never pass their own
     `auth.uid() is null` check anyway — the grant matches that reality).

**Why Supabase specifically needs the explicit `anon`/`authenticated`
revokes, not just `PUBLIC`:** a fresh Supabase project runs `ALTER DEFAULT
PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated,
service_role` at bootstrap, so every new function in the `public` schema
gets `EXECUTE` for those roles **in addition to** the ordinary `PUBLIC`
grant. Revoking from `PUBLIC` alone leaves `anon`/`authenticated` able to
call it. Migrations `0007`/`0008`'s revokes name all three explicitly for
this reason, and `supabase/tests/security.test.js` reproduces that same
default privilege so the revokes are tested against a realistic starting
point, not a clean slate that would pass trivially.

## Cross-school data integrity

Every relationship/join table has a `BEFORE INSERT OR UPDATE` guard trigger
that re-checks the `school_id` of both sides and rejects the write if they
differ — independent of RLS, so it holds even for a school admin acting on
their own school's data or a bug in a future admin screen:
`class_subjects`, `teacher_classes`, `teacher_subjects`, `students.class_id`,
`exam_windows`, `exams`, `results`, `attendance`, `student_parents`.

## Row Level Security (how it works)

RLS is enabled on **every** table; there are no allow-all policies. Policies
are built from four `security definer` helper functions:

- `my_role()` / `my_school()` — the caller's role and school from `profiles`
- `is_staff_of(school)` — admins/teachers/accountants of that school (staff
  enter together through the school section, mirroring the login)
- `is_admin_of(school)` — school admin of that school, or super_admin
- `is_parent_of(student)` / `is_self_student(student)` — parent-link / self checks

Pattern per table: school members **read** school-scoped rows; the owning
role **writes** (admins manage, teachers write attendance/exams/results,
accountants write finance); parents/students get narrow SELECTs tied to
their links. Superadmin passes every check. Each policy carries a SQL
comment in the migration files explaining its intent.

Storage follows the same model: object paths start with the school UUID and
policies parse it (`storage_school(name)`) to apply the same school/role
checks to files.

## ID generation

`students.student_id` display IDs (e.g. `HID-001`) are produced by
`next_student_id(school_id)`: it locks the school row, increments
`next_student_sequence`, and formats `prefix || '-' || lpad(seq, 3, '0')`.
Per-school, gap-free enough, duplicate-proof under concurrency, and the
prefix is configurable per school (`HID`, `NUR`, …) to match the app's
Settings screen.

## Entity relationships (core)

```
schools ─┬─ profiles ─── school_members
         ├─ academic_years ─── terms
         ├─ classes ─┬─ class_subjects ─── subjects
         │           └─ students ─┬─ student_parents ─── parents / profiles(parent)
         │                        ├─ results / attendance / payments / incidents
         │                        └─ profiles(student login)
         ├─ teachers ─┬─ teacher_classes / teacher_subjects
         │            └─ exam_windows ─── exams ─── results
         ├─ subscriptions / audit_logs / staff
         └─ messages / notices / grading_rules / billing_records
```
