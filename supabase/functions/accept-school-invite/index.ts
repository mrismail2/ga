// ============================================================
// Kobciye — Edge Function: accept-school-invite
//
// Called by the invited user AFTER they have set their own password
// (the app does supabase.auth.updateUser({ password }) first, so the caller
// is fully authenticated here). This is the ONLY server path that converts an
// invited account into school_admin.
//
// Everything is derived server-side by the accept_school_invitation() RPC:
//   • the caller is auth.uid() (from the verified JWT)
//   • their email (my_email(), from auth.users) must match the invitation
//   • the invitation must be pending and unexpired
//   • the profile must still be pending with no school (existing accounts are
//     never silently re-roled)
// The client MAY pass an invitation_id, but it is only ever re-verified against
// the caller's email — it is never trusted to select a different invite.
// ============================================================
import { corsHeaders, fail, getCaller, json, newCorrelationId } from "../_shared/cors.ts";

// Classify the RPC error into a small safe category — the category (never
// the raw message, which can embed an email or invite detail) is all that is
// ever logged; the same category drives the client-facing code below.
function classifyAcceptError(message: string): string {
  if (/already accepted/i.test(message)) return "already_accepted";
  if (/cancelled/i.test(message)) return "cancelled";
  if (/expired/i.test(message)) return "expired";
  if (/different email/i.test(message)) return "email_mismatch";
  if (/no pending invitation/i.test(message)) return "not_found_pending";
  if (/already belongs to a school/i.test(message)) return "already_member";
  if (/not found/i.test(message)) return "not_found";
  return "accept_failed";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  const correlationId = newCorrelationId();

  try {
    const { user, supa } = await getCaller(req);
    if (!user) return fail(req, 401, "unauthenticated", "Please sign in with your invite link first.", correlationId);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* invitation_id is optional */ }
    const rawId = body.invitation_id == null ? null : String(body.invitation_id).trim();
    const invitationId = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null;

    const { data: res, error: rpcErr } = await supa.rpc("accept_school_invitation", {
      p_invitation_id: invitationId,
    });
    if (rpcErr) {
      const category = classifyAcceptError(rpcErr.message);
      console.error(`[${correlationId}] accept_school_invitation:`, category);
      if (category === "already_accepted") return fail(req, 409, "already_accepted", "This invitation has already been accepted.", correlationId);
      if (category === "cancelled") return fail(req, 409, "cancelled", "This invitation was cancelled.", correlationId);
      if (category === "expired") return fail(req, 410, "expired", "This invitation has expired. Ask your platform admin to resend it.", correlationId);
      if (category === "email_mismatch") return fail(req, 403, "email_mismatch", "This invitation was issued to a different email address.", correlationId);
      if (category === "not_found_pending") return fail(req, 404, "not_found", "No pending invitation was found for your account.", correlationId);
      if (category === "already_member") return fail(req, 409, "already_member", "Your account already belongs to a school.", correlationId);
      if (category === "not_found") return fail(req, 404, "not_found", "Invitation not found.", correlationId);
      return fail(req, 500, "accept_failed", "Could not accept the invitation.", correlationId);
    }

    return json(req, 200, { ok: true, school_id: res.school_id, role: res.role });
  } catch (e) {
    console.error(`[${correlationId}] accept-school-invite uncaught:`, (e as Error)?.name || "unknown_error");
    return fail(req, 500, "internal_error", "Something went wrong. Please try again.", correlationId);
  }
});
