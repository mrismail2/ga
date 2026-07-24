# Kobciye — Phase 3: Real Authentication & Secure School Onboarding

Phase 3 replaces the preview-only login with **real Supabase Authentication**
and adds the full multi-school SaaS onboarding flow:

> Super Admin registers a school → system emails a school-admin invite →
> the admin opens the link → chooses their **own** password → signs in →
> sees only their **own, empty** school dashboard.

No ready-made passwords are ever generated, emailed, displayed, or stored. Every
privileged decision (who may create a school, who may accept an invite, what
role a user gets) is re-derived **in the database** from the caller's JWT and
`profiles.role` — never from client/request metadata.

---

## 1. Architecture overview

```
Mobile / Web app  (Expo, PUBLIC anon key only)
  ├─ AuthContext ............ real session, DB-profile role routing, live/demo switch
  ├─ services/supabase.js ... auth helpers + Edge Function invokers (no secrets)
  ├─ services/liveMode.js ... isLiveSupabaseMode() — live & demo data never mix
  └─ screens/auth/* ......... Login, ForgotPassword, SetPassword, Pending
        │  functions.invoke(...)              │ auth email links (invite/recovery)
        ▼                                     ▼
Supabase Edge Functions  (service-role, server-only secrets)
  ├─ create-school-and-invite-admin
  ├─ resend-school-admin-invite
  ├─ cancel-school-invite
  └─ accept-school-invite
        │  supabase.rpc(...)  (caller-scoped → DB re-checks role/identity)
        ▼
Postgres (RLS + SECURITY DEFINER RPCs, migration 20260703000001)
  ├─ school_invitations (RLS: super_admin only)
  ├─ sa_create_school_and_invitation / sa_attach_invitation_auth_user
  ├─ sa_resend_invitation / sa_cancel_invitation
  ├─ accept_school_invitation  ← the ONLY path that mints school_admin
  └─ audit_logs (school.create, invitation.*, profile.assign_role)
```

**Why two layers.** The Edge Functions do the two things SQL cannot: verify the
JWT + call the Supabase Auth Admin API (create/invite the user, send the email
via SMTP). All *authorization* lives in the SQL RPCs, which re-check
`profiles.role = 'super_admin'` (or the invitee's `auth.uid()`/email) themselves.
So even a bug in an Edge Function cannot let a non-super-admin create a school or
let someone accept an invite that isn't theirs. The RPCs are covered by a real
Postgres test suite (`supabase/tests/phase3_invitations.test.js`, 51 assertions).

**Live vs demo.** `isLiveSupabaseMode()` is true only for an authenticated real
user. In live mode the app never reads or writes the AsyncStorage demo store:
`AppDataContext`, `SchoolContext`, and the demo repository all return empty data,
so a new school shows genuine **empty states / zero counts** — never Dugsiga
Hidaayada or other demo records. The demo/preview mode is preserved behind a
clearly-labelled **"Explore Demo"** button on the login screen for development.

---

## 2. School registration flow (Super Admin)

1. Super Admin dashboard → **Register New School** (CTA or the "Dugsiyada"
   nav item → `SchoolOnboardingScreen`).
2. Enter: school name, slug, location, admin full name, admin email, admin phone.
3. Press **Create School & Send Invite** (disabled while a request is in flight —
   no duplicate submits).
4. The app calls the `create-school-and-invite-admin` Edge Function, which:
   - verifies the caller's JWT and that they are a real `super_admin`;
   - calls `sa_create_school_and_invitation()` → creates the school + a
     30-day trial subscription + a **pending** invitation (audited, idempotent);
   - calls `supabase.auth.admin.inviteUserByEmail()` → creates the Auth user
     (if new) and sends the **real** invite email via the project SMTP;
   - records the returned Auth user id on the invitation via
     `sa_attach_invitation_auth_user()`.
5. Idempotency: a double-click re-runs step 4; the RPC returns the same
   `school_id`/`invitation_id` (`idempotent: true`) and the email is not re-sent
   — no duplicate school or invitation.

**Invite-only.** There is no public school self-registration. The live login
screen shows only Email / Password / Sign In / Forgot Password + “School
registration is handled by the Kobciye Super Admin.” Public Supabase signup is
disabled (`enable_signup = false` + the dashboard switch). The demo role picker
appears only when Supabase is not configured (local dev).

**Email delivery is honest.** The create/resend Edge Functions record the real
outcome on `school_invitations.email_delivery_status`
(`pending_delivery | sent | failed`). The app never shows “invite sent” unless
the send actually succeeded; on failure the Super Admin sees “School created, but
the invitation email was not delivered. Fix email settings and resend,” and the
invitation card shows a failed-delivery warning with a Resend action.

**Existing accounts are protected.** If the invited email already has a Kobciye
account, `create-school-and-invite-admin` returns
`existing_account_requires_manual_resolution`, creates **nothing**, and does not
touch that user's password, role, school, or membership (no silent reset email).

---

## 3. Invitation flow & statuses

`school_invitations.status` ∈ `pending | accepted | expired | cancelled`.

| Action | Who | Effect |
|---|---|---|
| Create | super_admin | new `pending` row + school + trial |
| Resend | super_admin | refresh `expires_at`, re-arm to `pending`, re-email (refuses accepted/cancelled) |
| Cancel | super_admin | `cancelled`, blocks future acceptance (refuses accepted) |
| Accept | the invited user | `accepted`, assigns `school_admin`, syncs membership, audits |
| Expire | cron / super_admin | past-due `pending` → `expired` (`expire_stale_school_invitations()`) |

A partial-unique index guarantees at most one **pending** invitation per
(school, email). Only a super_admin can read/manage invitations through the
client API (RLS); the invitee never touches the table directly.

---

## 4. Password setup flow (invited admin) — Section E

1. Admin receives the **"Join Kobciye"** email and taps the link.
2. The link redirects to the set-password destination (deep link on native, the
   `/set-password` route on web). The token establishes a session; the app opens
   **`SetPasswordScreen`** (mode `invite`).
3. The admin chooses + confirms their own password (min 8 chars, letter+number).
4. The app calls `supabase.auth.updateUser({ password })`, then the
   **`accept-school-invite`** Edge Function → `accept_school_invitation()`.
5. The RPC verifies (all server-side): the caller's email matches the invite, the
   invite is pending and unexpired, and the profile is still `pending` with no
   school. It then assigns `school_admin`, syncs `school_members`, marks the
   invite `accepted`, and writes audit logs.
6. The app reloads the profile → routes to the **School Admin dashboard**,
   showing only the new, **empty** school (zero students/classes/payments/…).

Distinct screens are shown for **expired**, **cancelled**, **already accepted**,
**email-mismatch**, and **invalid** links (mapped from the Edge Function's
structured error codes). Tokens are never rendered or logged.

---

## 5. Auth redirect URLs (set in Supabase dashboard → Authentication → URL Configuration)

Add every URL the invite/recovery links may return to:

```
Site URL:            https://<your-web-app>            (or http://localhost:8081 for dev)
Redirect URLs (Additional):
  http://localhost:8081/set-password
  http://localhost:8081/reset-password
  https://<your-web-app>/set-password
  https://<your-web-app>/reset-password
  kobciye://set-password
  kobciye://reset-password
  exp://127.0.0.1:8081            (Expo Go dev)
```

`supabase/config.toml` already lists the dev + deep-link URLs for local
`supabase start`. For the hosted project you must add the same URLs in the
dashboard (config.toml is not applied to a hosted project automatically).

## 6. Mobile deep-link configuration

- `mobile/app.json` declares `"scheme": "kobciye"`, so links like
  `kobciye://set-password#access_token=…&type=invite` open the app.
- Native handling lives in `src/utils/deepLink.js` + the deep-link effect in
  `AuthContext` (parses the token, calls `setSession`, opens SetPassword).
- Web handling: `supabase-js` is created with `detectSessionInUrl: true` on web,
  so the token in the URL hash is consumed automatically; the invite/recovery
  intent is captured from the initial URL and routes to SetPassword.

## 7. Web redirect URL configuration

Set the Edge Function secret `KOBCIYE_INVITE_REDIRECT_URL` to the web
set-password URL (e.g. `https://<your-web-app>/set-password`). This is the
`redirectTo` used for both invite and recovery emails. Also add it to the
dashboard redirect allow-list (Section 5).

## 8. Supabase Auth settings (dashboard → Authentication)

- **Providers → Email**: enabled, but **"Allow new users to sign up" = OFF**
  (invite-only; matches `enable_signup = false`). "Confirm email" may stay off for
  invited users (the invite itself proves email ownership); recovery/reset works
  either way. Disabling signup does not affect invite/recovery/bootstrap.
- **URL Configuration**: Site URL + redirect allow-list as in Section 5.
- **SMTP**: configure a custom SMTP sender (Section 10) — the built-in sender is
  rate-limited and not for production.
- **Rate limits**: raise the email rate limit for onboarding if needed.

## 9. Email template settings (dashboard → Authentication → Email Templates)

- **Invite user**: subject e.g. "Join Kobciye", body includes `{{ .ConfirmationURL }}`.
  Do **not** put any password in the template.
- **Reset password**: standard recovery template with `{{ .ConfirmationURL }}`.
- Ensure the templates' action link points at your configured redirect (the
  `{{ .ConfirmationURL }}` already carries the token + `redirect_to`).

## 10. SMTP / transactional email provider setup

Emails are sent by **Supabase Auth using your configured SMTP** — the app never
sends email itself and delivery is never faked/simulated.

Options (pick one), configured in **dashboard → Project Settings → Authentication → SMTP**:

- **Any SMTP provider** (Amazon SES, Postmark, SendGrid, Mailgun, Brevo, Gmail
  Workspace SMTP, …): host, port, username, password, sender email/name.
- **Resend** (optional, if you have an account): use Resend's SMTP credentials.
  Kobciye does **not** assume you own a Resend account — any SMTP provider works.

Verify by triggering a real invite from `SchoolOnboardingScreen` and confirming
the email arrives. See `SUPABASE_EDGE_FUNCTION_SETUP.md` for the exact commands.

## 11. Bootstrapping the first super_admin (one-time)

The first super_admin is created once, from the SQL Editor (a no-JWT session —
the only sanctioned bootstrap path, unchanged from Phase 2):

```sql
-- 1. Create the user in Authentication → Users (or have them sign up), note their id.
-- 2. In the SQL Editor:
update public.profiles set role = 'super_admin' where id = '<that-auth-user-id>';
```

After this, **all** ordinary school registration is done from the app — the SQL
Editor is reserved for one-time bootstrap / emergency admin work only.

## 12. Testing the full flow

Automated (no remote project needed):

```bash
cd supabase/tests && npm install
node security.test.js            # Phase 2 suite (all pass)
node phase3_invitations.test.js  # Phase 3 suite, 51 assertions (all pass)

cd ../../mobile && npm install
npm run audit:foundation         # canonical foundation clean
npx expo export --platform web   # production web bundle builds
```

End-to-end (against a configured project — see the Edge Function doc):

1. Bootstrap a super_admin (Section 11), sign in as them in the app.
2. Register a school + invite an admin (use a real inbox you control).
3. Open the invite email → set a password → land on the empty school dashboard.
4. Confirm the new admin sees **only** their school and **no** demo data.
5. Try resend/cancel; try accepting an expired/cancelled invite (should be refused).

## 13. What you must do manually in the Supabase dashboard

- Apply the new migration (`supabase db push` or SQL Editor — see the Edge doc).
- Deploy the four Edge Functions and set their secrets.
- Configure SMTP + email templates.
- Set Auth redirect URLs / Site URL.
- Bootstrap the first super_admin.

## 14. Intentionally deferred to Phase 4

- Per-module **live CRUD** over Supabase (students, classes, attendance, exams,
  finance, messages). Phase 3 wires real auth + onboarding and shows **live empty
  states** for a new school; the `dataProvider` seam flips modules to Supabase
  one at a time in Phase 4. Until then, live-mode deep screens show empty states
  and demo writes are refused (no data mixing).
- Multi-school membership UI (a user holding roles in several schools).
- In-app invitation resend throttling / email open tracking.
- Push notifications for invitations.
