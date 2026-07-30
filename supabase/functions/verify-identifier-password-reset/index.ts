// Verifies a one-time Twilio Verify WhatsApp code and changes the EXISTING
// Student/Parent Auth password. Normal identifier+password login is unchanged.
import { adminClient, corsHeaders, fail, json, newCorrelationId } from "../_shared/cors.ts";
import {
  checkTwilioWhatsAppVerification,
  TwilioVerifyError,
} from "../_shared/twilio_verify.ts";

const GENERIC = "Koodhku ma saxna ama wuu dhacay. Fadlan isku day mar kale.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");
  const correlationId = newCorrelationId();

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* validated below */ }
    const challengeId = String(body.challenge_id || "").trim();
    const code = String(body.code || "").trim();
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";
    if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !/^\d{6}$/.test(code)) {
      return fail(req, 400, "invalid_code", GENERIC, correlationId);
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return fail(
        req,
        400,
        "weak_password",
        "Furaha cusub waa inuu leeyahay ugu yaraan 8 xaraf, xaraf iyo lambar.",
        correlationId,
      );
    }

    const admin = adminClient();
    const { data: challenge, error } = await admin.from("password_reset_otp_challenges")
      .select("id, provider_message_id, expires_at, consumed_at, failed_attempts")
      .eq("id", challengeId)
      .maybeSingle();
    if (
      error || !challenge || challenge.consumed_at ||
      new Date(challenge.expires_at).getTime() <= Date.now() ||
      challenge.failed_attempts >= 5 ||
      !/^VE[0-9a-fA-F]{32}$/.test(challenge.provider_message_id || "")
    ) {
      return fail(req, 400, "invalid_code", GENERIC, correlationId);
    }

    let approved = false;
    try {
      approved = await checkTwilioWhatsAppVerification(challenge.provider_message_id, code);
    } catch (providerError) {
      console.error(`[${correlationId}] twilio-verification-check: provider_failed`);
      if (providerError instanceof TwilioVerifyError && !providerError.retryable) {
        return fail(req, 503, "verification_provider_unavailable", "Koodhka lama hubin karo hadda. Isku day mar kale.", correlationId);
      }
      return fail(req, 503, "verification_provider_unavailable", "Koodhka lama hubin karo hadda. Isku day mar kale.", correlationId);
    }

    if (!approved) {
      await admin.rpc("record_password_reset_otp_failure", { p_challenge: challengeId });
      return fail(req, 400, "invalid_code", GENERIC, correlationId);
    }

    // Atomic one-time claim closes the concurrent/replay window after Twilio
    // has approved the code.
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_password_reset_otp_challenge",
      { p_challenge: challengeId },
    );
    if (claimError || !claimed || !claimed.target_profile_id) {
      return fail(req, 400, "invalid_code", GENERIC, correlationId);
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(
      claimed.target_profile_id,
      { password: newPassword },
    );
    if (passwordError) {
      await admin.from("audit_logs").insert({
        school_id: claimed.school_id,
        actor_id: null,
        action: `auth.${claimed.kind}.whatsapp_password_reset_failed`,
        entity: claimed.kind === "student" ? "students" : "parents",
        entity_id: claimed.kind === "student" ? claimed.student_id : claimed.parent_id,
        detail: { challenge_id: challengeId, correlation_id: correlationId, provider: "twilio_verify" },
      });
      return fail(
        req,
        503,
        "password_update_failed",
        "Furaha lama beddeli karo hadda. Codso koodh cusub oo isku day mar kale.",
        correlationId,
      );
    }

    await admin.from("profiles")
      .update({ must_change_password: false })
      .eq("id", claimed.target_profile_id);
    await admin.from("audit_logs").insert({
      school_id: claimed.school_id,
      actor_id: claimed.target_profile_id,
      action: `auth.${claimed.kind}.whatsapp_password_reset`,
      entity: claimed.kind === "student" ? "students" : "parents",
      entity_id: claimed.kind === "student" ? claimed.student_id : claimed.parent_id,
      detail: { challenge_id: challengeId, provider: "twilio_verify" },
    });

    return json(req, 200, {
      ok: true,
      message: "Furaha sirta waa la beddelay. Hadda ku gal furaha cusub.",
    });
  } catch (_error) {
    console.error(`[${correlationId}] verify-identifier-password-reset: unhandled`);
    return fail(
      req,
      500,
      "server_error",
      "Wax qalad ah ayaa dhacay. Fadlan isku day mar kale.",
      correlationId,
    );
  }
});
