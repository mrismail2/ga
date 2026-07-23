# Phase 2 Completion Report — Supabase Foundation

**Status: Complete** (foundation only, by design — no UI redesign, no fake
auth, all demo flows preserved, no feature modules migrated).

> **Revision history:**
> - *Rev 1* declared complete before a review caught signup trusting
>   client-supplied `role`/`school_id`.
> - *Rev 2* fixed that plus a self-service `profiles` UPDATE hole and added
>   cross-school triggers — an independent second review found the profile
>   guard still let a `school_admin` bypass `assign_role()` directly, and
>   `SECURITY DEFINER` functions (`next_student_id()`) still had their
>   default `EXECUTE` grant.
> - *Rev 3* fixed both of those (migration `0007`) and committed an
>   executable test suite — a **third**, independent verification then
>   found two more gaps: the profile guard used a deny-list that missed
>   `created_at`/`updated_at`, and `provision_school()` let *any* pending
>   account create its own school, when the actual product rule is that
>   only a verified `super_admin` may create a school and assign its first
>   `school_admin`.
> - *Rev 4* fixed both (migration `0008`) and extended the test suite to 46
>   assertions.
> - **This revision (Rev 5)** made no security/schema/UI changes — the
>   task was to verify the Expo production web export still works after
>   all the backend hardening, and to produce a read-only dependency
>   audit. See "Production export verification" and `DEPENDENCY_AUDIT.md`.
>   The export already passed on the first run; nothing needed fixing.

## Rev 5: production export verification (no code changes)

**Commands run, in order, exactly as specified:**
```bash
cd mobile
npm install
npm run audit:foundation
npx expo export --platform web
```

**Result: PASS.** The command completed with exit code `0`, printed
`Exported: dist`, and did not hang — the terminal returned control
normally (no lingering process to investigate). `dist/index.html` exists,
along with the bundled JS and every asset:

```
dist/index.html
dist/favicon.ico
dist/metadata.json
dist/_expo/static/js/web/AppEntry-f87771a589149004c0063c78f6eb3122.js  (1.35 MB)
dist/assets/assets/kobciye-logo.6d0ee21c40bfad4589e52800b5c3a4c4.png
dist/assets/assets/kobciye-logo-white.ed3b26ed3f99da66d56c71aaeb272090.png
dist/assets/node_modules/@react-navigation/elements/lib/module/assets/... (7 icon files)
```

No bundling error, no missing-module error, no environment-variable error,
no syntax/import/route/Metro error appeared. Nothing was changed to make
this pass — the export was already working; this revision only verified
it and recorded the evidence.

## Rev 5: dependency audit (read-only — see `DEPENDENCY_AUDIT.md`)

`npm audit` (no `--force`, no upgrades applied) found **18 vulnerabilities
(12 high, 6 moderate, 0 critical)**, all tracing to 6 root advisories:
`@xmldom/xmldom`, `tar`, `postcss`, `uuid` (all high/moderate, transitive,
pulled in by the Expo CLI/build tooling — not the shipped app bundle),
`js-yaml` (moderate, transitive, dev-tooling only — the **one** advisory
with a safe non-breaking fix via plain `npm audit fix`), and `expo`/
`expo-asset` (the 2 direct dependencies flagged only because they depend
on the above). Every other proposed fix is `expo@57.0.1` — a 5-major
jump from the pinned `expo: ~52.0.0` — which was **not** applied, per the
task's explicit instruction not to upgrade Expo/major packages
automatically. Full breakdown, per-package severity/direct-vs-transitive
table, and the Phase 8 recommendation are in `DEPENDENCY_AUDIT.md`.

## What changed in Rev 4

### New migration: `20260702000008_security_hardening_3.sql`

**1. Profile guard is now an allow-list, not a deny-list.**
`guard_profile_privileged_fields()` previously enumerated `role`/`school_id`
as the only blocked columns — which meant
`update profiles set created_at = '2000-01-01' where id = auth.uid()`
was never checked and would have succeeded. Rewritten to diff the entire
row (`to_jsonb(old) - safe_columns` vs `to_jsonb(new) - safe_columns`) and
reject *any* difference outside `full_name`/`phone`/`avatar_url` — so `id`,
`role`, `school_id`, `created_at`, `updated_at`, and any column a future
migration adds are all blocked by default, with nothing to remember to add
to a list later.

`updated_at` needed care: the guard trigger fires *before* the existing
automatic-timestamp trigger (`profiles_guard_privileged` sorts before
`profiles_updated_at` alphabetically, and Postgres fires same-timing
triggers in name order), so it sees the client's submitted value, not yet
`now()`. A manual `updated_at` in the client's UPDATE is caught and
rejected; a normal update that doesn't touch it passes, and the *separate*,
untouched `profiles_updated_at` trigger still bumps it automatically
afterward. Verified both directions in the test suite.

**2. School creation is now `super_admin`-only.**
`provision_school()` — the Rev-3 self-service "sign up and become admin of
your own new school" function — did not match the actual requirement
("only a verified `super_admin` may create a school and securely assign
its first `school_admin`"). Fixed by:
- Revoking `EXECUTE` on `provision_school()` from `public`/`anon`/
  `authenticated` — it is now unreachable through PostgREST for any client
  role. The function definition is kept (not dropped) for history/rollback
  safety, with a comment explaining it's disabled.
- Adding `create_school_as_super_admin(p_name, p_slug, p_location,
  p_initial_admin_profile_id)`: checks the caller's `profiles.role` is
  exactly `super_admin` (read from the database, never trusted from client
  input), checks the target profile is `pending` with no existing school,
  then (1) creates the school, (2) creates its trial subscription, (3)
  assigns the target as `school_admin` (bypassing the column guard via the
  same transaction-local flag `assign_role()` uses — the only other
  sanctioned caller of that flag), (4) `school_members` syncs automatically
  off that profile UPDATE (no direct write needed), (5) writes an
  `audit_logs` entry. Granted to `authenticated` only.

### Mobile app

`mobile/src/services/supabase.js`: added `createSchoolAsSuperAdmin()`
wrapper; `provisionSchool()` kept (so nothing throws a `ReferenceError` if
still imported) with its doc comment updated to say it's disabled
server-side. No UI changed — nothing in the app calls either function yet
(Phase 3 work).

## Security tests (extended: 36 → 46 assertions)

```bash
cd supabase/tests
npm install
npm test
```

New assertions added this revision, matching the review's required list
exactly:

| Required test | Assertion(s) |
|---|---|
| normal user cannot update `created_at` | `self UPDATE created_at blocked` |
| normal user cannot manually update `updated_at` | `self UPDATE updated_at (manual) blocked` + the positive control (`updated_at still auto-bumps...`) |
| pending user cannot call the old self-service provisioning path | `pending user cannot call the old self-service provision_school()...` |
| `school_admin` cannot create a school | `school_admin cannot create a school` |
| only `super_admin` can create a school | `pending user cannot call create_school_as_super_admin()` + the positive path succeeding |
| `super_admin` can securely assign a pending user as first `school_admin` | `super_admin can securely assign a pending user as the first school_admin` |
| the new provisioning action is audited | `school creation by super_admin is audited` |
| all existing checks still pass | full run below, 46/46 |

**Actual output of the last run (this revision):**

```
applied 20260702000001_initial_schema.sql
applied 20260702000002_rls_policies.sql
applied 20260702000003_storage.sql
applied 20260702000004_seed.sql
applied 20260702000005_saas_foundation.sql
applied 20260702000006_security_hardening.sql
applied 20260702000007_security_hardening_2.sql
applied 20260702000008_security_hardening_3.sql

PASS signup metadata role=super_admin ignored -> pending, no school
PASS signup metadata full_name still copied (harmless field)
PASS signup metadata role=school_admin ignored -> pending
PASS self UPDATE role=super_admin blocked
PASS self UPDATE school_id blocked
PASS self UPDATE created_at blocked
PASS self UPDATE updated_at (manual) blocked
PASS self UPDATE id blocked
PASS self UPDATE of full_name/phone still allowed
PASS updated_at still auto-bumps on a legitimate update (via the separate trigger)
PASS pending user cannot call the old self-service provision_school() (EXECUTE revoked)
PASS pending user cannot call create_school_as_super_admin()
PASS super_admin can securely assign a pending user as the first school_admin
PASS create_school_as_super_admin creates a trial subscription
PASS school creation by super_admin is audited
PASS school_members synced automatically for the new school_admin
PASS school_admin cannot create a school
PASS create_school_as_super_admin refuses a non-pending target
PASS school_admin can assign_role within their own school
PASS assign_role is audited
PASS a teacher cannot call assign_role on themself
PASS school_admin cannot grant super_admin via assign_role
PASS school_admin cannot change ANOTHER profile.role via direct UPDATE (must use assign_role)
PASS school_admin cannot change ANOTHER profile.school_id via direct UPDATE
PASS school_admin cannot INSERT school_members directly
PASS school_admin cannot UPDATE school_members directly
PASS school_admin cannot DELETE school_members directly
PASS school_members was still correctly synced by the system trigger (role=teacher)
PASS School B provisioned the same super_admin-verified way
PASS school_admin of A cannot UPDATE school B's row
PASS school_admin of A cannot assign_role into school B
PASS school_admin of A cannot INSERT a class into school B (RLS)
PASS anon role cannot call next_student_id() directly (EXECUTE revoked)
PASS authenticated role cannot call next_student_id() directly (EXECUTE revoked)
PASS next_student_id still works internally via the insert trigger (HID-### format)
PASS RLS helper functions (my_role/my_school/is_admin_of) remain callable by authenticated
PASS class_subjects rejects a cross-school pair
PASS class_subjects allows a same-school pair (positive control)
PASS teacher_classes rejects a cross-school pair
PASS a student cannot be assigned a class from another school
PASS results rejects an exam from another school
PASS attendance rejects a class from another school
PASS student_parents rejects a parent from another school
PASS all 27 protected tables exist
PASS RLS is enabled on every one of them
PASS user_role enum is the standardized set

All assertion(s) passed.
```

**46/46 assertions pass.**

## Verification performed (Rev 4)

| Check | Command | Result |
|-------|---------|--------|
| Security test suite | `cd supabase/tests && npm install && npm test` | ✅ **46/46 pass** (output above) |
| Project audit script | `cd mobile && npm run audit:foundation` | ✅ PASSED — `70 active files scanned — no forbidden tokens`; `11 classes... 112 students... 5 results + 9 exams — all references valid` |
| Production web build | `cd mobile && npx expo export --platform web` | ✅ Exported — `_expo/static/js/web/AppEntry-f87771a589149004c0063c78f6eb3122.js (1.35 MB)`, `index.html`, `favicon.ico` |
| Lint / typecheck / unit tests | — | Not configured in this project (no such npm scripts exist) |

## Verification performed (Rev 5 — exact output, all 4 required commands)

**`cd supabase/tests && npm test`**
```
applied 20260702000001_initial_schema.sql
applied 20260702000002_rls_policies.sql
applied 20260702000003_storage.sql
applied 20260702000004_seed.sql
applied 20260702000005_saas_foundation.sql
applied 20260702000006_security_hardening.sql
applied 20260702000007_security_hardening_2.sql
applied 20260702000008_security_hardening_3.sql

[... 46 lines, one per assertion, all "PASS" ...]

All assertion(s) passed.
```
Result: **46/46 PASS.**

**`cd mobile && npm run audit:foundation`**
```
[A] Static scan — active layer must be free of legacy relationship usage
  ✓ 70 active files scanned — no forbidden tokens

[B] Structural validation — canonical seed integrity
  ✓ 11 classes — globally-unique class_id, all have school_id
  ✓ 112 students — identity fields present, no dup student_id/school, valid class refs
  ✓ 5 results + 9 exams — all references valid

audit:foundation PASSED — canonical foundation is clean ✓
```
Result: **PASSED.**

**`cd mobile && npx expo export --platform web`**
```
Starting Metro Bundler
Web Bundled 389ms node_modules/expo/AppEntry.js (503 modules)

› Assets (13):
assets/kobciye-logo-white.ed3b26ed3f99da66d56c71aaeb272090.png (12 kB)
assets/kobciye-logo.6d0ee21c40bfad4589e52800b5c3a4c4.png (29 kB)
node_modules/@react-navigation/elements/lib/module/assets/... (6 more)

› web bundles (1):
_expo/static/js/web/AppEntry-f87771a589149004c0063c78f6eb3122.js (1.35 MB)

› Files (3):
favicon.ico (14.5 kB)
index.html (1.23 kB)
metadata.json (49 B)

Exported: dist
```
Result: **PASS** — exit code `0`, `dist/index.html` confirmed on disk (see
"Rev 5: production export verification" above for the full file listing).
Process exited normally; nothing stayed open.

**`cd mobile && npm audit`**
```
18 vulnerabilities (6 moderate, 12 high)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```
Result: **18 findings (0 critical, 12 high, 6 moderate), all documented in
`DEPENDENCY_AUDIT.md`.** No fix applied — see that file for the
per-package breakdown and the Phase 8 recommendation.

## What was built (cumulative, all 5 revisions)

### Backend (`supabase/`)

| File | Contents |
|------|----------|
| `migrations/20260702000001_initial_schema.sql` | 22 core tables, 9 enums (incl. `pending`), `HID-###` student-ID generator, signup trigger |
| `migrations/20260702000002_rls_policies.sql` | RLS on every table; role helper functions; per-role policies |
| `migrations/20260702000003_storage.sql` | `school-logos` / `student-photos` buckets + policies |
| `migrations/20260702000004_seed.sql` | Two demo schools, subjects, terms, grading rules |
| `migrations/20260702000005_saas_foundation.sql` | `academic_years`, `school_members`, `subscriptions`, `audit_logs`, `parents`, `staff` + RLS |
| `migrations/20260702000006_security_hardening.sql` | Round 1: signup can't self-grant a role; `provision_school()`/`assign_role()`; cross-school guards |
| `migrations/20260702000007_security_hardening_2.sql` | Round 2: no `school_admin` bypass on the profile guard; `school_members` write policy dropped; `SECURITY DEFINER` `EXECUTE` lockdown |
| `migrations/20260702000008_security_hardening_3.sql` | **New.** Round 3: allow-list profile guard (blocks `created_at`/`updated_at` too); `create_school_as_super_admin()` replaces self-service provisioning |
| `tests/security.test.js`, `tests/package.json` | 46-assertion executable security test suite |
| `config.toml`, `README.md` | CLI config + quick-start (Somali) |

### Root-level (`DEPENDENCY_AUDIT.md` — new, Rev 5)

Read-only `npm audit` report for `mobile/`: 18 vulnerabilities (0
critical, 12 high, 6 moderate), all traced to 6 root advisories, all but
one (`js-yaml`) fixable only via a major Expo SDK upgrade (52→57) — none
applied. Recommends deferring to Phase 8. See that file for the full
per-package table.

**27 tables**, all `school_id`-scoped where school-owned, UUID PKs,
timestamps, FKs, unique rules, indexes.

## Manual actions required (Supabase dashboard)

Unchanged in kind from the previous revision — see `SUPABASE_SETUP.md` §3a
(run the tests yourself), §3b (bootstrapping the first `super_admin`,
now via `create_school_as_super_admin()` for subsequent schools), and §6
(full checklist, now including migration `0008`).

## Left for Phase 3 (intentionally)

1. Real sign-in/sign-up wired to the landing login. The onboarding flow for
   *new* schools now needs a `super_admin` in the loop (e.g. an approval
   step) rather than being fully self-service — a product/UX decision for
   Phase 3, not built here per "keep the preview UI unchanged."
2. Module-by-module data migration through `dataProvider.js`.
3. Teacher narrowing to assigned classes/subjects in RLS write policies.
4. Photo/logo upload through the storage buckets.
5. Push notifications, file attachments, reports.
6. DB↔app role-key mapping layer (see `SUPABASE_SCHEMA.md` → Roles).
