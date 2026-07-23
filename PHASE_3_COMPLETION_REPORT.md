# Kobciye — Phase 3 Completion Report

## 0i. Universal loading indicator (eleventh pass — mobile app UI only, no logic/security change)

**Request:** replace the app's scattered native `ActivityIndicator` spinners
with one consistent, branded loading animation — a three-dot bounce, used
for every busy button and every full-screen loading wait — with a blue
background instead of the orange used in the reference design shown.

**New component (`src/components/LoadingDots.js`):**
- `LoadingDots` — an inline three-dot bounce animation (`Animated.loop` per
  dot, staggered start so the dots bounce in a wave). Takes `color`, `size`,
  `gap`, `style` props so it drops into a button (small, white) or a full
  page (larger, brand blue) alike.
- `LoadingOverlay` — a full-screen wrapper using the app's brand blue
  (`c.blue`) as the background with large white `LoadingDots`, for the
  moments a screen is still opening/restoring (e.g. Supabase session
  restore on launch).

**Applied everywhere a spinner previously appeared** (every file that had
`ActivityIndicator`, replaced 1:1, no other behavior touched):
- `App.js` — the "still restoring session" full-screen wait now renders
  `LoadingOverlay` instead of a plain gray-background spinner.
- `src/screens/auth/LoginScreen.js`, `ForgotPasswordScreen.js`,
  `SetPasswordScreen.js`, `src/screens/SchoolOnboardingScreen.js` — every
  submit-button busy state now shows small white `LoadingDots` instead of
  `ActivityIndicator`.
- `SchoolOnboardingScreen.js` — the schools/invites list-loading spinner and
  the per-row "resend invite" busy spinner also converted.
- `src/components/StudentPhotoSection.js` — the photo-upload busy overlay
  converted.

No screen's layout, copy, routing, or business logic changed — this is a
pure visual/animation swap. The `Ma xaqiijin karo hadda` / invite-state
screen (card, icon circle, tone coloring) from the previous pass was
reviewed against the reference "Invalid Invitation" screenshot and already
matches that clean centered-card aesthetic; no further change was needed
there.

**Verification:**
- Full existing suite re-run after the swap — all 6 suites, every assertion,
  still pass unchanged (`test:onboarding`, `test:auth-routing`,
  `test:auth-race`, `test:institution-mode`, `test:university-registration`,
  `test:invite-callback`) — this was a pure UI swap, so no test assertions
  needed updating.
- `expo export --platform web` builds cleanly with the new component.
- Visually verified via a temporary, fully-reverted `App.js` bypass +
  Playwright screenshot: the full-screen blue `LoadingOverlay` and the small
  in-button white dots both render and animate correctly (confirmed
  `git status`/`git diff` empty after reverting the bypass).

## 0h. Invite-callback hardening: token_hash support + honest error classification (tenth pass — mobile app only)

**Bug:** after opening a genuinely valid invite email, School Admins reached
`SetPasswordScreen` but immediately saw "Casuumaad aan sax ahayn / Link-gan ma
shaqaynayo" (invalid link) instead of the password form — even for a
brand-new, unused invite.

**Root cause:** `parseAuthUrl()` (`src/utils/deepLink.js`) recognized hash
access-tokens and PKCE `?code=` callbacks, but never Supabase's **third**
callback style: `?token_hash=...&type=invite`, which some email-template
configurations use directly (`{{ .TokenHash }}`) instead of routing through
Supabase's own hosted `/verify` redirect — often the only option for a
native app's custom URL scheme (`kobciye://…`), since that hosted redirect
can only target an `https://` site. A `token_hash` link fell through to
`{ kind: 'none' }`, which `handleAuthCallback`'s exchange logic didn't
recognize either, throwing `"missing setup token"` — caught by a catch block
that mapped **every** failure, indiscriminately, to `flowError = 'invalid'`.
A second, independent bug compounded this: even once token_hash is
supported, a genuinely unrelated hiccup (a network blip during the exchange,
or a transient profile-load failure *after* the session was already
successfully established, proving the link itself was valid) would still be
shown as the same harsh, dead-end "invalid link" message.

**Fix (`src/utils/deepLink.js`, `src/services/supabase.js`,
`src/context/AuthContext.js`, `src/screens/auth/SetPasswordScreen.js`):**
- `parseAuthUrl` now returns `{ kind: 'token_hash', tokenHash, type }` for a
  `token_hash` param; `isPasswordSetupUrl` recognizes it.
- `services/supabase.js` gains `verifyTokenHash(tokenHash, type)`, calling
  Supabase's own `auth.verifyOtp({ token_hash, type })` — the correct,
  secure method for this flow.
- `AuthContext.js`'s `handleAuthCallback` gains a third exchange branch
  (`parsed.kind === 'token_hash'`) alongside the existing PKCE/hash-token
  ones, and now tracks *which stage* is being attempted (`stage` variable —
  `callback_pkce_exchange_failed` / `callback_hash_session_failed` /
  `callback_token_hash_verify_failed` / `callback_profile_load_failed` /
  `callback_missing_token`) so a failure can be classified correctly:
  - A profile-load failure — reached only *after* the exchange/verification
    already succeeded — is unconditionally `'temporary'`, never `'invalid'`,
    regardless of what the underlying error looks like: the successful
    exchange already proves the link itself was genuinely good.
  - Any other failure goes through a new `classifyCallbackError(e)`: checks
    `isAuthRetryableFetchError(e)` (a real network/temporary condition) →
    `'temporary'`; checks the error's structured `.code` against
    `@supabase/auth-js`'s documented expiry/reuse codes (`otp_expired`,
    `flow_state_expired`, `flow_state_not_found`, `bad_code_verifier`,
    `invite_not_found`, `session_expired`) or a message-text fallback →
    `'expired'`; otherwise `'invalid'` (a genuinely malformed/unrecognized
    callback — the one case that should show it).
  - `scrubUrl()` moved from immediately-on-claim to only after the
    exchange/verification attempt has actually completed (success *or*
    failure) — a mid-attempt refresh no longer loses the callback data for
    nothing, though nothing sensitive was ever logged or rendered either way.
- `SetPasswordScreen.js` gained a `temporary` state (`STATE_COPY.temporary`,
  "Ma xaqiijin karo hadda... Fadlan isku day mar kale, ama hubi
  internet-kaaga.") alongside the existing `expired`/`invalid`/etc. states —
  no structural change needed, since `flowError` already drove `state`
  generically.
- `setNewPassword` (`AuthContext.js`) now distinguishes a password-update
  failure from an accept-school-invite failure that happens *after* the
  password was already saved — the latter throws with `err.passwordSaved =
  true`, and `SetPasswordScreen.submit()` shows a specific message ("Furaha
  waa la kaydiyay, balse ku biirista dugsiga ayaa fashilantay...") instead of
  a generic one, and never suggests making a new account. A recognized
  accept-invite code (expired/cancelled/already_accepted/email_mismatch/
  not_found/already_member) still shows its existing specific full-screen
  state, unchanged.
- Safe diagnostics only: `logCallbackDiag(category)` logs a fixed category
  name + a random per-attempt reference id (`cb-xxxxxxxx`) — never the raw
  error, message, token, code, email, or password. No remote log sink exists
  in this client-only app; this is for local devtools/RN-debugger visibility
  only, matched against the fixed category list above.
- The pre-existing password-reset race-condition fix (`setupInProgressRef`,
  synchronous `flow`/`status` claim before any await) is untouched — a
  signed-in Super Admin opening a reset link still always sees
  `SetPasswordScreen`, never a dashboard.

**No Edge Function changed for this fix** — `accept-school-invite` already
returned the correct specific codes/statuses; the bug was entirely
client-side (URL parsing + error classification).

**New test:** `mobile/scripts/invite-callback-hardening.test.js`
(`npm run test:invite-callback`) — bundles the real `AuthContext.js` (same
technique as `password-reset-race.test.js`) and drives `handleAuthCallback`
through hash-token, PKCE-code, and token_hash invite/recovery callbacks,
proving each reaches `flow='set_password'`, `flowError=null`,
`status='signed_in'` (never the invalid screen); an expired/reused
token_hash yields `flowError='expired'`; a simulated `AuthRetryableFetchError`
during a PKCE exchange yields `'temporary'`, never `'invalid'`; a
profile-load failure *after* a successful exchange also yields `'temporary'`;
a truly bare revisit with no code/token/hash at all correctly yields
`'invalid'`; and a recovery callback never calls `acceptSchoolInvite`.
**Verified to have real teeth**: temporarily removed `token_hash` parsing
from `deepLink.js` and confirmed the token_hash scenario correctly failed
(reproducing the exact original bug), then restored the fix and reconfirmed
all 15 assertions pass.

**Existing test updated (mechanical only):**
`password-reset-routing.test.js`'s regex for "`setNewPassword` only calls
`acceptSchoolInvite` when `accept=true`" was loosened to tolerate the new
`try { await acceptSchoolInvite(...) }` wrapper — the invariant it checks is
unchanged and still holds.

## 0g. University registration Edge Function failure — root cause + hardening (ninth pass)

**Bug:** creating a University sent the correct request, but the Super Admin
UI showed only the generic "Failed to send a request to the Edge Function."

**Root cause — confirmed and reproduced locally, not a real network/CORS
issue:** `invokeFunction()` (`mobile/src/services/supabase.js`)
unconditionally awaited `error.context.json()` on *any* `functions.invoke()`
failure. That only works when `error.context` is a real `Response`
(`FunctionsHttpError`/`FunctionsRelayError`). For `FunctionsFetchError` — the
request never reached the server at all (offline, DNS failure, CORS,
timeout) — `context` is the raw fetch **exception**, which has no `.json()`
method, so the call threw, was silently swallowed by the surrounding
try/catch, and fell back to the SDK's own generic message. Reproduced this
exactly in isolation: `new FunctionsFetchError(new TypeError('Failed to
fetch')).context.json` is `undefined`. This bug affects **any** Edge
Function network-level failure, not something specific to University — the
generic message is what anyone would see the moment a request didn't
reach the server for any reason.

**Fix (`mobile/src/services/supabase.js`, `supabase/functions/_shared/cors.ts`,
`supabase/functions/create-school-and-invite-admin/index.ts`):**
- `invokeFunction` now classifies via `instanceof` against the SDK's own
  error classes (`FunctionsFetchError`/`FunctionsHttpError`/
  `FunctionsRelayError`, imported unmodified from `@supabase/supabase-js`):
  network failure vs. an aborted request (a new 20s `timeout` option was
  added to the `invoke()` call, distinguished from a plain network failure
  by `error.context.name === 'AbortError'`) vs. relay/service-unavailable vs.
  a structured HTTP response, which is further split into 401
  (`unauthenticated`), 403 (`forbidden`, but still passing through the
  server's own specific code/message when present — e.g.
  `existing_account_requires_manual_resolution`), any other server-provided
  `{code, message}` (passed through as-is — it was already written to be
  safe), or an unparseable non-JSON body (`server_error` fallback). Every
  path returns a safe Somali message; none ever surfaces a raw SDK message,
  token, header, or stack trace.
- `createSchoolAndInvite`'s `school_stage: schoolStage || null` (was `??
  null`, which does not coalesce an empty string) — defense in depth so a
  university call can never send `school_stage: ""` even if some future
  caller passed one by mistake. `SchoolOnboardingScreen.js`'s own ternary
  already guaranteed a literal `null` for University; this was already
  correct end-to-end, now doubly so.
- Edge Function: generates one `correlation_id` (`crypto.randomUUID()`) per
  request (`newCorrelationId()`, added to `_shared/cors.ts`; `fail()` gained
  an optional 5th parameter, backward compatible — every other Edge
  Function's calls are unaffected), included in error responses only. Every
  `console.error`/`console.log` now logs the correlation id + a safe
  category (`slug_taken`/`forbidden`/`invalid_institution_type`/
  `invalid_input`/`unknown_db_error`/`email_delivery_failed`) instead of the
  raw error message — never email/phone/JWT/tokens/secrets. One safe log
  line records `institution_type` and *whether* `school_stage` is present
  (never touches name/email/phone/slug).

**New test:** `mobile/scripts/university-registration-request.test.js`
(`npm run test:university-registration`) — bundles the real
`services/supabase.js` (only `@supabase/supabase-js`'s `createClient` is
mocked; its real `FunctionsFetchError`/`FunctionsHttpError`/
`FunctionsRelayError` classes are used unmodified) and proves: the exact
payload sent for school (`institution_type`/`school_stage` pair) and
University (`institution_type:'university', school_stage:null` — exact
`null`, present key, never `''`/undefined/a stage value); a real
`FunctionsFetchError` classifies as `network_error` with a safe Somali
message (never the SDK's own generic text); an aborted fetch classifies
distinctly as `timeout`; a 401 classifies as `unauthenticated` with a
login-session message; a 400 validation response passes through the
server's own safe code/message unmodified; a relay error and an unparseable
body both get safe fallbacks; and no classified message ever contains
"token", "Bearer"/a JWT prefix, or "service_role"/"secret".

**Full re-verification, both passes (0g + 0h):** Phase 2 SQL (52), Phase 3
SQL (58), `institution_type.test.js` (26), `test:onboarding` (38),
`test:auth-routing` (27), `test:auth-race` (2 scenarios), `test:institution-mode`
(40), the new `test:university-registration` (25 assertions), the new
`test:invite-callback` (15 assertions), `audit:foundation`, and
`npx expo export --platform web --max-workers 2` — **all pass**. No
existing migration, RLS policy, invitation security, password-reset routing
invariant, role/permission check, or school-isolation test was weakened —
only one existing regex (noted above) was loosened to match an
unchanged invariant's new (still-correct) code shape.

**Deployment:** `supabase/functions/create-school-and-invite-admin/index.ts`
and `supabase/functions/_shared/cors.ts` changed — **the Edge Function must
be redeployed** (`supabase functions deploy create-school-and-invite-admin`,
and any other function importing `_shared/cors.ts` picks up the new
`newCorrelationId` export automatically at its next deploy, with zero
behavior change for functions that don't call it). No new migration in this
pass — no `supabase db push` needed. All other changes are mobile-app-only
(no separate deploy step beyond the app's normal build/publish).

## 0f. School Mode vs University Mode — foundation & safe routing (eighth pass)

*Amended in place by a data-integrity hardening follow-up, same development
pass, before this migration ever reached a real Supabase project (see the
"DATA-INTEGRITY HARDENING" subsection below) — this section describes the
final, hardened state, not an intermediate one.*

A new product direction: Kobciye now has two institution types. Primary/Middle
and Secondary schools continue to share ONE School Mode experience (they only
differ by label/terminology); a University is a completely separate mode with
its own navigation and terminology. This pass builds the **foundation and
routing only** — real academic modules (Faculties, Departments, Courses,
Semesters, Transcripts, GPA, admissions, grades, streams, parent portal, …)
are explicitly Phase 4/5/7 work, not built here.

**Database — exactly ONE new migration, no old migration touched:**
`supabase/migrations/20260705000001_institution_type.sql` adds:
- `schools.institution_type` (`school` | `university` | `null` = unclassified)
  and `schools.school_stage` (`primary_middle` | `secondary` | `null`), both
  plain `text` + CHECK constraints (not enums, so a future value can be added
  with a simple constraint change, no `ALTER TYPE` ceremony).
- A pairing CHECK: `school` requires a valid `school_stage`; `university`
  forbids one; `null` institution_type (existing/legacy schools) is left
  alone — nothing is backfilled or guessed.
- A guard trigger (`guard_school_institution_fields`) that blocks **any**
  UPDATE from changing either column once set — for **every** role,
  including super_admin. There is no conversion path yet; that needs its own
  safe, audited data-migration tool (future work), not a bare column flip.
- `sa_create_school_and_invitation()` gains two new trailing parameters
  (`p_institution_type`, `p_school_stage`) — **required, no defaults**,
  validated strictly. A real Postgres subtlety surfaced here: simply
  appending parameters under `CREATE OR REPLACE FUNCTION` does **not**
  extend the existing function the way it does for a same-arg-count change
  (as used in migrations 0006-0008) — Postgres treats a different parameter
  *count* as a genuinely distinct overload, which made the old 7-arg call
  ambiguous against the new signature. Fixed with an explicit
  `drop function if exists sa_create_school_and_invitation(<old 7-arg
  signature>)` before the redefinition — confirmed by first reproducing the
  "is not unique" failure, then verifying it disappears.

### DATA-INTEGRITY HARDENING (same migration, same pass)

An independent review found that a signed-in super_admin could still create
a **new** unclassified school (`institution_type = null`) through three
paths the initial pass didn't fully close: (1) a **direct INSERT** into
`schools` — the pre-existing `"super_admin manages schools"` RLS policy
already permits a super_admin client to bypass both RPCs entirely; (2) the
**old 7-arg** `sa_create_school_and_invitation` call, which the initial pass
deliberately kept working (with defaulted, optional new params) for backward
compatibility; (3) the older, invitation-system-predating
`create_school_as_super_admin()` RPC, which never gained the new columns at
all. All three are now closed, in the same migration file (confirmed not yet
applied to any real Supabase project — see below):

- **New `BEFORE INSERT` trigger** (`guard_new_schools_require_classification`,
  on `schools`): rejects any INSERT with a null/invalid `institution_type` or
  an inconsistent `school_stage` pairing, for **every** insert path —
  RPC-based or a raw direct INSERT — regardless of caller. It intentionally
  fires on INSERT only, never UPDATE, so a legacy pre-migration row that is
  already unclassified is never forced to change (a plain column-level
  `NOT NULL` was considered and rejected for exactly this reason — it would
  have failed the migration itself the instant it ran against a database
  that already has unclassified rows, e.g. the seed/demo schools).
- **`sa_create_school_and_invitation()` tightened further**: the two new
  parameters (and `p_expires_in_days`, which Postgres requires to also lose
  its default once a later parameter must be mandatory) are now **required**
  — omitting them fails outright rather than defaulting to "unclassified."
  Every real caller (the Edge Function) already supplied them, so this is a
  zero-impact tightening in production; `phase3_invitations.test.js`'s ~13
  call sites (which exercise the unrelated invitation lifecycle, not this
  specific field) were mechanically updated to pass `'school','primary_middle'`
  so they keep testing what they always tested.
- **`create_school_as_super_admin()` upgraded, not retired**: it has no
  caller anywhere in the live app (`createSchoolAsSuperAdmin` in
  `services/supabase.js` is itself unused by any screen) but remains
  reachable by any authenticated super_admin client, so it needed the exact
  same treatment rather than being left as a second loophole. Considered
  simply revoking `EXECUTE` (matching `provision_school`'s precedent), but
  `security.test.js` uses this function extensively as a fixture-creation
  helper for later, otherwise-unrelated cross-school RLS isolation tests —
  revoking it outright would have cascaded into breaking a large block of
  valuable, unrelated Phase 2 coverage. Upgrading it (same drop + required
  6-arg signature as the other RPC) preserves every one of those fixtures
  with a 2-argument, mechanical update to its 4 call sites in
  `security.test.js`, while still fully closing the loophole.

**Edge Function** (`supabase/functions/create-school-and-invite-admin`):
requires `institution_type` (`school`|`university`) and validates the
`school_stage` pairing before ever calling the RPC — the same rule enforced
twice (Edge Function + database), matching the existing defense-in-depth
pattern for name/slug/email. No change to the existing invitation/security
behavior (JWT check, super_admin check, existing-account guard, honest email
delivery reporting) — only the new fields were added to the request/response.

**Mobile — central configuration** (`src/config/`): `institutionTypes.js`,
`schoolStages.js`, `navigationByInstitutionType.js` are the single source of
truth for labels, valid values, and nav catalogs — screens read from here
instead of hardcoding strings or scattering `if (institution_type === …)`
checks.

**Super Admin → Register New School** (`SchoolOnboardingScreen.js`): adds a
required **Nooca Hay'adda** (Dugsi/Jaamacad) picker and, only when Dugsi is
selected, a required **Heerka Dugsiga** (Dugsi Hoose/Dhexe vs Dugsi Sare)
picker. The submit button is disabled until both are validly selected
(`canSubmitInstitution`) — the form cannot be submitted half-configured.

**University Mode — genuinely separate UI**
(`src/navigation/UniversityAppShell.js`, new file): its own responsive
shell (sidebar on wide screens, bottom tabs + a "more" list on phones)
driven entirely by `UNIVERSITY_NAV_ITEMS`. Every item — Kulliyadaha,
Departments, Programmes, Academic Years, Semesters, Courses, Lecturers,
Students, Cohorts/Levels, Registration, Results, Transcripts — renders a
safe, honest "not built yet" empty state (never fake data); Settings has a
real working Sign Out. It shares zero code with School Mode's
RootNavigator/DesktopShell — kept as separate files/components specifically
so neither mode's terminology can leak into the other (test-enforced, see
below).

**Safe routing** (`App.js`): once `auth.status === 'signed_in'` and a real
role is known, the (unchanged) profile load already guarantees
`profile.school.institution_type` is available — `getMyProfile()` already
selected `school:schools(*)`, so no extra query was needed. Only
`institutionType === 'university'` renders `UniversityAppShell`; every other
case (`school` + either stage, unclassified/legacy, or super_admin who has
no school at all) renders the existing, unmodified `RootNavigator`. Because
profile load is already awaited before `status` flips to `'signed_in'`
(established by the Phase 3 auth-race fix in 0e), there is no separate
loading gap to add and no possibility of either shell flashing before the
other.

**Permissions:** only `sa_create_school_and_invitation()` and
`create_school_as_super_admin()` (both super_admin-only, re-checked in the
database, both now REQUIRING a valid classification with no default) can set
`institution_type`/`school_stage`, and only at creation — a `BEFORE INSERT`
trigger rejects any other insert path, including a raw direct INSERT, that
tries to leave a new row unclassified. No client code path — school_admin or
otherwise — can write to the `schools` table's `institution_type`/
`school_stage` at all (the app has no school-editing screen, and
`services/supabase.js`'s only `schools` table access is the existing
read-only `listSchools()`); the guard trigger blocks it at the database
level regardless. If a future screen
ever offers to change these fields, `config/institutionTypes.js` exports the
exact safe message to show:
*"Beddelidda nooca hay'adda waxay u baahan tahay hab gaar ah oo xogta si
ammaan ah loogu wareejiyo."*

**Migration-deployment determination:** per the hardening request's own rule
("if not yet applied to the real Supabase project, amend the same migration;
if it has, add a new corrective one"), this was determined to be **not yet
applied anywhere** — it was created earlier in this same development pass,
this branch is unmerged, the repo has no CI/CD auto-deploy step, and every
setup doc describes deployment as a manual `supabase db push` the operator
runs separately. The migration was therefore amended in place rather than
superseded by a second file. If this determination is wrong, say so and a
corrective migration will be added instead — nothing here is destructive to
undo (no real database has run any version of this file yet).

**New/updated tests:**
- `supabase/tests/institution_type.test.js` — applies every migration
  (unmodified) to a disposable Postgres (pglite) and proves: exactly one new
  migration file was added and git shows zero pre-existing migration files
  modified; invalid institution_type/school_stage combinations are rejected;
  valid combinations (school+primary_middle, school+secondary, university)
  are accepted; **all three hardening loopholes fail** — a direct super_admin
  INSERT with `institution_type=null`, the old 7-arg
  `sa_create_school_and_invitation` call, and `create_school_as_super_admin`
  called without a classification (each confirmed to leave zero rows behind)
  — while a direct INSERT or a `create_school_as_super_admin` call **with** a
  valid, complete classification still succeeds; the guard trigger freezes
  both columns after creation for every role including super_admin and the
  school's own school_admin, while leaving unrelated columns freely editable;
  the full invite→accept lifecycle still works end-to-end with
  institution_type set.
- `supabase/tests/security.test.js` and `supabase/tests/phase3_invitations.test.js`
  — mechanically updated call sites only (append the now-required
  institution_type/school_stage arguments); no assertion, fixture, or test
  intent was changed.
- `mobile/scripts/institution-mode.test.js` (`npm run test:institution-mode`)
  — static structural assertions (same convention as
  `onboarding-guards.test.js`): the registration form requires
  institution_type and conditionally requires school_stage and gates its
  submit button; the Edge Function rejects invalid combinations; App.js's
  routing has exactly one condition selecting `UniversityAppShell` and never
  branches on `school_stage` (proving both school stages share one shell);
  `UniversityAppShell.js` contains none of the School Mode-only terms
  (Fasallada, Waalidiinta, Primary/Secondary/Stream, Class Teacher, School
  Report Card, School Homework); `RootNavigator.js`/`DesktopShell.js` contain
  none of the University-only terms (Kulliyadaha, Semester, Transcript,
  Faculty, Programme, Cohort); no client write path to the schools table
  exists.

**Full re-verification, both passes combined:** Phase 2 SQL (52 assertions),
Phase 3 SQL (58 assertions), `institution_type.test.js` (26 assertions,
including the 9 new hardening-specific ones), `test:auth-routing` (27),
`test:auth-race` (2 scenarios), `test:onboarding` (38), `test:institution-mode`
(40 assertions), `audit:foundation`, and
`npx expo export --platform web --max-workers 2` — **all pass**, no
regressions. No existing migration FILE, RLS policy, Auth security,
invitation security, password-reset security, or Super Admin onboarding
behavior was altered — the two existing Phase 2/3 test files only had their
`create_school_as_super_admin`/`sa_create_school_and_invitation` call sites
mechanically extended with the now-required arguments.

**Known limitation, disclosed honestly:** the new Register-New-School picker
UI and `UniversityAppShell` were verified by (a) esbuild bundling cleanly,
(b) a full, successful `expo export --platform web` (Metro resolves and
bundles the entire app graph, these files included), and (c) the structural
test suite above — but NOT by an interactive click-through in a real
browser. Demo/preview mode has no UI entry point anymore (removed in an
earlier hardening pass, by design — invite-only, no demo affordance), and
this environment has no live Supabase credentials to sign in as a real
super_admin. A live click-through (Register New School → pick Dugsi/Jaamacad
→ confirm the stage picker appears/disappears correctly → submit) is
recommended before this ships to production users.

**Phase 4/5/7 (not built here, by design):**
School: student admissions, grades/classes, streams, attendance, exams,
results, parent portal. University: Faculties, Departments, Programmes,
Courses, credit hours, semester registration, transcripts, GPA/CGPA,
lecturer management. A safe, audited institution-type/stage conversion tool
(for a school or university that needs to be reclassified after creation) is
also future work — not offered anywhere in this phase.

## 0e. Password-reset race-condition fix (seventh pass — mobile app only)

**Bug:** pass 0c fixed the routing logic, but left a narrower timing hole.
`AuthContext.handleAuthCallback()` only set `flow = 'set_password'` **after**
`await`-ing `exchangeCodeForSession()` / `setSessionFromTokens()`. If the
device already held a valid persisted session (e.g. an admin who was already
signed in when they opened the reset-email link on the same browser/device),
the ongoing `onAuthStateChange` listener could fire `SIGNED_IN` for that OLD
session **during** that await — and since `flow` hadn't been set yet, the
listener's own signed-in routing would momentarily win, rendering
`RootNavigator`/the dashboard before the exchange resolved and corrected it a
moment later. A user with a fast enough glance (or a slow enough network)
could land on the dashboard first.

**Fix (mobile only, two independent layers — `context/AuthContext.js`):**
1. **Synchronous claim in `handleAuthCallback`.** The instant
   `isPasswordSetupUrl(parsed)` is true — before the URL is scrubbed, before
   any `try`, before the first `await` — the function now sets
   `setupInProgressRef.current = true`, `setFlow('set_password')`, and
   `setStatus('initializing')`. Because this all runs synchronously up to the
   function's first `await`, it is guaranteed (same-commit / declaration-order
   effect execution) to land before the separately-registered
   `onAuthStateChange` listener effect can act on any event tied to this
   render pass.
2. **`setupInProgressRef` guard, defaulting to `true` from mount.** On native,
   the mount effect's own `await Linking.getInitialURL()` is itself a real
   yield point that happens **before** `handleAuthCallback` is even called —
   so layer 1 alone doesn't cover the gap between app-open and URL-known. The
   ref starts `true` for exactly this reason. While it is `true`, the ongoing
   `onAuthStateChange` listener may still update `session` bookkeeping, but
   never calls `setStatus`/routes to a dashboard. The ref is released in a
   `finally` block in `handleAuthCallback` (guard-only for the
   no-callback-URL path, cleared right after the callback check in the mount
   effect), so it's always cleared exactly once, success or failure.
3. `flow` stays `'set_password'` through profile load, invite/recovery
   determination, and any exchange failure (`flowError='invalid'`, status
   drops to `signed_out`, never `signed_in`) — it is only cleared after the
   user actually saves a new password, unchanged from pass 0c.

**New test:** `mobile/scripts/password-reset-race.test.js`
(`npm run test:auth-race`) — a real integration-style test, not a
re-implementation: it bundles the actual `AuthContext.js` via esbuild and
drives the real `AuthProvider` through one mount using a minimal hand-rolled
hook runtime (`useState`/`useRef`/`useEffect`/`useCallback`/`useContext`) that
runs effects in declaration order, matching React's own guarantee. Two
scenarios, because the fix has two layers and each needs its own race to
actually exercise it:
- **`web-pkce-exchange-race`** — an old `super_admin` session's
  `onAuthStateChange('SIGNED_IN', ...)` is scheduled to fire immediately,
  strictly before a deliberately-slowed (30ms) `exchangeCodeForSession()`
  resolves. Exercises layer 1.
- **`native-cold-start-race`** — `Linking.getInitialURL()` takes 25ms (a real
  native bridge call); the old-session event fires at 5ms, **before the URL
  is even known**, let alone parsed or handed to `handleAuthCallback`.
  Exercises layer 2 specifically — layer 1 can't protect a call that hasn't
  happened yet.

Both scenarios assert: the race actually occurred in the intended order (or
the scenario proves nothing), that `status` was **never** observed as
`'signed_in'` while `flow` was anything other than `'set_password'` (the
exact combination that would let `App.js` render the dashboard), and that the
final settled state is `status='signed_in'` + `flow='set_password'`.

**The test was verified to have real teeth**, not just to pass: the
`setupInProgressRef` guard was temporarily removed from the listener and the
suite re-run — `native-cold-start-race` correctly **failed** (`web-pkce-
exchange-race` still passed, confirming it's protected by the other, still-
intact layer). The guard was then restored and the full suite re-confirmed
passing before proceeding.

**Full re-verification, this pass:** Phase 2 SQL (`supabase/tests`, 52
assertions), Phase 3 SQL (`phase3_invitations.test.js`, 58 assertions),
`test:auth-routing` (27 assertions), `test:onboarding` (38 assertions),
`test:auth-race` (new, 2 scenarios / 16 assertions), `audit:foundation`, and
`npx expo export --platform web --max-workers 2` — **all pass**, no
regressions. No migration, RLS policy, Edge Function, invite security, or
Super Admin onboarding logic was touched.

## 0d. Login screen redesign + login-method tabs (sixth pass — UI only, no new backend)

The client asked for the login screen to be visually restyled (two-panel
layout, brand/illustration side + form side, inspired by a shared reference)
and to add a role-based entry point: School/Teacher via Gmail+Password
(already real), Student via Student ID + School ID, Parent via School ID +
child's Student ID.

**Decision point + user's choice.** ID-based sign-in for students/parents is a
real authentication-architecture question, not a styling one — Supabase Auth
has no built-in "ID pair as password" mechanism, and building it securely
needs a new migration + RPC + session-minting path. I asked the client to pick
between (a) building that backend now, (b) UI-only mockup with a visible
"Coming Soon" label and Phase 4 backend, or (c) faking it via synthetic
emails. **The client chose (b): UI/mockup now, real backend in Phase 4.**

**What was built (`screens/auth/LoginScreen.js`, fully rewritten):**
- Responsive two-panel layout: on wide screens (≥900px) a navy brand panel
  (logo, headline, tagline, feature chips) sits beside the form; on phones it
  collapses to a single stacked column — no new dependencies added (no
  gradient library; solid brand-navy background, matching the existing design
  system).
- Three login-method tabs: **Dugsiga** (School/Teacher — the real,
  unchanged Gmail+Password Supabase sign-in), **Arday** (Student — Student ID +
  School ID fields), **Waalid** (Parent — School ID + child's Student ID
  fields).
- The Student/Parent tabs are clearly marked **"Dhawaan (Coming Soon)"** and
  their submit button only shows an info message — it calls **no** Supabase
  function, writes **no** AsyncStorage/localStorage, and creates **no**
  session, account, or role. Only the School/Teacher tab is wired to real
  auth, unchanged from before.
- `scripts/onboarding-guards.test.js` gained two assertions: the Coming Soon
  label is present, and the mockup submit handler's body contains no
  `signIn`/Supabase/AsyncStorage call.

Verified visually (desktop + mobile viewports, all three tabs) via a real
`expo export --platform web` build. All existing suites re-verified.

## 0c. Password-reset routing bug fix (fifth pass — mobile app only)

**Bug:** clicking a Supabase password-reset email link opened the normal
Dashboard instead of `SetPasswordScreen` — even for an already-authenticated
user. No migration, RLS, Edge Function, or Super Admin onboarding change was
needed or made; this was purely a client-side routing/deep-link bug.

**Root cause:** the app relied on Supabase-js's own `detectSessionInUrl` auto
-processing racing against a manual URL check that only understood
implicit-flow hash tokens (`#access_token=...`). A PKCE-style reset link
(`?code=...`) was invisible to that check, so the app fell through to its
normal "restore persisted session → route to dashboard" path — and if an old
session already existed, that old session won outright.

**Fix (mobile only):**
- `services/supabase.js`: `detectSessionInUrl` is now **off** on every
  platform (no more auto-detection to race against); added
  `exchangeCodeForSession()` for PKCE `?code=` links alongside the existing
  hash-token `setSessionFromTokens()`.
- `utils/deepLink.js`: `parseAuthUrl` now understands **both** callback styles
  (hash tokens and `?code=`) and pathname-based intent
  (`/set-password`, `/reset-password`); new `isPasswordSetupUrl()` is the single
  OR-of-all-signals check (pathname, `type=recovery|invite`, `access_token`,
  `code`, or an `error` param on our own reset path).
- `context/AuthContext.js`: the mount effect now checks the current URL for
  password-setup intent and, if found, **exchanges it and sets
  `flow='set_password'` before ever calling `restoreSession()`** — an existing
  persisted session is never even consulted when a fresh recovery/invite
  callback is present, so it can't win. A new `flowError` state captures an
  invalid/expired/malformed callback immediately (before any password is
  typed). The ongoing `onAuthStateChange` listener no longer touches `flow` at
  all, so a stray `TOKEN_REFRESHED`/`SIGNED_IN` event can never dismiss an
  active set-password screen. Recovery vs. invite (and therefore whether
  `accept-school-invite` is called) is still decided from the **database**
  profile role, never the URL.
- `screens/auth/SetPasswordScreen.js`: reads `flowError` and shows the
  existing "invalid link" state immediately, without requiring a submit first.
- `App.js`: **no change** — it already checked `flow === 'set_password'`
  before the dashboard/pending routes; that ordering just needed the context
  to actually set `flow` correctly, which it now does.

**Verified end-to-end** (not just source assertions): seeded a fake existing
session in `localStorage`, navigated a real exported build to
`/set-password?code=<fake>`, and confirmed the app shows the safe
"Casuumaad aan sax ahayn" (invalid-link) screen — **never the dashboard** —
proving the recovery callback wins over an old session. A plain app load with
no callback URL was also re-verified to work normally (no regression).

**New tests:** `mobile/scripts/password-reset-routing.test.js`
(`npm run test:auth-routing`) — real-logic tests against the actual
`deepLink.js` (hash-token recovery/invite, PKCE code on both `/set-password`
and `/reset-password`, native scheme link, bare revisit, error callback, and
confirms unrelated URLs do **not** trigger the flow) plus structural
invariant checks (detectSessionInUrl off, URL-check precedes
`restoreSession()`, the listener never touches `flow`, App.js's render order,
recovery/invite decided from the DB role, accept-school-invite gated on
`accept=true` only). All pass; Phase 2 + Phase 3 SQL suites, `test:onboarding`,
`audit:foundation`, and the web export all still pass.

## 0b2. Login screen: removed the visible Development Demo box (fourth pass)

The live `LoginScreen` still showed a "Development Demo — Local Preview Only"
role-picker box even for a properly-configured Supabase project (the box was
meant to be dev-only, gated on `!configured`, but the client wanted it gone
from the real login screen entirely). Fixed:
- `screens/auth/LoginScreen.js`: removed the demo box, its role picker, and
  `enterDemoMode`/`useRole` usage entirely. The live login screen now shows
  only Email, Password, Sign In, Forgot Password, and the invite-only info
  text — no code path left to enter demo mode from here.
- `screens/LandingScreen.js`: found and fixed a related dead-code bug — the
  `WebLanding` wrapper force-called `setRole('schooladmin')` on every tap of
  the landing's Login link (a leftover from the old in-landing role-picker
  login, already removed from the landing UI in pass 3). Login now calls
  `onEnter()` directly with no role side-effect.
- `scripts/onboarding-guards.test.js` updated to assert the demo entry point
  is gone from `LoginScreen`. Verified via a real web export screenshot.

## 0b. Public landing fix (third pass — landing behaviour only)

A follow-up review required the public landing to stop implying public account
creation. Fixed in BOTH landing implementations (`landing/index.html` — canonical
— and `mobile/src/screens/landing/KobciyeLanding.js` — its mirror), with no
change to live app auth, RLS, Edge Functions, or the Super Admin invite flow:

- **"Diiwaan geli Dugsigaaga" is kept as a public CTA** but now opens a
  **WhatsApp school-enquiry form only**: School name, Location/city, Contact
  full name, Phone (required) + Email, Approx. student count, Notes (optional).
  Button **"U dir WhatsApp"** validates required fields, builds the specified
  prefilled message, opens `wa.me`, and shows *"Codsigaaga WhatsApp ayuu u
  furmay. Fadlan taabo Send si Kobciye uu kuu soo gaaro."* The visitor still
  presses Send manually — no auto-send is implied.
- **Removed the fake landing login**: no role-picker tabs (Dugsiga/Arday/Waalid),
  no password fields, no fake role-based app entry. **"Login" routes only to the
  real app login.**
- **No public account creation**: the enquiry writes nothing — no Supabase,
  AsyncStorage, localStorage, school, Auth user, invitation, membership, or role.
- **One configurable, documented public number**: `wa.me` uses a digits-only
  business number from `EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER` (mobile) /
  `landing/config.js` `KOBCIYE_LANDING_WHATSAPP_NUMBER` (standalone) — no `+`,
  spaces or dashes; not hardcoded across files. `landing/README.md` documents the
  canonical source of truth and where to put the real number/app-login URL.
- **Tests**: `mobile/scripts/onboarding-guards.test.js` now inspects **both**
  landing files (kept-CTA-is-enquiry-only, no password/role picker, no storage/
  backend writes, `wa.me` + digits-only number, message carries the enquiry
  fields, Login → real app login). Live LoginScreen/AuthFlow invite-only checks
  retained. All pass; Phase 2 + Phase 3 SQL suites, audit, and web export pass.

## 0. Post-review production hardening (second pass)

An independent review accepted the SQL tests / audit / web export but flagged
four production-critical onboarding issues. All four are now fixed and covered
by new tests (see §0.1). This did not alter any earlier applied migration — it
added ONE new migration, `20260703000002_invitations_harden.sql`.

1. **No public school self-registration in live mode.** LoginScreen now shows
   only Email / Password / Sign In / Forgot Password + the text “School
   registration is handled by the Kobciye Super Admin.” The “Diiwaan geli dugsi”
   link is gone; the demo role picker shows only when Supabase is *not*
   configured (local dev). AuthFlow never routes to RegisterSchoolScreen in live
   mode. RegisterSchoolScreen was rewritten to a safe Contact / Request-a-Demo
   screen with **no password field and no AsyncStorage persistence**. The landing
   “Diiwaan geli / Dugsigaaga diiwaan geli” CTAs were relabelled to “Codso Demo”
   (Request a Demo) and open a WhatsApp contact — they create no school.
2. **Public Supabase signup disabled.** `config.toml` now sets
   `enable_signup = false` (both `[auth]` and `[auth.email]`); documented the
   matching dashboard switch. inviteUserByEmail, password reset, and the
   super_admin bootstrap are unaffected.
3. **No direct client writes to `school_invitations`.** Migration 0002 drops the
   `super_admin writes invitations` policy. super_admin keeps READ (dashboard
   list); every INSERT/UPDATE/DELETE now happens only through the SECURITY
   DEFINER RPCs (the four Edge Functions + accept flow). Audit logging preserved.
4. **Honest email delivery + safe existing-account handling.**
   `create-school-and-invite-admin` now checks for an existing account first and
   returns `existing_account_requires_manual_resolution` without creating
   anything or touching that user (no silent password-reset, no role change). It
   records the REAL email outcome on a new `email_delivery_status`
   (`pending_delivery|sent|failed`) column and never reports “sent” unless the
   send actually succeeded; on failure the UI shows “School created, but the
   invitation email was not delivered. Fix email settings and resend.” Resend
   records its real outcome too.

### 0.1 New tests for the four fixes (all run, all pass)

- SQL (`phase3_invitations.test.js`): super_admin cannot directly
  INSERT/UPDATE/DELETE `school_invitations` (but can READ); the RPC path still
  writes; a new invitation starts `pending_delivery`; only super_admin can mark
  delivery; delivery is audited.
- Static guards (`mobile/scripts/onboarding-guards.test.js`, `npm run
  test:onboarding`): signup disabled in config; RegisterSchoolScreen has no
  password/AsyncStorage/persistence; LoginScreen has no register link + shows the
  invite-only text + gates demo behind `!configured`; AuthFlow gates register
  behind `!configured`; landing has no “Diiwaan geli” CTAs; migration 0002 drops
  the write policy + adds delivery status.

---

## 1. Phase 3 status: **Complete** (code, migrations, Edge Functions, tests, and
available build checks all pass locally)

Remote-only steps that require *your* Supabase project + SMTP credentials
(deploying functions, applying the migration to the hosted DB, sending real
invite emails) are **not** claimed as done — they are documented with exact
commands in `SUPABASE_EDGE_FUNCTION_SETUP.md`. Everything that can be built and
tested here has been run and passes (see §9–§10).

---

## 2. Files created

**Database / backend**
- `supabase/migrations/20260703000001_school_invitations.sql`
- `supabase/migrations/20260703000002_invitations_harden.sql` (post-review)
- `mobile/scripts/onboarding-guards.test.js` (post-review static guards)
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/create-school-and-invite-admin/index.ts`
- `supabase/functions/resend-school-admin-invite/index.ts`
- `supabase/functions/cancel-school-invite/index.ts`
- `supabase/functions/accept-school-invite/index.ts`
- `supabase/functions/deno.json`
- `supabase/functions/.env.example` (placeholders only)
- `supabase/tests/phase3_invitations.test.js`

**Mobile**
- `mobile/src/context/AuthContext.js`
- `mobile/src/services/liveMode.js`
- `mobile/src/data/roleMap.js`
- `mobile/src/utils/deepLink.js`
- `mobile/src/screens/auth/SetPasswordScreen.js`
- `mobile/src/screens/auth/PendingScreen.js`
- `mobile/src/screens/SchoolOnboardingScreen.js`
- `mobile/metro.config.js`

**Docs**
- `PHASE_3_SCHOOL_ONBOARDING.md`
- `SUPABASE_EDGE_FUNCTION_SETUP.md`
- `PHASE_3_COMPLETION_REPORT.md` (this file)

## 3. Files changed

- `supabase/config.toml` — added Phase 3 redirect URLs + `[functions.*]` blocks (additive).
- `.gitignore` — ignore `supabase/functions/.env` and local supabase dirs.
- `mobile/App.js` — AuthProvider + auth gate (loading / set-password / pending / live / demo / login) + live-role bridge.
- `mobile/app.json` — added `"scheme": "kobciye"` for deep links.
- `mobile/src/services/supabase.js` — web session detection + invitation Edge Function invokers + super-admin queries (public key only).
- `mobile/src/services/appDataRepository.js` — refuse demo reads/writes in live mode.
- `mobile/src/context/AppDataContext.js` — empty live data (no demo seed for real users).
- `mobile/src/context/SchoolContext.js` — real school from profile in live mode.
- `mobile/src/context/RoleContext.js` — live identity override (real name/school).
- `mobile/src/screens/auth/LoginScreen.js` — real sign-in + separated "Explore Demo".
- `mobile/src/screens/auth/ForgotPasswordScreen.js` — real password-reset request.
- `mobile/src/screens/auth/AuthFlow.js` — login/register/forgot routing.
- `mobile/src/screens/DashboardScreen.js` — pass `navigation` to role bodies.
- `mobile/src/screens/dashboards/RoleDashboards.js` — live super-admin + school-admin dashboards (real counts, Register CTA).
- `mobile/src/screens/MoreScreen.js` — Sign-out for live/demo users.
- `mobile/src/components/SchoolHero.js` — disable demo branch-switching in live mode.
- `mobile/src/components/DesktopShell.js` + `mobile/src/navigation/RootNavigator.js` + `mobile/src/data/roles.js` — register `SchoolOnboarding` route + super-admin nav.

## 4. New migrations

**`20260703000002_invitations_harden.sql`** (post-review; sorts after 0001):
drops the direct `super_admin writes invitations` policy (RPC-only writes),
adds `email_delivery_status` + `email_last_error`, and the super_admin-only
`sa_mark_invitation_delivery()` RPC (audited).

**`20260703000001_school_invitations.sql`** (sorts after Phase 2's `…0008`;
touches no earlier migration). Adds:
- `invitation_status` enum (`pending|accepted|expired|cancelled`).
- `school_invitations` table (all required columns, FKs, timestamps, comments,
  CHECKs), indexes on `school_id`, `lower(invitee_email)`, `invitee_auth_user_id`,
  `status`, `expires_at`, and a **partial-unique** index preventing duplicate
  pending invites per (school, email).
- RLS: **super_admin only** (no policy for anyone else — invitees never touch the table).
- SECURITY DEFINER RPCs: `my_email`, `sa_create_school_and_invitation`,
  `sa_attach_invitation_auth_user`, `sa_resend_invitation`, `sa_cancel_invitation`,
  `accept_school_invitation`, `expire_stale_school_invitations` (all `EXECUTE`
  locked to `authenticated`, each re-checking role/identity from the DB).

## 5. Edge Functions

| Function | Responsibility |
|---|---|
| `create-school-and-invite-admin` | super_admin-only; create school + trial + invitation (RPC), send real invite email (Auth Admin API/SMTP), record Auth user id; idempotent |
| `resend-school-admin-invite` | super_admin-only; refresh expiry (RPC), re-send email; refuses accepted/cancelled |
| `cancel-school-invite` | super_admin-only; cancel invitation (RPC), block future acceptance |
| `accept-school-invite` | invitee; derive user from JWT, verify email/expiry/pending in the RPC, assign `school_admin`, mark accepted, audit |

Every function: verifies the JWT, re-checks the caller's DB role, validates input,
uses server secrets only server-side, returns structured safe errors (no keys /
tokens / raw DB errors), handles CORS, and is idempotent where it matters.

## 6. Real Auth implementation

- Session restore on open, auth-state listener, email/password sign-in, sign-out,
  password-reset request, set-new-password, profile load from Supabase.
- **Role-based routing from the database `profiles.role`** (mapped to UI keys in
  `roleMap.js`) — never a frontend role picker. Real role values used exactly:
  `super_admin, school_admin, teacher, accountant, parent, student, pending`.
- `isLiveSupabaseMode()` cleanly separates live vs demo; a real authenticated user
  is always live and never sees demo/AsyncStorage records. Demo/preview remains
  behind an explicit "Explore Demo" button.
- Mobile uses only `EXPO_PUBLIC_SUPABASE_URL` + the publishable anon key.

## 7. School onboarding flow

Super Admin → **Register New School** (`SchoolOnboardingScreen`) → **Create School
& Send Invite** → school + trial + pending invitation created, invite email sent →
admin opens link → **SetPasswordScreen** (chooses own password) → `updateUser` +
`accept-school-invite` → assigned `school_admin` for only that school → routed to
an **empty** School Admin dashboard (zero students/classes/payments/…). Resend,
cancel, expiry, and all invite-state screens are implemented.

## 8. Invitation / security summary

- Only a real DB `super_admin` can create/resend/cancel; verified in-DB, not from
  metadata. Anonymous/pending/school_admin/teacher/etc. are all refused.
- Only the matching invited user (email from `auth.users`, via `my_email()`) can
  accept; expired/cancelled/already-accepted invites are refused; a user cannot
  accept another's invite or self-promote via payload.
- Existing accounts are protected: acceptance requires a still-`pending` profile
  with no school; an existing user's role/school is never silently changed.
- `school_invitations` is invisible/unwritable to non-super-admins (RLS).
- Audit logs written for school creation, invitation create/resend/cancel/accept,
  and role assignment. All Phase 2 protections (profile column guard, cross-school
  guards, function EXECUTE revokes, RLS) remain intact and re-verified.

## 9. Tests run and exact results

- `supabase/tests/security.test.js` (Phase 2) — **all assertions passed**
  (applies all 10 migrations incl. the two new ones).
- `supabase/tests/phase3_invitations.test.js` (Phase 3) — **all assertions
  passed** (super_admin-only creation; anon/pending/school_admin refused; secure
  invitation create + audit; no role from metadata; only-matching-user accept;
  expired/cancelled/twice-accept refused; resend/cancel super_admin-only + audited;
  role+membership audit; new admin sees only their own empty school; RLS on;
  **super_admin cannot directly write school_invitations — RPC-only**;
  **delivery status starts pending_delivery, super_admin-only mark, audited**).
- `mobile/ npm run test:onboarding` — **PASSED** (invite-only production rules:
  signup disabled, no password/persistence in RegisterSchoolScreen, no register
  link in live LoginScreen, AuthFlow gating, no landing register CTAs).
- `mobile/ npm run audit:foundation` — **PASSED** (no forbidden tokens; canonical
  seed integrity valid).

## 10. Build / export results

- `npx expo export --platform web --max-workers 2` — **success**, `dist/`
  produced, 633 modules bundled. Built bundle scanned: **0** occurrences of
  `service_role` / service-role key (only the public anon key is embedded).

## 11. Required manual Supabase dashboard actions

Apply the new migration; deploy the four Edge Functions; set their secrets;
configure SMTP + Invite/Reset email templates; set Auth Site URL + redirect
allow-list; bootstrap the first super_admin. Exact commands in
`SUPABASE_EDGE_FUNCTION_SETUP.md`.

## 12. Required Edge Function secrets (placeholders only)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all injected by
the platform); `KOBCIYE_INVITE_REDIRECT_URL`, `KOBCIYE_ALLOWED_ORIGINS` (you set).
See `supabase/functions/.env.example`. No real values are in the repo.

## 13. Required Auth redirect URLs

`http(s)://<web>/set-password`, `http(s)://<web>/reset-password`,
`kobciye://set-password`, `kobciye://reset-password`, `exp://127.0.0.1:8081`.

## 14. Required email / SMTP setup

Custom SMTP in Project Settings → Authentication → SMTP (any provider: SES,
Postmark, SendGrid, Mailgun, Brevo, Resend-SMTP, …). Invite/Reset templates keep
`{{ .ConfirmationURL }}` and never contain a password. No Resend account is
assumed.

## 15. Deferred to Phase 4

Per-module live CRUD over Supabase (students/classes/attendance/exams/finance/
messages) via the `dataProvider` seam; multi-school membership UI; invite
throttling/tracking; push notifications. Phase 3 delivers real auth + secure
onboarding with live empty states for new schools.

## 16. Updated project ZIP

`kobciye_phase3_ready.zip` (excludes `node_modules/`, `dist/`, and real `.env`
files).

## 17. Phase 3 stability & security audit (2026-07-08)

A full end-to-end audit pass over the five reported problems. No existing
migration was edited; no new migration was needed (the delivery-status
machinery already exists in `20260703000002_invitations_harden.sql`).

**Problem 1 — invite password setup.** Two remaining root causes fixed
client-side: (a) a `#error_code=otp_expired` callback (typically an email
scanner pre-consuming the one-time link) was always shown as the dead-end
"Casuumaad aan sax ahayn"; it now classifies as `expired` with the honest
"ask for a new one" state (`deepLink.js` captures `error_code`;
`classifyUrlError` in `AuthContext.js`). (b) A PKCE `?code=` link opened in a
different browser/device than the one that requested it fails with a
code-verifier error that classified as `invalid`; it now maps to a new
`wrong_browser` state with guidance copy (`SetPasswordScreen.js`).
`verifyTokenHash` additionally tolerates a `token_hash` link missing `&type=`
(tries `recovery` then `invite`).

**Problem 2 — forgot password vs pending invites.** New Edge Function
`request-password-reset`: active accounts get a real recovery email; a
pending-invite-only account gets NOTHING (recovery can never bypass
`accept-school-invite`); unknown emails get nothing; every outcome returns
one identical generic body (no enumeration); fails closed on profile-read
errors. The client (`AuthContext.requestPasswordReset`) now calls it instead
of `resetPasswordForEmail`; both forgot-password UIs show one neutral
confirmation for every outcome. **Deployment required:**
`supabase functions deploy request-password-reset`.

**Problem 3 — stage-aware School UI.** `terminologyForStage()` +
`schoolNavItemsFor()` in the central config; live wiring via a new
`useStageTerminology` hook in RootNavigator tabs, desktop Sidebar and
MoreScreen (Fasallada for Hoose/Dhexe, Formamka for Sare; null/demo falls
back to the neutral primary terms). `SCHOOL_SECTIONS` +
`defaultSectionsForStage()` prepare Phase 4 multi-section schools; no section
management UI was built (Phase 4).

**Problem 4 — university registration payload.** Verified already correct:
the stage selector is hidden for Jaamacad, the client sends exactly
`institution_type='university'`, `school_stage=null` (`'' → null`
normalisation test-enforced), and routing lands in UniversityAppShell only.

**Problem 5 — invite email delivery.** The pending/sent/failed delivery
machinery already existed. This pass sanitised the remaining raw
`console.error(rpcErr.message)` logs in `accept-school-invite`,
`resend-school-admin-invite` and `cancel-school-invite` to safe categories +
correlation ids (raw provider text goes only to the truncated, super_admin-
visible `email_last_error` column, unchanged). **Redeploy the three touched
functions.**

**Tests.** New `mobile/scripts/phase3-audit.test.js` (46 assertions; run via
`npm run test:phase3-audit`); `invite-callback-hardening.test.js` extended
with the `error_code`, `wrong_browser` and missing-type scenarios; two stale
landing guards updated to the current login-modal design (password never
transmitted/persisted; login routes to the real app). All suites pass:
onboarding, auth-routing, auth-race, institution-mode,
university-registration, invite-callback, phase3-audit, audit:foundation,
plus the three pglite DB suites and `expo export --platform web`.
