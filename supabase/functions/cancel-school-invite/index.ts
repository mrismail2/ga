// ============================================================
// Kobciye — Edge Function: cancel-school-invite
//
// Super-admin-only. Cancels a pending/expired invitation (via the audited
// sa_cancel_invitation RPC) so it can never be accepted. Refuses to cancel an
// already-accepted invite. No email is sent.
// ============================================================
import { corsHeaders, fail, getCaller, json, newCorrelationId } from "../_shared/cors.ts";

// Safe log category for the cancel RPC's failure — never the raw message,
// which can embed an email or invitation detail.
function classifyCancelError(message: string): string {
  if (/already accepted/i.test(message)) return "already_accepted";
  if (/not found/i.test(message)) return "not_found";
  if (/only a super_admin/i.test(message)) return "forbidden";
  return "cancel_failed";
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
      return fail(req, 403, "forbidden", "Only a super admin may cancel an invitation.", correlationId);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(req, 400, "bad_request", "Invalid JSON body.", correlationId); }
    const invitationId = String(body.invitation_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return fail(req, 400, "invalid_input", "Missing invitation id.", correlationId);

    const { data: res, error: rpcErr } = await supa.rpc("sa_cancel_invitation", { p_invitation_id: invitationId });
    if (rpcErr) {
      const category = classifyCancelError(rpcErr.message);
      console.error(`[${correlationId}] sa_cancel_invitation:`, category);
      if (category === "already_accepted") return fail(req, 409, "already_accepted", "This invitation was already accepted and cannot be cancelled.", correlationId);
      if (category === "not_found") return fail(req, 404, "not_found", "Invitation not found.", correlationId);
      if (category === "forbidden") return fail(req, 403, "forbidden", "Only a super admin may cancel an invitation.", correlationId);
      return fail(req, 500, "cancel_failed", "Could not cancel the invitation.", correlationId);
    }

    return json(req, 200, { ok: true, invitation_id: invitationId, status: res.status });
  } catch (e) {
    console.error(`[${correlationId}] cancel-school-invite uncaught:`, (e as Error)?.name || "unknown_error");
    return fail(req, 500, "internal_error", "Something went wrong. Please try again.", correlationId);
  }
});
