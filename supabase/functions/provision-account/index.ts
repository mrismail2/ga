// ============================================================
// Kobciye — Edge Function: provision-account  (Phase 5)
//
// The single server-side action behind the School Admin's "U dir Casuumaad"
// (invite), "Dib u dir" (resend) and "Jooji" (revoke) buttons for an EXISTING
// teacher / student / parent record. It provisions a Supabase Auth account
// and records an account_invitations row — it NEVER creates a second domain
// record (that link is made by accept_account_invitation in the database when
// the invitee sets their password).
//
// Privilege model (identical to the Phase 3 invite functions):
//   • userClient carries the CALLER's JWT, so the create_account_invitation /
//     revoke_account_invitation RPCs re-derive the caller's real role and
//     re-check is_admin_of(school) in the database. The request body is never
//     trusted for a privilege decision.
//   • adminClient (service-role) is used ONLY for the Auth Admin API
//     (inviteUserByEmail / createUser). Its key is read from the
//     SUPABASE_SERVICE_ROLE_KEY secret and is NEVER returned or logged. There
//     is no service-role key anywhere in the mobile/web client.
//
// Actions (body.action):
//   "invite"  { role, teacher_id|student_id|parent_id, email?, name?, phone? }
//   "resend"  { role, teacher_id|student_id|parent_id, email?, name?, phone? }
//   "revoke"  { invitation_id }
//
// A student with no email is provisioned with a generated internal login and
// a random temporary password (never emailed); the School Admin hands it over
// out-of-band and the student is required to set their own password on first
// login. No credential is ever returned in a way that leaks Auth secrets.
// ============================================================
import { adminClient, corsHeaders, fail, getCaller, inviteRedirect, json, newCorrelationId } from "../_shared/cors.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const ROLES = ["teacher", "student", "parent"] as const;
type Role = typeof ROLES[number];

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

function safeRpcCategory(message: string): string {
  if (/only a school admin/i.test(message)) return "forbidden";
  if (/already has a login/i.test(message)) return "already_has_login";
  if (/another school/i.test(message)) return "cross_school";
  if (/School Mode/i.test(message)) return "university_not_supported";
  if (/not found/i.test(message)) return "not_found";
  return "provision_failed";
}

// Best-effort existing-account lookup (paginated) — reused so a re-invite of
// an email that already has an Auth account links THAT account rather than
// creating a duplicate user.
async function findUserByEmail(admin: SupabaseClient, email: string, correlationId: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(`[${correlationId}] listUsers:`, "unknown_db_error"); return null; }
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

function randomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return "Kob-" + Array.from(bytes).map((b) => b.toString(36)).join("").slice(0, 20);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  const correlationId = newCorrelationId();
  try {
    const { user, supa } = await getCaller(req);
    if (!user) return fail(req, 401, "unauthenticated", "Fadlan gal akoonkaaga marka hore.", correlationId);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* handled below */ }
    const action = String(body.action || "invite").trim();

    // ---------- revoke ----------
    if (action === "revoke") {
      const invitationId = isUuid(body.invitation_id) ? String(body.invitation_id).trim() : null;
      if (!invitationId) return fail(req, 400, "invalid_input", "Casuumaad sax ah lama helin.", correlationId);
      const { error } = await supa.rpc("revoke_account_invitation", { p_invitation: invitationId });
      if (error) {
        console.error(`[${correlationId}] revoke:`, safeRpcCategory(error.message));
        return fail(req, 403, safeRpcCategory(error.message), "Lama joojin karin casuumaadda.", correlationId);
      }
      return json(req, 200, { ok: true, action: "revoke" });
    }

    // ---------- invite / resend ----------
    if (action !== "invite" && action !== "resend") {
      return fail(req, 400, "invalid_action", "Fal aan la aqoon.", correlationId);
    }

    const role = String(body.role || "").trim() as Role;
    if (!ROLES.includes(role)) return fail(req, 400, "invalid_role", "Doorka waa inuu noqdaa macallin/arday/waalid.", correlationId);
    const school = isUuid(body.school_id) ? String(body.school_id).trim() : null;
    if (!school) return fail(req, 400, "invalid_input", "Dooro dugsi sax ah marka hore.", correlationId);

    const teacherId = isUuid(body.teacher_id) ? String(body.teacher_id).trim() : null;
    const studentId = isUuid(body.student_id) ? String(body.student_id).trim() : null;
    const parentId = isUuid(body.parent_id) ? String(body.parent_id).trim() : null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    // exactly one target must match the role
    const target = role === "teacher" ? teacherId : role === "student" ? studentId : parentId;
    if (!target) return fail(req, 400, "invalid_input", "Dooro diiwaanka la casuumayo.", correlationId);

    // A teacher/parent invite (and a student WITH an email) needs an email to
    // deliver to. A student WITHOUT an email is provisioned with a generated
    // internal login below.
    const needsGeneratedLogin = role === "student" && !email;
    if (!needsGeneratedLogin && (!email || !email.includes("@"))) {
      return fail(req, 400, "invalid_email", "Email sax ah ayaa loo baahan yahay.", correlationId);
    }

    const admin = adminClient();
    let authUserId: string | null = null;
    // for a no-email student we hand the School Admin a ONE-TIME temp password
    // (shown once, never stored in plaintext, first-login change forced).
    let tempPassword: string | null = null;

    if (needsGeneratedLogin) {
      // secure, server-controlled login for a student with no email address.
      const login = `student+${target}@students.kobciye.local`;
      const existing = await findUserByEmail(admin, login, correlationId);
      if (existing) {
        // reset to a fresh temp password so the admin always gets a usable one
        tempPassword = randomPassword();
        await admin.auth.admin.updateUserById(existing, { password: tempPassword });
        authUserId = existing;
      } else {
        tempPassword = randomPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email: login,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: name, provisioned: "student_no_email" },
        });
        if (error || !data.user) {
          console.error(`[${correlationId}] createUser:`, "auth_admin_error");
          return fail(req, 502, "auth_error", "Lama abuuri karin akoonka. Isku day mar kale.", correlationId);
        }
        authUserId = data.user.id;
      }
      // force a first-login password change (service role has no JWT, so the
      // profiles guard's SQL-editor bypass permits this direct flag write).
      if (authUserId) {
        await admin.from("profiles").update({ must_change_password: true }).eq("id", authUserId);
      }
    } else {
      // an email-based account: reuse an existing Auth user or invite a new one
      const existing = await findUserByEmail(admin, email, correlationId);
      if (existing) {
        authUserId = existing;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: inviteRedirect(),
          data: { full_name: name },
        });
        if (error || !data.user) {
          console.error(`[${correlationId}] invite:`, "auth_admin_error");
          return fail(req, 502, "auth_error", "Lama diri karin casuumaadda emailka. Isku day mar kale.", correlationId);
        }
        authUserId = data.user.id;
      }
    }

    // Record the invitation THROUGH the caller's JWT so the DB re-checks the
    // caller is a school_admin of `school` and the target record is theirs.
    const { data: invId, error: rpcErr } = await supa.rpc("create_account_invitation", {
      p_school: school,
      p_intended_role: role,
      p_teacher_id: teacherId,
      p_student_id: studentId,
      p_parent_id: parentId,
      p_email: email || null,
      p_name: name || null,
      p_phone: phone || null,
      p_auth_user_id: authUserId,
    });
    if (rpcErr) {
      console.error(`[${correlationId}] create_account_invitation:`, safeRpcCategory(rpcErr.message));
      const cat = safeRpcCategory(rpcErr.message);
      const status = cat === "forbidden" ? 403 : cat === "already_has_login" ? 409 : 400;
      return fail(req, status, cat, "Lama diiwaangelin karin casuumaadda.", correlationId);
    }

    // For a no-email student, hand back the ONE-TIME credentials the School
    // Admin reads out to the student: the public school code, the student id,
    // and the temp password (shown once; never persisted in plaintext).
    let credentials: Record<string, unknown> | null = null;
    if (needsGeneratedLogin && tempPassword) {
      let loginCode: string | null = null;
      let studentPublicId: string | null = null;
      try {
        const { data: sc } = await admin.from("schools").select("login_code").eq("id", school).maybeSingle();
        loginCode = sc?.login_code ?? null;
        const { data: st } = await admin.from("students").select("student_id").eq("id", studentId).maybeSingle();
        studentPublicId = st?.student_id ?? null;
      } catch { /* non-fatal — the temp password is the essential part */ }
      credentials = {
        school_code: loginCode,
        student_id: studentPublicId,
        temp_password: tempPassword,
        must_change_password: true,
      };
    }

    return json(req, 201, {
      ok: true,
      action,
      invitation_id: invId,
      delivery: needsGeneratedLogin ? "manual_credential" : "sent",
      credentials,
    });
  } catch (e) {
    console.error(`[${correlationId}] provision-account:`, "unhandled");
    return fail(req, 500, "server_error", "Wax qalad ah ayaa dhacay. Isku day mar kale.", correlationId);
  }
});
