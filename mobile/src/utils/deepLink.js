/* ============================================================
   Kobciye — invite / recovery deep-link parsing (Phase 3)

   Supabase invite, recovery and magic-link emails redirect to a URL that can
   carry the session either as hash tokens (implicit flow):

     kobciye://set-password#access_token=...&refresh_token=...&type=invite
     https://app.example.com/set-password#access_token=...&type=recovery

   or as a PKCE authorization code (query string):

     https://app.example.com/set-password?code=...

   or as a token_hash (query string — some Supabase email-template
   configurations use `{{ .TokenHash }}` directly rather than routing through
   Supabase's own hosted `/verify` redirect, which is often necessary for a
   native app's custom URL scheme since that hosted redirect can only target
   an https:// site, not `kobciye://`):

     https://app.example.com/set-password?token_hash=...&type=invite
     kobciye://set-password?token_hash=...&type=recovery

   We NEVER rely on supabase-js's own auto URL-detection (detectSessionInUrl is
   off — see services/supabase.js) because that races against an already
   -persisted session and silently loses for PKCE links. Instead this module
   parses the URL ourselves and AuthContext explicitly exchanges whatever it
   finds (setSession for hash tokens, exchangeCodeForSession for a PKCE code)
   BEFORE any old session is allowed to route to a dashboard.

   IMPORTANT: tokens/codes are extracted only to establish the session — they
   are never rendered in the UI or logged.
   ============================================================ */

function parseParams(str) {
  const out = {};
  if (!str) return out;
  for (const pair of str.split('&')) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    if (!k) continue;
    try { out[decodeURIComponent(k)] = v == null ? '' : decodeURIComponent(v); }
    catch (e) { /* malformed component — ignore that pair, not the whole URL */ }
  }
  return out;
}

/* True when the URL's path (or, for custom schemes where a clean pathname
   isn't reliably parseable, the raw string) names one of our password-setup
   destinations. This is the STRONGEST signal because we control the redirect
   target ourselves (see AuthContext's REDIRECT) — it holds regardless of
   which token flow (implicit hash / PKCE code) Supabase actually used. */
function hasSetupPathname(rawUrl) {
  const withoutHash = rawUrl.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  return /set-password|reset-password/i.test(withoutQuery) || /set-password|reset-password/i.test(rawUrl);
}

/* Parse an auth callback URL into a normalized descriptor:
   {
     kind: 'error' | 'code' | 'session' | 'token_hash' | 'none',
     message,              // kind === 'error'
     code,                 // kind === 'code'       (PKCE)
     tokenHash,             // kind === 'token_hash' (Supabase {{ .TokenHash }})
     accessToken, refreshToken, // kind === 'session' (implicit hash tokens)
     type,                 // 'invite' | 'recovery' | 'signup' | 'magiclink' | undefined
     pathnameHasSetupIntent, // true if the path itself names set/reset-password
   }
   Returns null only when the string isn't a URL at all. */
export function parseAuthUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const hashIndex = rawUrl.indexOf('#');
  const beforeHash = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
  const hashStr = hashIndex >= 0 ? rawUrl.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const queryStr = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';

  // hash params take priority when both are present (implicit-flow links put
  // everything after '#'; PKCE/token_hash links put their param in the query)
  const params = { ...parseParams(queryStr), ...parseParams(hashStr) };
  const pathnameHasSetupIntent = hasSetupPathname(rawUrl);

  if (params.error || params.error_description || params.error_code) {
    // error_code (e.g. otp_expired) is Supabase's structured reason — kept so
    // the caller can distinguish an EXPIRED link (common when an email
    // scanner pre-fetched and consumed the one-time token) from a malformed
    // one, instead of collapsing everything into "invalid".
    return {
      kind: 'error',
      message: params.error_description || params.error,
      errorCode: params.error_code || undefined,
      pathnameHasSetupIntent,
    };
  }
  if (params.token_hash) {
    return { kind: 'token_hash', tokenHash: params.token_hash, type: params.type, pathnameHasSetupIntent };
  }
  if (params.code) {
    return { kind: 'code', code: params.code, type: params.type, pathnameHasSetupIntent };
  }
  if (params.access_token) {
    return {
      kind: 'session',
      accessToken: params.access_token,
      refreshToken: params.refresh_token || '',
      type: params.type || undefined,
      pathnameHasSetupIntent,
    };
  }
  if (pathnameHasSetupIntent) {
    return { kind: 'none', pathnameHasSetupIntent: true };
  }
  return null;
}

/* True when a Supabase `type` value is the kind that should open the
   set-password screen (as opposed to a plain magic-link sign-in). */
export function isPasswordSetupType(type) {
  return type === 'invite' || type === 'recovery' || type === 'signup';
}

/* True when ANY signal in a parsed URL indicates a password-setup callback —
   the OR of every check the product spec calls for: a pathname that names
   set/reset-password, an explicit type=recovery|invite, a hash access_token,
   or a PKCE code. Used to decide, before touching any existing session,
   whether this app open must be routed to SetPasswordScreen. */
export function isPasswordSetupUrl(parsed) {
  if (!parsed) return false;
  if (parsed.pathnameHasSetupIntent) return true;
  if (parsed.type && isPasswordSetupType(parsed.type)) return true;
  if (parsed.kind === 'session' && parsed.accessToken) return true;
  if (parsed.kind === 'code' && parsed.code) return true;
  if (parsed.kind === 'token_hash' && parsed.tokenHash) return true;
  if (parsed.kind === 'error') return true; // an error on our own reset link is still our concern
  return false;
}
