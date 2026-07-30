// ============================================================
// Kobciye — Edge Function: resend-school-admin-invite
//
// Super-admin-only. Refreshes a pending/expired invitation's expiry (via the
// audited sa_resend_invitation RPC, which refuses accepted/cancelled invites
// and never duplicates a school/invitation) and re-sends the REAL email through
// Supabase Auth SMTP. The ACTUAL delivery outcome is recorded on the invitation
// (sent | failed) — we never report "sent" unless the send actually succeeded.
// ============================================================
import { adminClient, corsHeaders, fail, getCaller, inviteRedirect, json, newCorrelationId } from "../_shared/cors.ts";

// Safe log category for the resend RPC's failure — never the raw message,
// which can embed an email or invitation detail.
function classifyResendError(message: string): string {
  if (/already accepted/i.test(message)) return "already_accepted";
  if (/cancelled/i.test(message)) return "cancelled";
  if (/not found/i.test(message)) return "not_found";
  if (/only a super_admin/i.test(message)) return "forbidden";
  return "resend_failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  const correlationId = newCorrelationId();

  try {
    const { user, supa } = await getCaller(req);
    if (!user) return fail(req, 401, "unauthenticated", "Please sign in.", correlationId);

    const { data: prof } = await supa.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "super_admin") {
      return fail(req, 403, "forbidden", "Only a super admin may resend an invitation.", correlationId);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(req, 400, "bad_request", "Invalid JSON body.", correlationId); }
    const invitationId = String(body.invitation_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return fail(req, 400, "invalid_input", "Missing invitation id.", correlationId);

    const { data: res, error: rpcErr } = await supa.rpc("sa_resend_invitation", {
      p_invitation_id: invitationId, p_expires_in_days: 14,
    });
    if (rpcErr) {
      const category = classifyResendError(rpcErr.message);
      console.error(`[${correlationId}] sa_resend_invitation:`, category);
      if (category === "already_accepted") return fail(req, 409, "already_accepted", "This invitation was already accepted.", correlationId);
      if (category === "cancelled") return fail(req, 409, "cancelled", "This invitation was cancelled. Create a new one instead.", correlationId);
      if (category === "not_found") return fail(req, 404, "not_found", "Invitation not found.", correlationId);
      if (category === "forbidden") return fail(req, 403, "forbidden", "Only a super admin may resend an invitation.", correlationId);
      return fail(req, 500, "resend_failed", "Could not resend the invitation.", correlationId);
    }

    const email = String(res.invitee_email);

    // Re-send a real email. The Auth user usually already exists from the first
    // invite, so a password-recovery email is the reliable "set your password"
    // channel here; fall back to a fresh invite if the user was never created.
    // Raw provider errors go ONLY to email_last_error via
    // sa_mark_invitation_delivery (a deliberate, super_admin-visible dashboard
    // field, truncated server-side) — the console log gets a safe category.
    const admin = adminClient();
    let channel: "invite" | "recovery" = "recovery";
    let delivered = false;
    let lastError: string | null = null;

    const rec = await admin.auth.resetPasswordForEmail(email, { redirectTo: inviteRedirect() });
    if (!rec.error) {
      delivered = true;
    } else {
      console.error(`[${correlationId}] resetPasswordForEmail:`, "email_delivery_failed");
      lastError = rec.error.message;
      const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: inviteRedirect() });
      if (!inv.error) { delivered = true; channel = "invite"; }
      else { console.error(`[${correlationId}] inviteUserByEmail (resend fallback):`, "email_delivery_failed"); lastError = inv.error.message; }
    }

    // record the actual outcome
    const mark = await supa.rpc("sa_mark_invitation_delivery", {
      p_invitation_id: invitationId, p_status: delivered ? "sent" : "failed", p_error: delivered ? null : lastError,
    });
    if (mark.error) console.error(`[${correlationId}] sa_mark_invitation_delivery:`, "unknown_db_error");

    if (!delivered) {
      return json(req, 200, {
        ok: true, invitation_id: invitationId, invitee_email: email, delivery: "failed",
        message: "Invitation refreshed, but the email was not delivered. Fix email settings and resend.",
      });
    }
    return json(req, 200, { ok: true, invitation_id: invitationId, invitee_email: email, delivery: "sent", email_channel: channel });
  } catch (e) {
    console.error(`[${correlationId}] resend-school-admin-invite uncaught:`, (e as Error)?.name || "unknown_error");
    return fail(req, 500, "internal_error", "Something went wrong. Please try again.", correlationId);
  }
});
