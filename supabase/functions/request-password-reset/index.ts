// ============================================================
// Kobciye — Edge Function: request-password-reset
//
// The ONLY server path behind the app's "Ma illowday furaha sirta?" form.
// Replaces the client's direct resetPasswordForEmail call so the decision
// "may this email receive a recovery link?" is made SERVER-side:
//
//   • email has an ACTIVE account (profile role ≠ 'pending')
//       → send the real recovery email (Supabase Auth SMTP).
//   • email belongs only to a PENDING invite (role = 'pending')
//       → send NOTHING. A recovery link must never become a side door around
//         the invitation activation flow (accept-school-invite). The invited
//         admin must use their invite link, or ask the super admin to resend.
//   • email has no account at all
//       → send NOTHING.
//
// In EVERY case the client receives the exact same generic 200 response, so
// the endpoint reveals nothing about whether an email exists or its state
// (no enumeration). The real outcome is visible only in server logs as a safe
// category + correlation id — never the email, never a token, never SMTP
// details.
// ============================================================
import { adminClient, corsHeaders, fail, json, newCorrelationId } from "../_shared/cors.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// The redirect for the recovery email link — same set-password destination
// the invite flow uses (the app decides invite-vs-recovery from the DATABASE
// profile, never from the URL, so sharing the route is safe by design).
function recoveryRedirect(): string {
  return Deno.env.get("KOBCIYE_INVITE_REDIRECT_URL") ||
    "http://localhost:8081/set-password";
}

// Best-effort existing-account lookup via the Admin API (paginated) — same
// bounded approach as create-school-and-invite-admin. Returns the user id or
// null. Never logs the email.
async function findUserByEmail(admin: SupabaseClient, email: string, correlationId: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(`[${correlationId}] listUsers:`, "unknown_db_error"); return null; }
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 200) break; // last page
  }
  return null;
}

// One identical body for every outcome — the anti-enumeration guarantee.
function genericOk(req: Request): Response {
  return json(req, 200, {
    ok: true,
    message: "Haddii email-kan uu leeyahay account shaqaynaya, fariin ayaa loo diri doonaa.",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  const correlationId = newCorrelationId();

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(req, 400, "bad_request", "Invalid JSON body.", correlationId); }

    const email = String(body.email ?? "").trim().toLowerCase();
    // Format validation reveals nothing about any account — safe to reject.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return fail(req, 400, "invalid_email", "Geli email sax ah.", correlationId);
    }

    const admin = adminClient();

    const userId = await findUserByEmail(admin, email, correlationId);
    if (!userId) {
      console.log(`[${correlationId}] request-password-reset: no_account`);
      return genericOk(req);
    }

    // Service-role profile read (RLS does not apply): only the role is
    // selected — nothing else about the account is touched or returned.
    const { data: prof, error: profErr } = await admin
      .from("profiles").select("role").eq("id", userId).single();
    if (profErr) {
      // Can't prove the account is active — fail CLOSED (send nothing) so a
      // transient DB error can never turn into an invite-activation bypass.
      console.error(`[${correlationId}] request-password-reset:`, "profile_read_failed");
      return genericOk(req);
    }

    if (!prof || prof.role === "pending") {
      // Pending invite only — recovery must not bypass invitation activation.
      console.log(`[${correlationId}] request-password-reset: reset_blocked_pending_invite`);
      return genericOk(req);
    }

    const { error: sendErr } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirect(),
    });
    if (sendErr) {
      // Safe category only — never the raw SMTP/auth error, never the email.
      console.error(`[${correlationId}] request-password-reset:`, "recovery_email_send_failed");
      return genericOk(req);
    }

    console.log(`[${correlationId}] request-password-reset: recovery_email_sent`);
    return genericOk(req);
  } catch (e) {
    console.error(`[${correlationId}] request-password-reset uncaught:`, (e as Error)?.name || "unknown_error");
    // Same generic body even on unexpected failure — never a different shape
    // for different account states.
    return genericOk(req);
  }
});
