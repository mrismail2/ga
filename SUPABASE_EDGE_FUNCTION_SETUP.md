# Kobciye — Supabase Edge Function & Migration Setup (Phase 3)

Exact commands and settings to deploy the Phase 3 backend to a **hosted**
Supabase project. Nothing here has been run against your project automatically —
run these yourself where noted.

> Security: the mobile app only ever uses the **public** anon/publishable key.
> The `service_role` key is a server-only secret used **inside Edge Functions**.
> Never put it in `mobile/.env`, any `EXPO_PUBLIC_*` variable, logs, or the repo.

---

## 0. Prerequisites

```bash
npm i -g supabase          # Supabase CLI (one time)
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>   # ref from your project URL
```

## 1. Apply the new migration

The Phase 3 migrations are
`supabase/migrations/20260703000001_school_invitations.sql` and
`supabase/migrations/20260703000002_invitations_harden.sql`. They sort strictly
after every Phase 2 migration and modify none of them.

```bash
# CLI (recommended) — pushes any not-yet-applied migrations in order:
supabase db push
```

Or, without the CLI: open **Dashboard → SQL Editor** and run the contents of
`20260703000001_school_invitations.sql` then `20260703000002_invitations_harden.sql`
once (after the Phase 2 migrations 0001–0008 are already applied).

Migration 0002 makes `school_invitations` write-only-via-server (super_admin can
read but not directly insert/update/delete) and adds the `email_delivery_status`
column (`pending_delivery | sent | failed`) that the Edge Functions record.

Verify:

```sql
select count(*) from public.school_invitations;                 -- 0 rows, table exists
select proname from pg_proc where proname like 'sa_%'
   or proname in ('accept_school_invitation','my_email');       -- the RPCs exist
```

## 2. Deploy the Edge Functions

Functions live under `supabase/functions/`:

```
supabase/functions/
├─ _shared/cors.ts
├─ create-school-and-invite-admin/index.ts
├─ resend-school-admin-invite/index.ts
├─ cancel-school-invite/index.ts
└─ accept-school-invite/index.ts
```

Deploy all four (each is JWT-verified by default):

```bash
supabase functions deploy create-school-and-invite-admin
supabase functions deploy resend-school-admin-invite
supabase functions deploy cancel-school-invite
supabase functions deploy accept-school-invite
```

(Or deploy everything at once with `supabase functions deploy`.)

## 3. Set Edge Function secrets

The platform injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` automatically — you do **not** set those. You set the
custom ones. Placeholders are documented in `supabase/functions/.env.example`.

```bash
# copy the example, fill in REAL values, keep it out of git (.gitignored):
cp supabase/functions/.env.example supabase/functions/.env
#   KOBCIYE_INVITE_REDIRECT_URL=https://<your-web-app>/set-password
#   KOBCIYE_ALLOWED_ORIGINS=http://localhost:8081,https://<your-web-app>

supabase secrets set --env-file supabase/functions/.env
supabase secrets list        # confirm names are set (values are hidden)
```

Required secret names:

| Secret | Who sets it | Purpose |
|---|---|---|
| `SUPABASE_URL` | platform (auto) | project URL |
| `SUPABASE_ANON_KEY` | platform (auto) | caller-scoped client |
| `SUPABASE_SERVICE_ROLE_KEY` | platform (auto) | Auth Admin API (server-only) |
| `KOBCIYE_INVITE_REDIRECT_URL` | you | where invite/recovery links return |
| `KOBCIYE_ALLOWED_ORIGINS` | you | CORS allow-list (comma-separated) |

## 4. Configure Auth (dashboard)

1. **Authentication → URL Configuration**: set Site URL and add the redirect
   URLs listed in `PHASE_3_SCHOOL_ONBOARDING.md` §5 (including `kobciye://…`
   and your `/set-password` web URLs).
2. **Authentication → Providers → Email**: enabled, but **turn OFF “Allow new
   users to sign up.”** Kobciye is invite-only; `config.toml` sets
   `enable_signup = false` for local dev, and this dashboard switch is the
   matching setting for the hosted project. This does **not** break
   `inviteUserByEmail`, password recovery, or the super_admin bootstrap.
3. **Authentication → Email Templates**: set the **Invite user** and **Reset
   password** templates (keep `{{ .ConfirmationURL }}`, never include a password).

## 5. Configure SMTP (dashboard → Project Settings → Authentication → SMTP)

Set a custom SMTP sender so invite/recovery emails actually deliver. Any provider
works (Amazon SES, Postmark, SendGrid, Mailgun, Brevo, Gmail Workspace SMTP,
Resend-SMTP, …). Fields: host, port, username, password, sender name + address.

> Kobciye does not assume you own a Resend account. Use whatever transactional
> email/SMTP provider you have. Emails are sent by Supabase Auth over this SMTP —
> the app never sends email and never simulates delivery.

## 6. Bootstrap the first super_admin (one-time, controlled)

Because public signup is disabled, create the first super_admin through a
controlled admin path — never public signup:

```
1. Dashboard → Authentication → Users → "Add user" → create the platform owner's
   account (set an email; you can send an invite or set a temporary password).
   (Equivalently: supabase.auth.admin.createUser via a one-off service-role script.)
2. Dashboard → SQL Editor (a no-JWT session — the sanctioned bootstrap path):
```
```sql
update public.profiles set role = 'super_admin' where id = '<that-auth-user-id>';
```
After this one row, the super_admin creates all schools from the app. The SQL
Editor is reserved for this one-time bootstrap / emergency admin work only.

## 7. Smoke-test the deployed functions

Sign in as the super_admin in the app and press **Create School & Send Invite**,
or call directly with a real user access token:

```bash
curl -i -X POST \
  "https://<YOUR-PROJECT-REF>.functions.supabase.co/create-school-and-invite-admin" \
  -H "Authorization: Bearer <SUPER_ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test School","slug":"test-school","location":"Gabiley",
       "admin_name":"Test Admin","admin_email":"you+admin@example.com","admin_phone":"+252611234567"}'
```

Expected: `201` with `{ ok:true, school_id, invitation_id, invitee_email, email_channel:"invite" }`
and a real invite email in the inbox. A non-super-admin token gets `403`.

## 8. Local development (optional)

```bash
supabase start                         # local Postgres + Auth + Storage (Docker)
supabase functions serve               # run the functions locally
# set local secrets in supabase/functions/.env, then invoke via the app pointed
# at the local URL/anon key.
```

## Troubleshooting

- **403 forbidden** — caller isn't a database `super_admin` (check `profiles.role`).
- **Email not received** — SMTP not configured, or the address is rate-limited;
  check dashboard → Authentication → Logs.
- **Redirect error on the link** — the redirect URL isn't in the allow-list
  (dashboard §4.1) or `KOBCIYE_INVITE_REDIRECT_URL` is wrong.
- **CORS error in the browser** — add your web origin to `KOBCIYE_ALLOWED_ORIGINS`.
