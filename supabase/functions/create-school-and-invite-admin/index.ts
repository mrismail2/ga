// ============================================================
// Kobciye — Edge Function: create-school-and-invite-admin
//
// Super-admin-only. The single server-side action behind the Super Admin
// dashboard's "Create School & Send Invite" button.
//
// Flow (all privilege checks re-done in the database, never from the body):
//   1. Verify the caller's JWT + confirm super_admin (RPC re-checks too).
//   2. Validate input, INCLUDING the institution_type/school_stage pairing
//      (Phase 3 foundation: School Mode vs University Mode — see
//      supabase/migrations/20260705000001_institution_type.sql). Both are
//      required here: institution_type must be 'school' or 'university';
//      'school' additionally requires school_stage 'primary_middle' or
//      'secondary'; 'university' requires school_stage to be absent. This is
//      the same pairing rule the database CHECK constraints and the RPC
//      itself enforce — defense in depth, not the only gate.
//   3. Check whether the email already has an Auth account. If it does, create
//      NOTHING and return existing_account_requires_manual_resolution — we do
//      not touch the existing user's role/school/password, and we do not
//      silently send them a reset email.
//   4. sa_create_school_and_invitation() — school + trial + pending invitation
//      (audited, idempotent). Invitation starts email_delivery_status =
//      'pending_delivery'.
//   5. inviteUserByEmail() — creates the Auth user + sends the REAL invite
//      email via SMTP. We record the ACTUAL outcome:
//        • success → delivery 'sent'  → 201 { ok:true, delivery:'sent' }
//        • failure → delivery 'failed' → 200 { ok:true, delivery:'failed', ...}
//          (school exists + invitation is visibly 'failed'; we NEVER say "sent")
//
// No password is generated/sent. No service-role key/token/raw error leaks.
// ============================================================
import { adminClient, corsHeaders, env, fail, getCaller, inviteRedirect, json, newCorrelationId } from "../_shared/cors.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Maps a raw internal error message to a small, safe category for logging
// and (via the regex checks already in the handler) for the client-facing
// code. Never logs the raw message itself — it can embed a slug/name, and a
// future error text could accidentally embed more. Log the CATEGORY only.
function safeDbErrorCategory(message: string): string {
  if (/already exists/i.test(message)) return "slug_taken";
  if (/only a super_admin/i.test(message)) return "forbidden";
  if (/institution_type|school_stage/i.test(message)) return "invalid_institution_type";
  if (/invalid/i.test(message)) return "invalid_input";
  return "unknown_db_error";
}

// Best-effort existing-account lookup via the Admin API (paginated). Returns
// the user id if an account with this email already exists, else null.
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  // One id per request — logged alongside safe categories below, echoed back
  // ONLY on failure responses. Never a token/email/secret; safe to show the
  // user and to grep server logs for.
  const correlationId = newCorrelationId();

  try {
    const { user, supa } = await getCaller(req);
    if (!user) return fail(req, 401, "unauthenticated", "Please sign in.", correlationId);

    const { data: prof } = await supa.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "super_admin") {
      return fail(req, 403, "forbidden", "Only a super admin may create a school.", correlationId);
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return fail(req, 400, "bad_request", "Invalid JSON body.", correlationId); }

    const name = String(body.name ?? "").trim();
    const slug = String(body.slug ?? "").trim().toLowerCase();
    const location = body.location == null ? null : String(body.location).trim();
    const email = String(body.admin_email ?? body.email ?? "").trim().toLowerCase();
    const adminName = String(body.admin_name ?? "").trim();
    const phone = body.admin_phone == null ? null : String(body.admin_phone).trim();
    const institutionType = String(body.institution_type ?? "").trim().toLowerCase();
    const schoolStageRaw = body.school_stage == null ? null : String(body.school_stage).trim().toLowerCase();
    const schoolStage = schoolStageRaw === "" ? null : schoolStageRaw;

    // Safe diagnostic log: institution_type + WHETHER school_stage is present
    // (never its actual value's context, never name/email/phone/slug).
    console.log(`[${correlationId}] create-school-and-invite-admin: institution_type=${institutionType || "(missing)"} school_stage=${schoolStage ? "present" : "null"}`);

    if (name.length < 2) return fail(req, 400, "invalid_name", "Enter a valid school name.", correlationId);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return fail(req, 400, "invalid_slug", "Slug may use lowercase letters, numbers and hyphens only.", correlationId);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(req, 400, "invalid_email", "Enter a valid admin email.", correlationId);

    // --- institution_type / school_stage (required — Nooca Hay'adda) ---
    if (institutionType !== "school" && institutionType !== "university") {
      return fail(req, 400, "invalid_institution_type", "Dooro Nooca Hay'adda: Dugsi ama Jaamacad.", correlationId);
    }
    if (institutionType === "school" && schoolStage !== "primary_middle" && schoolStage !== "secondary") {
      return fail(req, 400, "invalid_school_stage", "Dooro Heerka Dugsiga: Dugsi Hoose/Dhexe ama Dugsi Sare.", correlationId);
    }
    if (institutionType === "university" && schoolStage !== null) {
      return fail(req, 400, "invalid_school_stage", "Jaamacadu ma qaadan karto Heerka Dugsiga.", correlationId);
    }

    const admin = adminClient();

    // --- 3. existing-account guard (create nothing; do not touch the user) ---
    const existingId = await findUserByEmail(admin, email, correlationId);
    if (existingId) {
      return fail(req, 409, "existing_account_requires_manual_resolution",
        "This email already has a Kobciye account. Resolve it manually — no school was created and the existing account was not changed.", correlationId);
    }

    // --- 4. create school + subscription + invitation (audited, idempotent) ---
    const { data: created, error: rpcErr } = await supa.rpc("sa_create_school_and_invitation", {
      p_name: name, p_slug: slug, p_location: location,
      p_email: email, p_admin_name: adminName, p_phone: phone, p_expires_in_days: 14,
      p_institution_type: institutionType, p_school_stage: schoolStage,
    });
    if (rpcErr) {
      const category = safeDbErrorCategory(rpcErr.message);
      console.error(`[${correlationId}] sa_create_school_and_invitation failed:`, category);
      if (category === "slug_taken") return fail(req, 409, "slug_taken", "That school slug is already in use.", correlationId);
      if (category === "forbidden") return fail(req, 403, "forbidden", "Only a super admin may create a school.", correlationId);
      if (category === "invalid_institution_type") return fail(req, 400, "invalid_institution_type", "Please check Nooca Hay'adda / Heerka Dugsiga.", correlationId);
      if (category === "invalid_input") return fail(req, 400, "invalid_input", "Please check the school and admin details.", correlationId);
      return fail(req, 500, "create_failed", "Could not create the school. Please try again.", correlationId);
    }

    const schoolId = created.school_id as string;
    const invitationId = created.invitation_id as string;
    const idempotent = created.idempotent === true;

    // idempotent double-click: don't re-send; report the current state as-is
    if (idempotent) {
      return json(req, 200, {
        ok: true, idempotent: true, school_id: schoolId, invitation_id: invitationId,
        invitee_email: email, delivery: "pending_delivery",
        institution_type: created.institution_type, school_stage: created.school_stage,
        message: "This school + pending invitation already existed. Use Resend to try the email again.",
      });
    }

    // --- 5. send the REAL invite email; record the ACTUAL outcome ---
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: adminName },
      redirectTo: inviteRedirect(),
    });

    if (inviteErr || !invited?.user) {
      // email did NOT go out. Mark the invitation failed (visible to the super
      // admin) and report created-but-not-delivered — never "invite sent".
      // The RAW inviteErr.message is written to email_last_error in the DB
      // (a deliberate, existing, super_admin-visible dashboard field, already
      // truncated/sanitized server-side by sa_mark_invitation_delivery) — but
      // never to the server console log, which gets a safe category only.
      console.error(`[${correlationId}] inviteUserByEmail failed:`, "email_delivery_failed");
      await supa.rpc("sa_mark_invitation_delivery", {
        p_invitation_id: invitationId, p_status: "failed", p_error: inviteErr?.message ?? "email send failed",
      }).then(({ error }) => { if (error) console.error(`[${correlationId}] mark delivery failed:`, "unknown_db_error"); });
      return json(req, 200, {
        ok: true, idempotent: false, school_id: schoolId, invitation_id: invitationId,
        invitee_email: email, delivery: "failed",
        institution_type: created.institution_type, school_stage: created.school_stage,
        message: "School created, but the invitation email was not delivered. Fix email settings and resend.",
      });
    }

    // success: record the Auth user id + mark delivery sent
    const attach = await supa.rpc("sa_attach_invitation_auth_user", {
      p_invitation_id: invitationId, p_auth_user_id: invited.user.id,
    });
    if (attach.error) console.error(`[${correlationId}] sa_attach_invitation_auth_user:`, "unknown_db_error");
    const mark = await supa.rpc("sa_mark_invitation_delivery", {
      p_invitation_id: invitationId, p_status: "sent", p_error: null,
    });
    if (mark.error) console.error(`[${correlationId}] sa_mark_invitation_delivery:`, "unknown_db_error");

    return json(req, 201, {
      ok: true, idempotent: false, school_id: schoolId, invitation_id: invitationId,
      invitee_email: email, delivery: "sent",
      institution_type: created.institution_type, school_stage: created.school_stage,
    });
  } catch (e) {
    console.error(`[${correlationId}] create-school-and-invite-admin uncaught:`, (e as Error)?.name || "unknown_error");
    return fail(req, 500, "internal_error", "Something went wrong. Please try again.", correlationId);
  }
});
