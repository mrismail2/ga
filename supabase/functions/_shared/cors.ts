// ============================================================
// Kobciye — shared CORS + helpers for Edge Functions
//
// One place for the allow-list, the JSON/error shapes, and the two Supabase
// clients every sensitive function needs:
//   • userClient  — carries the CALLER's JWT, so RLS + the SECURITY DEFINER
//                   RPCs re-derive the caller's real role/identity from the
//                   database. This is what makes "never trust request-body
//                   metadata for privilege decisions" true.
//   • adminClient — service-role, used ONLY for the Supabase Auth Admin API
//                   (creating/inviting users, sending the invite/recovery
//                   email through the project's configured SMTP). Its key is
//                   read from the SUPABASE_SERVICE_ROLE_KEY secret and is NEVER
//                   returned to the client or logged.
// ============================================================
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Allowed browser origins for the Expo web build + local dev. Override in
// production by setting the KOBCIYE_ALLOWED_ORIGINS secret (comma-separated).
const DEFAULT_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "https://localhost:8081",
];

function allowedOrigins(): string[] {
  const fromEnv = (Deno.env.get("KOBCIYE_ALLOWED_ORIGINS") || "").trim();
  if (!fromEnv) return DEFAULT_ORIGINS;
  return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const list = allowedOrigins();
  // Native apps send no Origin; browsers must be on the allow-list. We echo an
  // allowed origin (or the first configured one) rather than a blanket "*",
  // because these endpoints act on the caller's credentials.
  const allow = list.includes(origin) ? origin : (origin ? "null" : list[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(
  req: Request,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// A safe, structured error. `code` is a stable machine string the app maps to
// a screen ("expired", "cancelled", "already_accepted", …). `message` is a
// short, non-sensitive sentence. Internal error details are logged
// server-side (console.error) but never sent to the client. `correlationId`
// (optional, backward compatible — existing callers are unaffected) is
// included in the response ONLY on failure, so a user can quote it and an
// operator can grep server logs for the exact same id — never any token,
// email, or raw error detail.
export function fail(
  req: Request,
  status: number,
  code: string,
  message: string,
  correlationId?: string,
): Response {
  const error: Record<string, unknown> = { code, message };
  if (correlationId) error.correlation_id = correlationId;
  return json(req, status, { ok: false, error });
}

// A short, non-sensitive id for THIS request, logged alongside safe
// categories server-side and echoed back only in error responses — lets an
// operator match a user-reported failure to the exact log lines without
// exposing anything sensitive in either direction.
export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing required secret: ${name}`);
  return v;
}

// The caller-scoped client (RLS + RPC role checks apply to THIS identity).
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") || "";
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// The service-role client — ONLY for the Auth Admin API / sending mail. Never
// expose its key or return raw results from it.
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verify the JWT and return the authenticated user, or null.
export async function getCaller(req: Request) {
  const supa = userClient(req);
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return { user: null, supa };
  return { user: data.user, supa };
}

// The redirect the invite / recovery email links back to. Set via secret so it
// can point at the deployed web app or the mobile deep link.
export function inviteRedirect(): string {
  return Deno.env.get("KOBCIYE_INVITE_REDIRECT_URL") ||
    "http://localhost:8081/set-password";
}
