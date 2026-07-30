// Public Forgot Password request for Student/Parent identifier accounts.
// Student identity: full name + School ID + active class + linked guardian mobile.
// Parent identity: School ID + Parent mobile.
// Twilio Verify creates and delivers the WhatsApp OTP; Kobciye stores only a
// keyed request hash and Twilio's non-secret Verification SID.
import { adminClient, corsHeaders, fail, json, newCorrelationId } from "../_shared/cors.ts";
import { hmacHex, normalizePhone } from "../_shared/whatsapp.ts";
import { startTwilioWhatsAppVerification } from "../_shared/twilio_verify.ts";

const GENERIC = "Haddii xogtu sax tahay, koodh ayaa loo diray WhatsApp-ka ku xiran akoonka.";

function otpSeconds(): number {
  const configured = Number(Deno.env.get("PASSWORD_RESET_OTP_MINUTES") || "5");
  const minutes = Number.isFinite(configured) ? Math.min(10, Math.max(3, Math.floor(configured))) : 5;
  return minutes * 60;
}

function ipOf(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return fail(req, 405, "method_not_allowed", "Use POST.");
  const correlationId = newCorrelationId();
  const ttlSeconds = otpSeconds();

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* validated below */ }
    const kind = String(body.kind || "").trim();
    const schoolCode = String(body.school_code || "").trim().toUpperCase();
    const fullName = String(body.full_name || "").trim();
    const className = String(body.class_name || "").trim();
    const parentPhone = normalizePhone(body.parent_phone);
    const ipHash = await hmacHex(`ip:${ipOf(req)}`);
    const requestKeyHash = await hmacHex(
      `request:${kind}:${schoolCode}:${fullName}:${className}:${parentPhone || ""}`,
    );

    if (kind !== "student" && kind !== "parent") {
      return json(req, 200, {
        ok: true,
        message: GENERIC,
        challenge_id: crypto.randomUUID(),
        expires_in: ttlSeconds,
      });
    }

    const admin = adminClient();
    const nowIso = new Date().toISOString();

    let target: Record<string, unknown> | null = null;
    if (kind === "student" && schoolCode && fullName && className && parentPhone) {
      const { data } = await admin.rpc("resolve_student_password_reset_target", {
        p_school_code: schoolCode,
        p_full_name: fullName,
        p_class_name: className,
        p_parent_phone: parentPhone,
      });
      target = data || null;
    } else if (kind === "parent" && schoolCode && parentPhone) {
      const { data } = await admin.rpc("resolve_parent_password_reset_target", {
        p_school_code: schoolCode,
        p_parent_phone: parentPhone,
      });
      target = data || null;
    }

    const challengeId = crypto.randomUUID();
    // The schema keeps the existing otp_hash column. Twilio owns the actual
    // OTP, so this is a non-reversible provider marker rather than an OTP hash.
    const providerProofHash = await hmacHex(`${challengeId}:twilio-verify-managed`);
    const phone = target && typeof target.phone === "string" ? target.phone : null;
    const phoneHash = phone ? await hmacHex(`phone:${phone}`) : null;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { data: inserted, error: insertErr } = await admin.rpc(
      "create_password_reset_otp_challenge",
      {
        p_id: challengeId,
        p_kind: kind,
        p_school: target?.school_id || null,
        p_target_profile: target?.profile_id || null,
        p_student: target?.student_id || null,
        p_parent: target?.parent_id || null,
        p_phone_hash: phoneHash,
        p_request_key_hash: requestKeyHash,
        p_otp_hash: providerProofHash,
        p_expires_at: expiresAt,
        p_request_ip_hash: ipHash,
      },
    );
    if (insertErr) {
      console.error(`[${correlationId}] password-reset-challenge: insert_failed`);
      return fail(
        req,
        503,
        "service_unavailable",
        "Adeegga dib-u-dejintu hadda ma shaqaynayo. Isku day mar kale.",
        correlationId,
      );
    }
    if (!inserted) {
      return fail(
        req,
        429,
        "too_many_attempts",
        "Codsiyo badan ayaa dhacay. Fadlan sug oo mar kale isku day.",
        correlationId,
      );
    }

    if (phone && target?.profile_id) {
      try {
        const verificationSid = await startTwilioWhatsAppVerification(phone);
        const { error: updateError } = await admin.from("password_reset_otp_challenges")
          .update({ provider_message_id: verificationSid })
          .eq("id", challengeId);
        if (updateError) throw new Error("challenge_provider_sid_update_failed");

        await admin.from("audit_logs").insert({
          school_id: target?.school_id || null,
          actor_id: null,
          action: `auth.${kind}.whatsapp_password_reset_requested`,
          entity: kind === "student" ? "students" : "parents",
          entity_id: kind === "student" ? target?.student_id : target?.parent_id,
          detail: { correlation_id: correlationId, provider: "twilio_verify" },
        });
      } catch (_error) {
        await admin.from("password_reset_otp_challenges")
          .update({ consumed_at: nowIso })
          .eq("id", challengeId);
        await admin.from("audit_logs").insert({
          school_id: target?.school_id || null,
          actor_id: null,
          action: "auth.password_reset.whatsapp_delivery_failed",
          entity: kind === "student" ? "students" : "parents",
          entity_id: kind === "student" ? target?.student_id : target?.parent_id,
          detail: { correlation_id: correlationId, provider: "twilio_verify" },
        });
        console.error(`[${correlationId}] password-reset-whatsapp: delivery_failed`);
        // Keep the public response identical to an unknown account.
      }
    }

    return json(req, 200, {
      ok: true,
      message: GENERIC,
      challenge_id: challengeId,
      expires_in: ttlSeconds,
    });
  } catch (_error) {
    console.error(`[${correlationId}] request-identifier-password-reset: unhandled`);
    return fail(
      req,
      500,
      "server_error",
      "Wax qalad ah ayaa dhacay. Fadlan isku day mar kale.",
      correlationId,
    );
  }
});
