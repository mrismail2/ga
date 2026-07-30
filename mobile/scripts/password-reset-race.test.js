#!/usr/bin/env node
/* ============================================================
   Kobciye — password-reset race-condition integration test

   Simulates the EXACT scenarios the ticket describes, against the REAL
   AuthContext.js source (transpiled with the same local Babel test compiler
   scripts/audit-foundation.js and password-reset-routing.test.js already use
   for ESM app code) — not a re-implementation. Two scenarios, because the fix
   has two independent layers and each needs its own race to actually exercise
   it (proven below by temporarily removing each layer and confirming the
   corresponding scenario fails):

   Scenario A (web / PKCE code exchange):
     • an existing signed-in super_admin session is already present
     • the app opens a password-reset callback URL (?code=... on /set-password)
     • onAuthStateChange fires SIGNED_IN for that OLD session on a microtask —
       BEFORE exchangeCodeForSession (a deliberately-slower mocked network
       call) resolves
     This exercises handleAuthCallback's synchronous "claim flow/status before
     any await" — on web, the whole URL-handling effect's synchronous prefix
     (including that claim) runs before the listener effect is even
     registered, so this alone is enough to survive the race.

   Scenario B (native cold start):
     • Platform is native; Linking.getInitialURL() is itself an awaited native
       bridge call, so control yields back to React BEFORE we've even parsed
       the URL — flow/status haven't been touched yet at that point.
     • onAuthStateChange fires SIGNED_IN for an old session DURING that gap.
     This exercises the setupInProgressRef guard specifically (it defaults to
     true from mount, precisely to cover this window) — scenario A's fix alone
     does NOT protect this path, since handleAuthCallback hasn't even been
     called yet when the old-session event arrives.

   Only `react`, `react-native`, and the three service modules AuthContext.js
   imports are mocked (with fully controllable timing); `utils/deepLink.js` is
   left un-mocked and bundled in, so the real parseAuthUrl/isPasswordSetupUrl
   logic runs. A minimal hook runtime (useState/useRef/useEffect/useCallback/
   useContext) drives the real `AuthProvider` function through one mount,
   running its queued effects in DECLARATION ORDER — exactly matching React's
   own same-commit guarantee.

   For each scenario the assertions are:
     1. the race actually happened in the intended order (otherwise the
        scenario would be proving nothing).
     2. at NO POINT was `status` ever 'signed_in' while `flow` was not yet
        'set_password' — the exact combination that would let App.js render
        RootNavigator instead of SetPasswordScreen.
     3. the final settled state is status='signed_in' + flow='set_password'.

   Run:  cd mobile && node scripts/password-reset-race.test.js
         (or: npm run test:auth-race)
   Exits non-zero on any failure or if a race didn't occur as designed.
   ============================================================ */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };

// ---- bundle the REAL AuthContext.js (it has JSX) to CJS, ONCE. Only the
//      modules we need controllable timing for are externalized;
//      utils/deepLink.js has no problematic dependencies and is left
//      inlined, so the real URL-parsing logic runs for real. ----
let authContextPath;
try {
  const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-authcontext-race-source'));
  authContextPath = path.join(compiledSrc, 'context', 'AuthContext.js');
} catch (e) {
  console.error('could not transpile AuthContext.js for testing:', e.message);
  process.exit(1);
}

const OLD_SESSION = { access_token: 'old-admin-token', user: { id: 'admin-1', email: 'admin@school.test' } };
const NEW_SESSION = { access_token: 'new-session-token', user: { id: 'admin-1', email: 'admin@school.test' } };

// Declaration order in AuthContext.js (verified against the real bundled
// output, and re-verified below by each scenario's own sanity check): status
// is the 1st useState call, flow is the 2nd.
const STATUS_IDX = 0;
const FLOW_IDX = 1;

/* Run one fully-isolated scenario: fresh hook-slot storage, a fresh
   require() of the bundle (cache cleared, re-mocked against THIS scenario's
   react-native/supabase mocks), one mount, run its effects, then wait out the
   race and report what actually happened. */
async function runScenario(name, { platform, linkingDelayMs, listenerFireDelayMs, url }) {
  console.log(`\n--- scenario: ${name} ---`);
  const timeline = [];
  const note = (t) => timeline.push(t);
  const transitions = [];

  const stateSlots = [];
  const refSlots = [];
  let stateIdx = 0;
  let refIdx = 0;
  const queuedEffects = [];

  function useState(initial) {
    const idx = stateIdx++;
    if (!(idx in stateSlots)) stateSlots[idx] = initial;
    const setter = (v) => {
      const next = typeof v === 'function' ? v(stateSlots[idx]) : v;
      stateSlots[idx] = next;
      if (idx === STATUS_IDX || idx === FLOW_IDX) {
        transitions.push({ name: idx === STATUS_IDX ? 'status' : 'flow', value: next });
      }
    };
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
    Platform: { OS: platform },
    Linking: {
      getInitialURL: async () => {
        await new Promise((r) => setTimeout(r, linkingDelayMs));
        note('Linking.getInitialURL:resolved');
        return url;
      },
      addEventListener: () => ({ remove: () => {} }),
    },
  };

  const mockSupabaseService = {
    supabase: {},
    isSupabaseConfigured: () => true,
    onAuthStateChange: (cb) => {
      setTimeout(() => {
        note('onAuthStateChange:SIGNED_IN(old-session)');
        cb('SIGNED_IN', OLD_SESSION);
      }, listenerFireDelayMs);
      return () => {};
    },
    restoreSession: async () => { note('restoreSession:called'); return null; },
    getMyProfile: async () => {
      note('getMyProfile:resolved(super_admin)');
      return { id: 'admin-1', role: 'super_admin', school_id: null, school: null, full_name: 'Existing Admin' };
    },
    signInWithEmail: async () => { throw new Error('not exercised in this test'); },
    signOut: async () => {},
    resetPassword: async () => {},
    updatePassword: async () => {},
    setSessionFromTokens: async () => { throw new Error('not exercised in this test (PKCE code path)'); },
    // Deliberately slower than the listener event above.
    exchangeCodeForSession: async (code) => {
      note('exchangeCodeForSession:start');
      await new Promise((resolve) => setTimeout(resolve, 30));
      note('exchangeCodeForSession:resolved');
      return NEW_SESSION;
    },
    acceptSchoolInvite: async () => {},
  };

  // fresh require every time: clear the cache so the bundle's top-level
  // require('react')/require('react-native')/etc. re-run against THIS
  // scenario's mocks instead of reusing a previous scenario's closures.
  delete require.cache[require.resolve(authContextPath)];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'react') return mockReact;
    if (request === 'react-native') return mockReactNative;
    if (request === '@supabase/supabase-js') return { isAuthRetryableFetchError: () => false };
    if (request === '../services/supabase') return mockSupabaseService;
    if (request === '../services/liveMode') return { setLiveSupabaseMode: () => {} };
    if (request === '../data/roleMap') return { roleKeyForDbRole: (r) => r, DB_ROLES: [], isDashboardRole: () => true };
    return originalLoad.call(this, request, parent, isMain);
  };

  global.window = platform === 'web'
    ? { location: { href: url, pathname: '/set-password' }, history: { replaceState: () => {} } }
    : undefined;

  let AuthProvider;
  try {
    ({ AuthProvider } = require(authContextPath));
  } finally {
    Module._load = originalLoad;
  }

  const element = AuthProvider({ children: null });
  ok(`[${name}] AuthProvider renders an AuthContext.Provider element on mount`, !!element && !!element.props);
  ok(`[${name}] slot 0 is really \`status\` (defaults "initializing") and slot 1 is really \`flow\` (defaults null)`,
    stateSlots[STATUS_IDX] === 'initializing' && stateSlots[FLOW_IDX] === null);

  while (queuedEffects.length) { const fn = queuedEffects.shift(); fn(); }

  // let the whole race play out
  await new Promise((resolve) => setTimeout(resolve, 200));

  console.log(`[${name}] timeline:`, JSON.stringify(timeline));
  console.log(`[${name}] transitions:`, JSON.stringify(transitions));

  const oldEventIdx = timeline.indexOf('onAuthStateChange:SIGNED_IN(old-session)');
  const exchangeResolvedIdx = timeline.indexOf('exchangeCodeForSession:resolved');
  const urlKnownIdx = platform === 'web' ? 0 : timeline.indexOf('Linking.getInitialURL:resolved');
  ok(`[${name}] the old-session SIGNED_IN event actually fired before the exchange resolved (the race raced)`,
    oldEventIdx !== -1 && exchangeResolvedIdx !== -1 && oldEventIdx < exchangeResolvedIdx);
  if (platform !== 'web') {
    ok(`[${name}] the old-session event fired BEFORE the URL was even known (native cold-start gap)`,
      oldEventIdx !== -1 && urlKnownIdx !== -1 && oldEventIdx < urlKnownIdx);
  }

  let liveStatus = 'initializing';
  let liveFlow = null;
  let sawBadCombination = false;
  for (const t of transitions) {
    if (t.name === 'status') liveStatus = t.value;
    if (t.name === 'flow') liveFlow = t.value;
    if (liveStatus === 'signed_in' && liveFlow !== 'set_password') { sawBadCombination = true; break; }
  }
  ok(`[${name}] at NO POINT was status="signed_in" observed while flow was not "set_password" (would have rendered the dashboard)`,
    !sawBadCombination);

  ok(`[${name}] final status is signed_in (exchange succeeded)`, stateSlots[STATUS_IDX] === 'signed_in');
  ok(`[${name}] final flow is set_password (SetPasswordScreen renders)`, stateSlots[FLOW_IDX] === 'set_password');
}

(async () => {
  // Scenario A: web, PKCE code exchange. The old-session event is scheduled
  // as fast as possible (0ms) — still strictly before the 30ms exchange.
  await runScenario('web-pkce-exchange-race', {
    platform: 'web',
    linkingDelayMs: 0,
    listenerFireDelayMs: 0,
    url: 'https://app.example.com/set-password?code=racetestcode123',
  });

  // Scenario B: native cold start. Linking.getInitialURL() takes 25ms to
  // resolve (a real native bridge call); the old-session event fires at 5ms
  // — well BEFORE we've even learned the URL, let alone parsed it or called
  // handleAuthCallback. This is the window setupInProgressRef's `true`
  // default (not handleAuthCallback's own synchronous claim) is responsible
  // for covering.
  await runScenario('native-cold-start-race', {
    platform: 'ios',
    linkingDelayMs: 25,
    listenerFireDelayMs: 5,
    url: 'kobciye://set-password?code=racetestcode456',
  });

  console.log('');
  if (failures) { console.error(`password-reset-race FAILED with ${failures} issue(s)\n`); process.exit(1); }
  console.log('password-reset-race PASSED — an in-flight recovery callback survives a concurrent old-session event on both web and native ✓\n');
})().catch((e) => {
  console.error('UNCAUGHT', e);
  process.exit(1);
});
