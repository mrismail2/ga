# Kobciye — Phase 5 Edge Functions deploy & secrets guide (2026‑07‑26)

Two Deno Edge Functions back Phase 5. Both keep the **service‑role key on the
server only** — it is never shipped to the client. Deploy them from a machine
that is authenticated to your Supabase project (`supabase login`), against a
copy/branch first. **These steps were NOT run in the build environment** (no
project credentials here) — they are the operator runbook.

## Functions

| Function | Purpose | Auth model |
|---|---|---|
| `supabase/functions/identifier-login/index.ts` | Resolves a School‑ID + Student‑ID (+ role) login to the internal email server‑side, rate‑limits, signs in with the anon key, returns real session tokens. | Public (anon) invoke; uses service‑role **inside** only. |
| `supabase/functions/provision-account/index.ts` | Creates/invites accounts; returns one‑time credentials for a no‑email student; records invitations under the **caller’s** JWT. | Requires caller JWT (admin); uses service‑role for Auth‑admin only. |

## 1. Apply the corrective migration first

```bash
# read-only preflight against a branch/copy — proceed only if every row = 0
psql "$DATABASE_URL" -f KOBCIYE_PHASE5_CORRECTION_PREFLIGHT_20260726.sql

# apply migrations (no reset)
supabase db push        # or your normal migration apply; NEVER `supabase db reset`
```

## 2. Secrets (set on the project, server‑side only)

The Supabase runtime injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` into deployed functions automatically. Verify they
exist; do **not** hardcode them and do **not** expose the service‑role key to
the app:

```bash
supabase secrets list
# If you use any custom names, set them (example only):
# supabase secrets set SERVICE_ROLE_KEY=... APP_URL=...
```

Client `.env` (mobile) keeps only the **public** values it already uses:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. No service‑role key.

## 3. Deploy

```bash
supabase functions deploy identifier-login
supabase functions deploy provision-account
```

`identifier-login` must be invokable with the **anon** key (it is the login
entry point). `provision-account` must require a valid caller JWT.

## 4. SMTP (for Teacher/Parent email invites)

Configure the project’s Auth SMTP (Dashboard → Auth → SMTP) so invitation and
recovery emails are delivered. No‑email students do **not** need SMTP — they use
the one‑time credentials returned by `provision-account`.

## 5. Smoke checks (against the branch/copy)

```bash
# identifier-login returns a generic 401 for a bad login (no enumeration)
curl -s -X POST "$SUPABASE_URL/functions/v1/identifier-login" \
  -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"kind":"student","schoolCode":"SCH-XXXXXX","studentId":"nope","password":"x"}'
# expect: HTTP 401, generic body — never a "user not found" style message

# after N bad attempts the same identifier is locked (rate-limit)
```

Then run the manual browser checklist
`KOBCIYE_PHASE5_CORRECTION_MANUAL_BROWSER_TEST_20260726.md`.

## Rollback

The corrective migration is additive; to roll back, drop the added objects in a
new reviewed migration (`login_attempts`, `profiles.must_change_password`,
`schools.login_code` + its index/trigger, and the added functions). Do **not**
edit the delivered `…0001–0010` files in place.
