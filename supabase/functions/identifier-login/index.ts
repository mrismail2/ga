// ============================================================
// Kobciye — Edge Function: identifier-login  (Phase 5)
//
// The server side of the Student and Parent landing-page login:
//   Student : School ID (login_code) + Student ID + password
//   Parent  : School ID (login_code) + Child Student ID + Parent password
//
// It NEVER exposes an internal UUID or email to the client, and there is NO
// service-role key in the client. Flow:
//   1. Rate-limit check (is_login_locked) — 5 failures / 15 min per identifier.
//   2. resolve_login_email() maps (school_code, student_id, kind) to the
//      internal auth email of the account to sign in (student's own, or the
//      is_primary parent for a child-id parent login). Returns NULL for any
//      miss — the function never says which field was wrong.
//   3. An ANON client inside the function does signInWithPassword(email,
//      password). GoTrue verifies the password and returns a real session.
//   4. record_login_attempt() audits success/failure (never the password).
//   5. On success the session tokens are returned; the client calls
//      supabase.auth.setSession(...) to hold a normal Supabase session (RLS,
//      refresh, Sign Out, password reset all work unchanged).
//
// Any failure returns the SAME generic 401 — no account enumeration.
//
// Secrets used: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (service role used ONLY here on the server for the resolve/rate-limit RPCs).
// ============================================================
import { adminClient, corsHeaders, env, fail, json, newCorrelationId } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GENERIC = "Aqoonsi ama furaha sirta ah waa qalad. Fadlan hubi School ID, Student ID iyo furaha.";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");

  const correlationId = newCorrelationId();
  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* validated below */ }

    const kind = String(body.kind || "").trim();          // 'student' | 'parent'
    const schoolCode = String(body.school_code || "").trim().toUpperCase();
    const studentId = String(body.student_id || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    const ip = clientIp(req);

    if (kind !== "student" && kind !== "parent") return fail(req, 400, "invalid_kind", GENERIC, correlationId);
    if (!schoolCode || !studentId || !password) return fail(req, 401, "invalid_credentials", GENERIC, correlationId);

    const admin = adminClient();

    // 1. rate-limit / temporary lockout
    const { data: locked } = await admin.rpc("is_login_locked", {
      p_school_code: schoolCode, p_identifier: studentId, p_kind: kind,
    });
    if (locked === true) {
      return fail(req, 429, "too_many_attempts", "Isku dayo badan. Fadlan sug daqiiqado kadibna isku day.", correlationId);
    }

    // 2. resolve the internal auth email (server-side only)
    const { data: email, error: resolveErr } = await admin.rpc("resolve_login_email", {
      p_school_code: schoolCode, p_student_id: studentId, p_kind: kind,
    });
    if (resolveErr || !email) {
      await admin.rpc("record_login_attempt", { p_school_code: schoolCode, p_identifier: studentId, p_kind: kind, p_success: false, p_ip: ip });
      return fail(req, 401, "invalid_credentials", GENERIC, correlationId);
    }

    // 3. verify the password by signing in with an anon client (GoTrue mints a real session)
    const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email: String(email), password });

    if (signErr || !signIn?.session) {
      await admin.rpc("record_login_attempt", { p_school_code: schoolCode, p_identifier: studentId, p_kind: kind, p_success: false, p_ip: ip });
      return fail(req, 401, "invalid_credentials", GENERIC, correlationId);
    }

    // 4. success — audit, then return the session tokens for setSession()
    await admin.rpc("record_login_attempt", { p_school_code: schoolCode, p_identifier: studentId, p_kind: kind, p_success: true, p_ip: ip });

    // whether this account must change its password on first login (provisioned temp)
    let mustChange = false;
    try {
      const { data: prof } = await admin.from("profiles").select("must_change_password").eq("id", signIn.session.user.id).maybeSingle();
      mustChange = !!prof?.must_change_password;
    } catch { /* non-fatal */ }

    return json(req, 200, {
      ok: true,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      must_change_password: mustChange,
    });
  } catch (_e) {
    console.error(`[${correlationId}] identifier-login:`, "unhandled");
    return fail(req, 500, "server_error", "Wax qalad ah ayaa dhacay. Fadlan isku day mar kale.", correlationId);
  }
});
