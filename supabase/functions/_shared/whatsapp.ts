import { env } from "./cors.ts";

// Shared phone normalization + keyed hashing used by identifier login and
// password recovery. WhatsApp delivery itself is handled by Twilio Verify in
// _shared/twilio_verify.ts; no Meta token/template credentials are used here.
export function normalizePhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  let normalized: string;
  if (digits.startsWith("252")) normalized = `+${digits}`;
  else if (digits.startsWith("0")) normalized = `+252${digits.slice(1)}`;
  else if (digits.length >= 8 && digits.length <= 9) normalized = `+252${digits}`;
  else normalized = `+${digits}`;
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : null;
}

export function maskedPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}` : "****";
}

export async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("OTP_HASH_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
