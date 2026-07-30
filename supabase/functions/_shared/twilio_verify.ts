import { env } from "./cors.ts";

type TwilioPayload = Record<string, unknown>;

export class TwilioVerifyError extends Error {
  status: number;
  code: string | null;
  retryable: boolean;

  constructor(message: string, status: number, code: string | null, retryable: boolean) {
    super(message);
    this.name = "TwilioVerifyError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function requireSid(name: string, prefix: "AC" | "VA"): string {
  const value = env(name).trim();
  const pattern = prefix === "AC" ? /^AC[0-9a-fA-F]{32}$/ : /^VA[0-9a-fA-F]{32}$/;
  if (!pattern.test(value)) throw new Error(`invalid required secret: ${name}`);
  return value;
}

function credentials() {
  return {
    accountSid: requireSid("TWILIO_ACCOUNT_SID", "AC"),
    authToken: env("TWILIO_AUTH_TOKEN").trim(),
    serviceSid: requireSid("TWILIO_VERIFY_SERVICE_SID", "VA"),
  };
}

async function postTwilio(path: string, values: Record<string, string>): Promise<TwilioPayload> {
  const { accountSid, authToken } = credentials();
  if (!authToken) throw new Error("invalid required secret: TWILIO_AUTH_TOKEN");

  const response = await fetch(`https://verify.twilio.com/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(values).toString(),
  });

  const payload = await response.json().catch(() => ({})) as TwilioPayload;
  if (!response.ok) {
    const providerCode = typeof payload.code === "number" || typeof payload.code === "string"
      ? String(payload.code)
      : null;
    const retryable = response.status === 429 || response.status >= 500;
    throw new TwilioVerifyError("twilio_verify_request_failed", response.status, providerCode, retryable);
  }
  return payload;
}

export async function startTwilioWhatsAppVerification(phone: string): Promise<string> {
  const { serviceSid } = credentials();
  const payload = await postTwilio(`/Services/${serviceSid}/Verifications`, {
    To: phone,
    Channel: "whatsapp",
  });
  const sid = typeof payload.sid === "string" ? payload.sid : "";
  const status = typeof payload.status === "string" ? payload.status : "";
  if (!/^VE[0-9a-fA-F]{32}$/.test(sid) || !["pending", "approved"].includes(status)) {
    throw new TwilioVerifyError("twilio_verify_invalid_start_response", 502, null, true);
  }
  return sid;
}

export async function checkTwilioWhatsAppVerification(
  verificationSid: string,
  code: string,
): Promise<boolean> {
  if (!/^VE[0-9a-fA-F]{32}$/.test(verificationSid)) return false;
  const { serviceSid } = credentials();
  try {
    const payload = await postTwilio(`/Services/${serviceSid}/VerificationCheck`, {
      VerificationSid: verificationSid,
      Code: code,
    });
    return payload.status === "approved";
  } catch (error) {
    // Twilio returns 400/404 for invalid, expired, deleted, or exhausted
    // verifications. Treat those exactly like an incorrect code so the public
    // response remains generic and does not reveal account/provider state.
    if (error instanceof TwilioVerifyError && (error.status === 400 || error.status === 404)) {
      return false;
    }
    throw error;
  }
}
