/* ============================================================
   Kobciye — AuthContext (Phase 3: real Supabase authentication)

   The single owner of real Supabase authentication state. It:
     • restores the persisted session on app open (loading state)
     • listens to Supabase auth-state changes (sign in/out/refresh)
     • loads the user's DB profile (role + school) after sign in
     • exposes role-based routing info from the DATABASE profile role
       (never a frontend role picker)
     • handles invite/recovery/reset callback URLs → set-password flow
     • enables Live Supabase mode only for a real signed-in session

   Password-setup routing (critical invariant): a password-reset or invite
   callback URL is detected and handled BEFORE any existing persisted session
   is ever consulted. detectSessionInUrl is OFF on the Supabase client (see
   services/supabase.js) precisely so nothing races this check — we parse the
   callback URL ourselves (src/utils/deepLink.js), explicitly exchange it for a
   session (hash tokens via setSession, or a PKCE `?code=` via
   exchangeCodeForSession), and set flow='set_password' before status can ever
   become 'signed_in' in a way that would let App.js render a dashboard. An
   already-signed-in super_admin who clicks their own reset link is routed to
   SetPasswordScreen, never the dashboard — the callback always wins.

   The remaining subtlety: exchangeCodeForSession/setSessionFromTokens are
   awaited network calls, and the SEPARATE onAuthStateChange listener effect
   can fire independently WHILE that await is pending (e.g. reflecting an
   already-persisted session Supabase's own client reports on its own).
   setupInProgressRef closes that gap: it is set to true synchronously, before
   any await, the instant a URL is recognised as a password-setup callback
   (and it starts true from mount, covering the native cold-start gap too) —
   while true, the listener may update session bookkeeping but must never flip
   `status` to a dashboard-renderable value. See handleAuthCallback below.

   Demo Mode has been retired. No signed-out or authenticated runtime path can
   enter a local prototype dashboard; every dashboard session is backed by a
   real Supabase user and database profile.
   ============================================================ */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import {
  supabase, isSupabaseConfigured, onAuthStateChange, restoreSession, getMyProfile,
  signInWithEmail, signInWithIdentifier, signOut as sbSignOut, requestPasswordResetSecure,
  requestIdentifierPasswordReset as requestIdentifierPasswordResetSecure,
  verifyIdentifierPasswordReset as verifyIdentifierPasswordResetSecure,
  updatePassword as sbUpdatePassword, setSessionFromTokens, exchangeCodeForSession,
  verifyTokenHash, acceptSchoolInvite, acceptAccountInvite, clearMustChangePassword,
} from '../services/supabase';
import { setLiveSupabaseMode } from '../services/liveMode';
import { roleKeyForDbRole } from '../data/roleMap';
import { parseAuthUrl, isPasswordSetupUrl } from '../utils/deepLink';

// Documented Supabase auth error codes (@supabase/auth-js error-codes.ts)
// that mean "this specific link/code/token_hash was genuinely used up or has
// expired" — as opposed to a temporary/network/unknown failure. Checked
// first via the structured `.code` (reliable); the message-text regex below
// is only a defensive fallback for older SDK versions that lack it.
const EXPIRED_OR_USED_AUTH_CODES = [
  'otp_expired', 'flow_state_expired', 'flow_state_not_found',
  'bad_code_verifier', 'invite_not_found', 'session_expired',
];

// Distinguishes a GENUINELY bad invite/recovery link (expired, already used,
// malformed) from a TEMPORARY failure (network hiccup, momentary server
// issue) — only the former should ever show the harsh "invalid link" screen;
// the latter must let the user try again without implying their invite is
// dead. Never logs the raw error — see logCallbackDiag below for that.
function classifyCallbackError(e) {
  if (isAuthRetryableFetchError(e)) return 'temporary';
  const code = e && e.code;
  const message = ((e && e.message) || '').toLowerCase();
  // A PKCE ?code= link needs the code_verifier supabase-js stored when THIS
  // browser/device initiated the request. When the link is opened anywhere
  // else (other browser, other device, email app's built-in webview) the
  // verifier doesn't exist and supabase-js fails with a "code verifier"
  // error. The link itself may be perfectly valid — this must NOT be shown
  // as "Casuumaad aan sax ahayn"; tell the user to open it where they asked
  // for it (or request a fresh link) instead.
  if (code === 'validation_failed' && /code verifier|pkce/.test(message)) return 'wrong_browser';
  if (/code verifier|both auth code and code verifier/.test(message)) return 'wrong_browser';
  if (code && EXPIRED_OR_USED_AUTH_CODES.includes(code)) return 'expired';
  if (/expired|already\s*(used|confirmed|accepted)/.test(message)) return 'expired';
  return 'invalid';
}

// Supabase error_code values (?error_code=... / #error_code=...) that mean
// the link was consumed or timed out — commonly because a mail provider's
// link scanner pre-fetched the one-time URL. Shown as "expired, ask for a
// new one" (a recoverable, honest state) rather than the dead-end "invalid".
const EXPIRED_URL_ERROR_CODES = ['otp_expired', 'access_denied_expired', 'session_expired'];

function classifyUrlError(parsed) {
  const errorCode = (parsed && parsed.errorCode) || '';
  const message = ((parsed && parsed.message) || '').toLowerCase();
  if (EXPIRED_URL_ERROR_CODES.includes(errorCode)) return 'expired';
  if (/expired|invalid or has expired|already\s*(used|confirmed|accepted)/.test(message)) return 'expired';
  return 'invalid';
}

// Safe internal diagnostics only: a category name + a random per-attempt
// reference id — NEVER the raw error, message, token, code, email, or any
// other sensitive detail. Local console only (no remote log sink exists in
// this client-only app), matched by the operator asking "what does ref=...
// mean" against this fixed category list, not by reading free-text.
function logCallbackDiag(category) {
  const refId = 'cb-' + Math.random().toString(36).slice(2, 10);
  console.error(`[auth-callback:${category}] ref=${refId}`);
  return refId;
}

// status:    'initializing' | 'signed_out' | 'signed_in'
// flow:      null | 'set_password'   (invite/recovery/reset — set a password first)
// flowError: null | 'invalid'        (the callback URL itself was bad — show
//                                      the invalid-link state immediately,
//                                      before any password is even entered)
const AuthContext = createContext({
  status: 'initializing', flow: null, flowType: 'invite', flowError: null, mode: 'live',
  session: null, profile: null, roleKey: null, schoolName: null,
  profileStatus: 'idle', profileError: null,
  configured: false, error: null,
  signIn: async () => {}, signOut: async () => {}, requestPasswordReset: async () => {},
  requestIdentifierPasswordReset: async () => {}, verifyIdentifierPasswordReset: async () => {},
  setNewPassword: async () => {}, acceptInvite: async () => {},
  refreshProfile: async () => {},
});

// (The recovery-email redirect URL is now decided SERVER-side by the
// request-password-reset Edge Function — KOBCIYE_INVITE_REDIRECT_URL — so the
// client no longer builds one.)

// Strip a processed auth callback (code/token/type/error) out of the visible
// browser URL. Web only — native deep links aren't shown in an address bar.
// Safe no-op if the History API isn't available.
function scrubUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  try { window.history.replaceState(null, '', window.location.pathname); }
  catch (e) { /* non-fatal — cosmetic only */ }
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('initializing');
  const [flow, setFlow] = useState(null);
  const [flowType, setFlowType] = useState('invite'); // 'invite' | 'recovery'
  const [flowError, setFlowError] = useState(null);   // null | 'invalid'
  const [mode, setMode] = useState('live');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState('idle');
  const [profileError, setProfileError] = useState(null);
  const [error, setError] = useState(null);
  const profileRequestRef = useRef(0); // cancels stale profile responses across auth changes
  // Race guard: true from the moment the app opens until we've established
  // whether THIS launch is a password-setup callback or a normal one. While
  // true, the ongoing onAuthStateChange listener (a SEPARATE effect, which can
  // fire independently — e.g. reflecting an already-persisted session, or
  // firing before a slow exchangeCodeForSession/setSessionFromTokens call
  // resolves) must not push the app into signed-in dashboard-rendering state.
  // Starts true (not false) so the native cold-start gap — the `await
  // Linking.getInitialURL()` before we've even parsed the URL — is covered
  // too, not just the window inside handleAuthCallback itself.
  const setupInProgressRef = useRef(true);

  const roleKey = profile ? roleKeyForDbRole(profile.role) : null;
  const schoolName = profile && profile.school ? profile.school.name : null;

  // keep the module-level live flag in step: live only for a real signed-in,
  // non-demo session. Everything else (demo, signed out) is not live.
  useEffect(() => {
    setLiveSupabaseMode(mode === 'live' && status === 'signed_in');
  }, [mode, status]);

  const loadProfile = useCallback(async () => {
    const requestId = ++profileRequestRef.current;
    setProfileStatus('loading');
    setProfileError(null);
    try {
      const p = await getMyProfile();
      if (requestId !== profileRequestRef.current) {
        const stale = new Error('Stale profile request ignored.'); stale.code = 'stale_profile_request'; throw stale;
      }
      setProfile(p);
      setProfileStatus('ready');
      return p;
    } catch (e) {
      if (requestId !== profileRequestRef.current || (e && e.code === 'stale_profile_request')) throw e;
      setProfile(null);
      setProfileStatus('error');
      setProfileError({ code: e && e.code ? e.code : 'profile_load_failed' });
      throw e;
    }
  }, []);

  // Handle ONE parsed callback URL: exchange it for a session and force the
  // set-password flow. Returns true if this URL was a password-setup callback
  // (handled, regardless of success/failure) or false if it was unrelated
  // (caller should fall back to the normal persisted-session flow — and must
  // itself clear setupInProgressRef once it does, since this function only
  // clears the ref on the branches where IT determined the outcome).
  const handleAuthCallback = useCallback(async (rawUrl) => {
    const parsed = parseAuthUrl(rawUrl);
    if (!isPasswordSetupUrl(parsed)) return false;

    // Claim the flow and drop out of any dashboard-renderable status BEFORE
    // any `await` runs. This is the entire fix: everything from here to the
    // first `await` below executes synchronously, in the same tick that
    // called this function — which is guaranteed (by React's same-commit,
    // declaration-order effect execution) to run BEFORE the separate
    // onAuthStateChange listener effect is even registered on first mount,
    // and happens-before its own first callback invocation on a warm
    // (already-mounted) re-entry too. So no matter how fast or slow the
    // listener fires relative to the exchange below, it will always see
    // setupInProgressRef.current === true and refuse to route to a dashboard.
    setupInProgressRef.current = true;
    setFlow('set_password');
    setStatus('initializing');

    // scrubUrl() is deliberately NOT called yet — only after the relevant
    // exchange/verification attempt below has actually completed (success or
    // failure). Scrubbing this early would still be functionally harmless
    // for THIS attempt (parsed.code/tokenHash/accessToken are already
    // captured in local variables above), but it discards the one thing that
    // would let a user retry via a page refresh if the attempt fails for a
    // transient reason. Nothing sensitive is logged or rendered in the
    // meantime either way.

    if (parsed.kind === 'error') {
      // Supabase itself reported an error on our own reset/invite path
      // (e.g. ?error=access_denied&error_code=otp_expired). Nothing to
      // exchange — but "expired/consumed" (often an email scanner
      // pre-fetching the one-time link) must show the honest "ask for a new
      // one" state, never the dead-end "invalid link" screen.
      scrubUrl();
      logCallbackDiag('callback_url_error_' + classifyUrlError(parsed));
      setFlowError(classifyUrlError(parsed));
      setStatus('signed_out');
      setupInProgressRef.current = false;
      return true;
    }

    let stage = 'callback_missing_token';
    try {
      let s;
      if (parsed.kind === 'code' && parsed.code) {
        stage = 'callback_pkce_exchange_failed';
        s = await exchangeCodeForSession(parsed.code);
      } else if (parsed.kind === 'token_hash' && parsed.tokenHash) {
        stage = 'callback_token_hash_verify_failed';
        s = await verifyTokenHash(parsed.tokenHash, parsed.type);
      } else if (parsed.kind === 'session' && parsed.accessToken) {
        stage = 'callback_hash_session_failed';
        s = await setSessionFromTokens(parsed.accessToken, parsed.refreshToken);
      } else {
        // pathname named set/reset-password but carried no code/token/hash
        // (e.g. the page was reloaded after the link was already consumed)
        throw new Error('missing setup token');
      }
      scrubUrl(); // the exchange/verification succeeded — safe to scrub now
      setSession(s);

      stage = 'callback_profile_load_failed';
      const p = await loadProfile();
      setMode('live');
      // a still-pending profile means this is an invite (assign school_admin
      // on accept); an already-assigned profile means an ordinary reset —
      // decided from the DATABASE profile, never from the URL's own claim.
      setFlowType(p && p.role === 'pending' ? 'invite' : 'recovery');
      setFlowError(null);
      setFlow('set_password'); // already set above; re-affirmed after the async work
      setStatus('signed_in');
    } catch (e) {
      scrubUrl(); // the attempt is over (failed) — still safe/appropriate to scrub
      logCallbackDiag(stage);
      // A profile-load failure happens AFTER the session was already
      // established, which proves the invite/recovery link itself was
      // genuinely valid — it must NEVER be shown as an invalid link, only as
      // a retryable/temporary problem, regardless of what the underlying
      // error looks like.
      const category = stage === 'callback_profile_load_failed' ? 'temporary' : classifyCallbackError(e);
      setFlowError(category);
      setFlow('set_password');
      setStatus('signed_out');
    } finally {
      // From here on `flow` alone (never cleared until a successful password
      // save) is what keeps SetPasswordScreen showing — the listener no
      // longer needs to be suppressed once we've settled our own status.
      setupInProgressRef.current = false;
    }
    return true;
  }, [loadProfile]);

  // ---- mount: URL-based setup intent ALWAYS wins over a persisted session ----
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isSupabaseConfigured()) { setupInProgressRef.current = false; setStatus('signed_out'); return; }

      const initialUrl = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.href : null)
        : await Linking.getInitialURL();

      if (initialUrl) {
        const handled = await handleAuthCallback(initialUrl);
        if (!alive) return;
        if (handled) return; // flow/status/setupInProgressRef already settled inside handleAuthCallback
      }

      // no password-setup callback in the URL — safe to resume normal
      // routing; release the guard before touching any persisted session.
      setupInProgressRef.current = false;
      const s = await restoreSession();
      if (!alive) return;
      if (s) {
        setSession(s);
        setMode('live');
        try { await loadProfile(); }
        catch (e) {
          // A SIGNED_OUT/new-session event may have invalidated this restore
          // while the profile query was in flight. Never let the older async
          // continuation overwrite the newer auth state.
          if (e && e.code === 'stale_profile_request') return;
          /* signed-in session remains gated by profileStatus=error */
        }
        if (!alive) return;
        setStatus('signed_in');
      } else {
        setStatus('signed_out');
      }
    })();

    return () => { alive = false; };
  }, [handleAuthCallback, loadProfile]);

  // ---- ongoing auth events (sign-in/out/refresh). Never touches `flow` — ----
  // ---- flow is owned exclusively by handleAuthCallback and the explicit ----
  // ---- user actions below, so a stray event can never dismiss it. While ----
  // ---- setupInProgressRef is true (a password-setup callback is being  ----
  // ---- resolved, or we haven't yet determined whether this launch is  ----
  // ---- one), this listener may update session bookkeeping but must    ----
  // ---- NEVER flip status to a dashboard-renderable value.             ----
  useEffect(() => {
    const unsub = onAuthStateChange(async (event, s) => {
      if (setupInProgressRef.current) {
        // A password-setup callback is being resolved (or we haven't yet
        // determined whether this launch is one). This event may be
        // perfectly legitimate — e.g. it can reflect an already-persisted
        // session that Supabase's own client machinery reports independently
        // of our explicit exchange — but acting on it here (flipping status
        // to signed_in/signed_out) could render a dashboard mid-exchange.
        // Update session bookkeeping only; handleAuthCallback owns routing.
        if (s) setSession(s);
        return;
      }
      if (event === 'SIGNED_OUT' || !s) {
        profileRequestRef.current += 1;
        setSession(null); setProfile(null);
        setProfileStatus('idle'); setProfileError(null);
        setMode('live');
        setStatus('signed_out');
        return;
      }
      setSession(s);
      setMode('live');
      try { await loadProfile(); }
      catch (e) {
        if (e && e.code === 'stale_profile_request') return;
        /* App renders the retry state; never a guessed shell. */
      }
      setStatus('signed_in');
    });
    return unsub;
  }, [loadProfile]);

  // ---- native: a recovery/invite link opened while the app is already ----
  // ---- running (not a cold start) must ALSO take priority immediately ----
  useEffect(() => {
    if (Platform.OS === 'web' || !isSupabaseConfigured()) return undefined;
    const sub = Linking.addEventListener('url', (e) => { handleAuthCallback(e.url); });
    return () => sub.remove();
  }, [handleAuthCallback]);

  // ---- actions ----
  const signIn = useCallback(async (email, password) => {
    setError(null);
    await signInWithEmail(email, password);
    // onAuthStateChange handles session/profile/mode/status
  }, []);

  // Student / Parent identifier login. setSession inside signInWithIdentifier
  // fires onAuthStateChange, which loads the profile and routes exactly like a
  // staff email login — a real, refresh-persistent Supabase session.
  const signInWithSchoolIdentifier = useCallback(async ({ kind, schoolCode, studentId, password }) => {
    setError(null);
    const result = await signInWithIdentifier({ kind, schoolCode, studentId, password });
    // Generated Student credentials are temporary. A real session is already
    // installed, but route to the password-change screen before a dashboard can
    // be used. The flag is cleared only after updateUser succeeds.
    if (result && result.mustChangePassword) {
      setFlowType('first_login');
      setFlowError(null);
      setFlow('set_password');
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    profileRequestRef.current += 1;
    await sbSignOut();
    setFlow(null);
    setFlowError(null);
    setMode('live');
    setSession(null); setProfile(null);
    setProfileStatus('idle'); setProfileError(null);
    setStatus('signed_out');
  }, []);

  // Forgot-password goes through the request-password-reset Edge Function —
  // never a direct client-side resetPasswordForEmail. The server refuses to
  // send a recovery email to a pending-invite-only account (recovery must
  // never bypass invitation activation) and answers identically for every
  // account state, so nothing here can enumerate emails.
  const requestPasswordReset = useCallback(async (email) => {
    setError(null);
    await requestPasswordResetSecure(email);
  }, []);

  const requestIdentifierPasswordReset = useCallback(async (payload) => {
    setError(null);
    return requestIdentifierPasswordResetSecure(payload);
  }, []);

  const verifyIdentifierPasswordReset = useCallback(async (payload) => {
    setError(null);
    return verifyIdentifierPasswordResetSecure(payload);
  }, []);

  // Set the user's own password (invite acceptance or reset). For an invite,
  // accept the invitation afterwards so the DB assigns school_admin. For a
  // normal recovery, accept-school-invite is never called. `flow` is only
  // cleared once BOTH steps (and the profile refresh) succeed — if accept
  // fails, the user stays on SetPasswordScreen with a specific, honest error
  // (never silently routed to a dashboard, never mislabeled as an invalid
  // link) rather than losing track of the fact their password WAS saved.
  const setNewPassword = useCallback(async (newPassword, { accept = false } = {}) => {
    setError(null);
    try {
      await sbUpdatePassword(newPassword);
    } catch (e) {
      logCallbackDiag('password_update_failed');
      throw e;
    }
    if (accept) {
      try {
        // Phase 5 Teacher/Parent invitations use account_invitations, while
        // the original School Admin flow uses school_invitations. Try the
        // account invitation first; only a genuine "not found" falls back to
        // the original secure School Admin Edge Function.
        try {
          await acceptAccountInvite(null);
        } catch (accountErr) {
          if (!accountErr || accountErr.code !== 'not_found') throw accountErr;
          await acceptSchoolInvite(null);
        }
      } catch (e) {
        logCallbackDiag('invite_accept_failed');
        const err = new Error(e && e.message ? e.message : 'Ku biirista dugsiga ayaa fashilantay.');
        err.code = e && e.code ? e.code : 'invite_accept_failed';
        err.passwordSaved = true;
        throw err;
      }
    }
    if (flowType === 'first_login') {
      await clearMustChangePassword();
    }
    const p = await loadProfile();
    setFlowError(null);
    setFlow(null);
    setMode('live');
    setStatus('signed_in');
    return p;
  }, [loadProfile, flowType]);

  const acceptInvite = useCallback(async (invitationId) => {
    setError(null);
    await acceptSchoolInvite(invitationId || null);
    const p = await loadProfile();
    setFlow(null);
    return p;
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);

  const value = {
    status, flow, flowType, flowError, mode, demoActive: false,
    session, profile, roleKey, schoolName, profileStatus, profileError,
    configured: isSupabaseConfigured(),
    error,
    signIn, signInWithSchoolIdentifier, signOut, requestPasswordReset,
    requestIdentifierPasswordReset, verifyIdentifierPasswordReset,
    setNewPassword, acceptInvite,
    refreshProfile,
    isLive: mode === 'live' && status === 'signed_in',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
