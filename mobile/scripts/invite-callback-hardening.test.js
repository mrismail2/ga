#!/usr/bin/env node
/* ============================================================
   Kobciye — invite/recovery callback hardening suite

   Root cause this proves the fix for: parseAuthUrl() never recognized
   Supabase's token_hash callback style (?token_hash=...&type=invite — used
   when an email template is configured with {{ .TokenHash }}, which is
   often necessary for a native app's custom URL scheme since Supabase's own
   hosted /verify redirect can only target an https:// site). A token_hash
   link fell through to `kind: 'none'`, which handleAuthCallback's exchange
   logic didn't recognize either, throwing "missing setup token" and setting
   flowError='invalid' — showing "Casuumaad aan sax ahayn" for a perfectly
   valid, fresh invite. A second, independent bug compounded it: EVERY
   failure in that catch block (network hiccup, profile-load hiccup, a
   genuinely expired code) was unconditionally mapped to the same 'invalid'
   state, so even once token_hash is supported, any unrelated transient
   failure would still show the same wrong, unrecoverable message.

   Transpiles the REAL AuthContext.js with the same local Babel compiler
   password-reset-race.test.js already established — not a
   re-implementation. Only react/react-native and the service modules
   AuthContext.js imports are mocked, with fully controllable
   success/failure per scenario; src/utils/deepLink.js is left un-mocked and
   bundled in, so the real parseAuthUrl/isPasswordSetupUrl logic runs.

   Run:  cd mobile && node scripts/invite-callback-hardening.test.js
   Exits non-zero on any failure.
   ============================================================ */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };

let authContextPath;
try {
  const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-authcontext-invite-source'));
  authContextPath = path.join(compiledSrc, 'context', 'AuthContext.js');
} catch (e) {
  console.error('could not transpile AuthContext.js for testing:', e.message);
  process.exit(1);
}

let SUPABASE_JS;
let sdkMode = 'installed Supabase SDK';
try {
  SUPABASE_JS = require('@supabase/supabase-js');
} catch (error) {
  if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
  class AuthRetryableFetchError extends Error {
    constructor(message, status) { super(message); this.name = 'AuthRetryableFetchError'; this.status = status; }
  }
  SUPABASE_JS = {
    AuthRetryableFetchError,
    isAuthRetryableFetchError: (value) => value instanceof AuthRetryableFetchError,
  };
  sdkMode = 'offline-compatible Supabase auth error double';
}
console.log(`[test dependency: ${sdkMode}]`);
const NEW_SESSION = { access_token: 'new-session-token', user: { id: 'invitee-1', email: 'invitee@school.test' } };

/* Runs one fully-isolated scenario: fresh hook-slot storage, a fresh
   require() of the bundle, one mount, run its effects, wait for the async
   callback handling to settle, then report the final state + call log. */
async function runScenario(name, cfg) {
  console.log(`\n--- scenario: ${name} ---`);
  const calls = [];
  const note = (t) => calls.push(t);

  const stateSlots = [];
  const refSlots = [];
  let stateIdx = 0;
  let refIdx = 0;
  const queuedEffects = [];

  function useState(initial) {
    const idx = stateIdx++;
    if (!(idx in stateSlots)) stateSlots[idx] = initial;
    const setter = (v) => { stateSlots[idx] = typeof v === 'function' ? v(stateSlots[idx]) : v; };
    return [stateSlots[idx], setter];
  }
  function useRef(initial) {
    const idx = refIdx++;
    if (!(idx in refSlots)) refSlots[idx] = { current: initial };
    return refSlots[idx];
  }
  function useCallback(fn) { return fn; }
  function useEffect(fn) { queuedEffects.push(fn); }
  function useContext(ctx) { return ctx && ctx._currentValue; }
  function createContext(defaultValue) { return { _currentValue: defaultValue, Provider: 'Provider' }; }
  function createElement(type, props, ...children) {
    return { type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } };
  }
  const mockReact = { createElement, createContext, useContext, useState, useEffect, useCallback, useRef };

  const mockReactNative = {
    Platform: { OS: cfg.platform || 'web' },
    Linking: {
      getInitialURL: async () => cfg.url,
      addEventListener: () => ({ remove: () => {} }),
    },
  };

  const mockSupabaseService = {
    supabase: {},
    isSupabaseConfigured: () => true,
    onAuthStateChange: () => (() => {}),
    restoreSession: async () => { note('restoreSession:called'); return null; },
    getMyProfile: async () => {
      note('getMyProfile:called');
      if (cfg.profileError) throw cfg.profileError;
      return { id: 'invitee-1', role: cfg.profileRole || 'pending', school_id: null, school: null, full_name: 'New Invitee' };
    },
    signInWithEmail: async () => { throw new Error('not exercised in this test'); },
    signOut: async () => {},
    resetPassword: async () => {},
    updatePassword: async () => {},
    setSessionFromTokens: async (accessToken, refreshToken) => {
      note('setSessionFromTokens:called');
      if (cfg.hashError) throw cfg.hashError;
      return NEW_SESSION;
    },
    exchangeCodeForSession: async (code) => {
      note('exchangeCodeForSession:called');
      if (cfg.codeError) throw cfg.codeError;
      return NEW_SESSION;
    },
    verifyTokenHash: async (tokenHash, type) => {
      note(`verifyTokenHash:called(type=${type})`);
      if (cfg.tokenHashError) throw cfg.tokenHashError;
      return NEW_SESSION;
    },
    acceptSchoolInvite: async () => { note('acceptSchoolInvite:called'); if (cfg.acceptError) throw cfg.acceptError; },
    requestPasswordResetSecure: async () => { note('requestPasswordResetSecure:called'); },
  };

  delete require.cache[require.resolve(authContextPath)];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'react') return mockReact;
    if (request === 'react-native') return mockReactNative;
    if (request === '@supabase/supabase-js') return SUPABASE_JS;
    if (request === '../services/supabase') return mockSupabaseService;
    if (request === '../services/liveMode') return { setLiveSupabaseMode: () => {} };
    if (request === '../data/roleMap') return { roleKeyForDbRole: (r) => r, DB_ROLES: [], isDashboardRole: () => true };
    return originalLoad.call(this, request, parent, isMain);
  };

  global.window = cfg.platform === 'web'
    ? { location: { href: cfg.url, pathname: '/set-password' }, history: { replaceState: () => {} } }
    : undefined;

  let AuthProvider;
  try {
    ({ AuthProvider } = require(authContextPath));
  } finally {
    Module._load = originalLoad;
  }

  const element = AuthProvider({ children: null });
  while (queuedEffects.length) { const fn = queuedEffects.shift(); fn(); }
  await new Promise((resolve) => setTimeout(resolve, 80));

  // status=0, flow=1, flowType=2, flowError=3 — declaration order in AuthProvider
  const final = { status: stateSlots[0], flow: stateSlots[1], flowType: stateSlots[2], flowError: stateSlots[3] };
  console.log(`[${name}] calls:`, JSON.stringify(calls));
  console.log(`[${name}] final:`, JSON.stringify(final));
  return { final, calls, element };
}

(async () => {
  console.log('[1] Fresh invite with hash access_token flow opens SetPasswordScreen');
  {
    const { final, element } = await runScenario('hash-invite', {
      platform: 'web', url: 'https://app.example.com/set-password#access_token=tok&refresh_token=ref&type=invite',
    });
    ok('AuthProvider renders', !!element && !!element.props);
    ok('flow=set_password, flowError=null, status=signed_in', final.flow === 'set_password' && final.flowError === null && final.status === 'signed_in');
    ok('flowType is invite (profile is pending)', final.flowType === 'invite');
  }

  console.log('\n[2] Fresh invite with PKCE ?code= flow opens SetPasswordScreen');
  {
    const { final } = await runScenario('pkce-invite', {
      platform: 'web', url: 'https://app.example.com/set-password?code=abc123&type=invite',
    });
    ok('flow=set_password, flowError=null, status=signed_in', final.flow === 'set_password' && final.flowError === null && final.status === 'signed_in');
  }

  console.log('\n[3] Fresh invite with token_hash + type=invite opens SetPasswordScreen (the actual bug)');
  {
    const { final, calls } = await runScenario('token-hash-invite', {
      platform: 'web', url: 'https://app.example.com/set-password?token_hash=abcdef123456&type=invite',
    });
    ok('verifyTokenHash was called with type=invite', calls.some((c) => c === 'verifyTokenHash:called(type=invite)'));
    ok('flow=set_password, flowError=null (NOT invalid), status=signed_in', final.flow === 'set_password' && final.flowError === null && final.status === 'signed_in');
  }

  console.log('\n[3b] Fresh invite with token_hash + type=recovery also opens SetPasswordScreen');
  {
    const { final, calls } = await runScenario('token-hash-recovery', {
      platform: 'web', url: 'https://app.example.com/set-password?token_hash=zzz999&type=recovery',
      profileRole: 'school_admin',
    });
    ok('verifyTokenHash was called with type=recovery', calls.some((c) => c === 'verifyTokenHash:called(type=recovery)'));
    ok('flow=set_password, flowError=null, flowType=recovery (profile already assigned)', final.flow === 'set_password' && final.flowError === null && final.flowType === 'recovery');
  }

  console.log('\n[4] Recovery link updates the session but never calls accept-school-invite');
  {
    const { calls } = await runScenario('recovery-no-accept', {
      platform: 'web', url: 'https://app.example.com/set-password?token_hash=rec001&type=recovery', profileRole: 'school_admin',
    });
    ok('acceptSchoolInvite was NOT called for a recovery session establishment', !calls.some((c) => c.startsWith('acceptSchoolInvite')));
  }

  console.log('\n[9] Expired / already-used token_hash shows the "expired" state, not a generic crash');
  {
    const expiredErr = Object.assign(new Error('The token has expired or is invalid'), { code: 'otp_expired', status: 403 });
    const { final } = await runScenario('token-hash-expired', {
      platform: 'web', url: 'https://app.example.com/set-password?token_hash=used-already&type=invite',
      tokenHashError: expiredErr,
    });
    ok('flowError is "expired" (a specific, safe, correct message)', final.flowError === 'expired');
    ok('flow stays set_password (still shows SetPasswordScreen, not a dashboard)', final.flow === 'set_password');
  }

  console.log('\n[10] A generic network failure during the exchange does NOT show "Casuumaad aan sax ahayn"');
  {
    const networkErr = new SUPABASE_JS.AuthRetryableFetchError('Failed to fetch', 0);
    const { final } = await runScenario('code-network-failure', {
      platform: 'web', url: 'https://app.example.com/set-password?code=willfail&type=invite',
      codeError: networkErr,
    });
    ok('flowError is "temporary", never "invalid"', final.flowError === 'temporary' && final.flowError !== 'invalid');
    ok('flow stays set_password (recoverable, not a dead end)', final.flow === 'set_password');
  }

  console.log('\n[extra] A profile-load failure AFTER a successful exchange is "temporary", never "invalid"');
  {
    const { final, calls } = await runScenario('profile-load-failure', {
      platform: 'web', url: 'https://app.example.com/set-password?code=goodcode&type=invite',
      profileError: new Error('temporary DB hiccup'),
    });
    ok('the exchange itself succeeded (proves the link WAS genuinely valid)', calls.some((c) => c === 'exchangeCodeForSession:called'));
    ok('flowError is "temporary", never "invalid", despite the link being valid', final.flowError === 'temporary' && final.flowError !== 'invalid');
  }

  console.log('\n[malformed] A pathname-only revisit with no code/token/hash at all is genuinely "invalid"');
  {
    const { final } = await runScenario('malformed-revisit', {
      platform: 'web', url: 'https://app.example.com/set-password',
    });
    ok('flowError is "invalid" (correctly — there is truly nothing to exchange)', final.flowError === 'invalid');
  }

  console.log('\n[url-error-expired] An #error_code=otp_expired callback (e.g. an email scanner consumed the link) shows "expired", never "invalid"');
  {
    const { final } = await runScenario('url-error-otp-expired', {
      platform: 'web',
      url: 'https://app.example.com/set-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    });
    ok('flowError is "expired" (recoverable: ask for a new link)', final.flowError === 'expired');
    ok('flow stays set_password (never a dashboard)', final.flow === 'set_password');
  }

  console.log('\n[url-error-generic] A generic ?error=access_denied with no expiry signal is still "invalid"');
  {
    const { final } = await runScenario('url-error-generic', {
      platform: 'web',
      url: 'https://app.example.com/set-password#error=access_denied&error_description=Access+denied',
    });
    ok('flowError is "invalid" (Supabase itself rejected the link, no expiry signal)', final.flowError === 'invalid');
  }

  console.log('\n[wrong-browser] A PKCE ?code= link opened where no code_verifier exists shows "wrong_browser", never "invalid"');
  {
    const verifierErr = Object.assign(
      new Error('invalid request: both auth code and code verifier should be non-empty'),
      { status: 400 },
    );
    const { final } = await runScenario('pkce-verifier-missing', {
      platform: 'web', url: 'https://app.example.com/set-password?code=fromotherdevice&type=recovery',
      codeError: verifierErr,
    });
    ok('flowError is "wrong_browser" (open it where it was requested / ask for a new link)', final.flowError === 'wrong_browser');
    ok('never "invalid" — the link itself may be perfectly valid', final.flowError !== 'invalid');
  }

  console.log('\n[token-hash-no-type] token_hash WITHOUT &type= still reaches verifyTokenHash (service-level fallback handles the type)');
  {
    const { final, calls } = await runScenario('token-hash-missing-type', {
      platform: 'web', url: 'https://app.example.com/set-password?token_hash=notype123',
    });
    ok('verifyTokenHash was called (type=undefined — the service tries recovery then invite)', calls.some((c) => c.startsWith('verifyTokenHash:called')));
    ok('flow=set_password, flowError=null', final.flow === 'set_password' && final.flowError === null);
  }

  console.log('');
  if (failures) { console.error(`invite-callback-hardening FAILED with ${failures} issue(s)\n`); process.exit(1); }
  console.log('invite-callback-hardening PASSED — every valid callback style opens SetPasswordScreen; only a genuinely bad link shows "invalid" ✓\n');
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
