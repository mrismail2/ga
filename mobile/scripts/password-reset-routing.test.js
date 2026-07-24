#!/usr/bin/env node
/* ============================================================
   Kobciye — password-reset / invite deep-link routing tests

   Two layers, both reproducible and deterministic (no network, no app boot):

   (A) REAL LOGIC — transpiles the actual src/utils/deepLink.js with the
       same local Babel test compiler used by scripts/audit-foundation.js
       and calls the real parseAuthUrl()/isPasswordSetupUrl() against every
       callback shape the bug report named: hash-token recovery, hash-token
       invite, PKCE ?code=, a bare pathname revisit with no params, an error
       callback, and an unrelated normal URL. This proves the routing TRIGGER
       condition — the same one AuthContext uses to decide whether to force
       SetPasswordScreen — actually fires for every case, using the shipped
       code, not a re-implementation that could quietly drift from it.

   (B) STRUCTURAL INVARIANTS — the source of AuthContext.js / App.js /
       SetPasswordScreen.js / services/supabase.js is inspected for the
       specific ordering/wiring that makes the state machine safe: URL-based
       setup intent is checked BEFORE any persisted session, detectSessionInUrl
       is off (so nothing auto-races the manual check), the ongoing auth-event
       listener never clears `flow` (so a stray SIGNED_IN/TOKEN_REFRESHED can't
       dismiss an active set-password screen), App.js renders SetPasswordScreen
       before it ever considers the dashboard, and the recovery-vs-invite
       decision for accept-school-invite is made from the DB profile role, not
       the URL's own claim.

   Run:  cd mobile && node scripts/password-reset-routing.test.js
         (or: npm run test:auth-routing)
   Exits non-zero on any failure.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const read = (p) => fs.readFileSync(p, 'utf8');
const code = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

console.log('\n[A] Real logic — transpiling src/utils/deepLink.js with Babel');
let deepLink = null;
try {
  const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-deeplink-source'));
  deepLink = require(path.join(compiledSrc, 'utils', 'deepLink.js'));
} catch (e) {
  console.error('could not transpile deepLink.js for testing:', e.message);
  process.exit(1);
}
const { parseAuthUrl, isPasswordSetupUrl, isPasswordSetupType } = deepLink;

const trigger = (url) => isPasswordSetupUrl(parseAuthUrl(url));

ok('hash-token RECOVERY link triggers password-setup routing',
  trigger('https://app.example.com/set-password#access_token=abc&refresh_token=def&type=recovery'));

ok('hash-token INVITE link triggers password-setup routing',
  trigger('https://app.example.com/set-password#access_token=abc&refresh_token=def&type=invite'));

ok('PKCE ?code= link on /set-password triggers password-setup routing',
  trigger('https://app.example.com/set-password?code=abcdef123456'));

ok('PKCE ?code= link on /reset-password (alternate path) also triggers routing',
  trigger('https://app.example.com/reset-password?code=abcdef123456'));

ok('native kobciye://set-password hash-token link triggers routing',
  trigger('kobciye://set-password#access_token=abc&refresh_token=def&type=recovery'));

ok('a bare revisit of /set-password with no code/token still triggers routing (shows invalid, not dashboard)',
  trigger('https://app.example.com/set-password'));

ok('an error callback on our own reset path triggers routing (shows invalid, not dashboard)',
  trigger('https://app.example.com/set-password?error=access_denied&error_description=Link+expired'));

ok('an unrelated normal app URL (no path, no params) does NOT trigger password-setup routing',
  !trigger('https://app.example.com/'));

ok('a plain dashboard-ish URL with unrelated query params does NOT trigger routing',
  !trigger('https://app.example.com/dashboard?tab=students'));

// exact token/code extraction, so AuthContext calls the right exchange method
const codeParsed = parseAuthUrl('https://app.example.com/set-password?code=XYZ789');
ok('PKCE link is parsed with kind=code and the exact code value', codeParsed.kind === 'code' && codeParsed.code === 'XYZ789');

const hashParsed = parseAuthUrl('https://app.example.com/set-password#access_token=TOK&refresh_token=REF&type=recovery');
ok('hash-token link is parsed with kind=session and the exact tokens', hashParsed.kind === 'session' && hashParsed.accessToken === 'TOK' && hashParsed.refreshToken === 'REF');

ok('isPasswordSetupType recognizes invite/recovery/signup, not arbitrary strings',
  isPasswordSetupType('invite') && isPasswordSetupType('recovery') && isPasswordSetupType('signup') && !isPasswordSetupType('magiclink') && !isPasswordSetupType('bogus'));

console.log('\n[B] Structural invariants — the state machine wiring itself');

const authCtx = code(path.join(ROOT, 'src', 'context', 'AuthContext.js'));

ok('detectSessionInUrl is OFF (no race between auto-detection and our manual check)',
  /detectSessionInUrl:\s*false/.test(code(path.join(ROOT, 'src', 'services', 'supabase.js'))));

ok('exchangeCodeForSession is exported from services/supabase.js (PKCE support)',
  /export\s+async\s+function\s+exchangeCodeForSession/.test(code(path.join(ROOT, 'src', 'services', 'supabase.js'))));

{
  // in the mount effect, the callback-URL check must be handled — and
  // "return" out — BEFORE restoreSession() is ever reached, so an existing
  // persisted session can never win over a fresh recovery/invite callback.
  const handleIdx = authCtx.indexOf('handleAuthCallback(initialUrl)');
  const restoreIdx = authCtx.indexOf('await restoreSession()');
  ok('handleAuthCallback(initialUrl) is checked before restoreSession() in the mount effect',
    handleIdx !== -1 && restoreIdx !== -1 && handleIdx < restoreIdx);
}

ok('handleAuthCallback sets flow to set_password on a successful exchange',
  /setFlow\('set_password'\)/.test(authCtx));

ok('handleAuthCallback sets flowError on a failed/invalid exchange (immediate invalid state, no submit needed)',
  // failures are CLASSIFIED (invalid / expired / temporary / wrong_browser),
  // never hardcoded to 'invalid' — both failure branches set flowError from
  // their classifier (classifyUrlError for ?error= URLs, classifyCallbackError
  // via `category` for failed exchanges).
  /setFlowError\(classifyUrlError\(parsed\)\)/.test(authCtx) && /setFlowError\(category\)/.test(authCtx));

ok('the recovery-vs-invite decision comes from the DB profile role, not the URL',
  /p\s*&&\s*p\.role\s*===\s*'pending'\s*\?\s*'invite'\s*:\s*'recovery'/.test(authCtx));

{
  // the ongoing onAuthStateChange listener must never call setFlow — flow is
  // owned exclusively by handleAuthCallback + the explicit user actions, so a
  // stray SIGNED_IN/TOKEN_REFRESHED event can never dismiss an active
  // set-password screen out from under the user.
  const listenerStart = authCtx.indexOf('onAuthStateChange(async (event, s)');
  const listenerBlock = listenerStart !== -1 ? authCtx.slice(listenerStart, listenerStart + 700) : '';
  ok('the ongoing auth-event listener never calls setFlow (cannot dismiss an active set-password screen)',
    listenerStart !== -1 && !/\bsetFlow\(/.test(listenerBlock));

  // race-condition guard: while a password-setup callback is being resolved
  // (an awaited exchangeCodeForSession/setSessionFromTokens call in flight),
  // the listener must skip status changes entirely — it may only touch
  // session bookkeeping — so a concurrently-firing event (e.g. reflecting an
  // already-persisted admin session) can never render a dashboard mid-exchange.
  ok('the listener checks setupInProgressRef and returns before any setStatus call when guarded',
    listenerStart !== -1 && (() => {
      const guardIdx = listenerBlock.indexOf('setupInProgressRef.current');
      if (guardIdx === -1) return false;
      const guardBlock = listenerBlock.slice(guardIdx, guardIdx + 250);
      const returnIdx = guardBlock.indexOf('return');
      const nextStatusIdx = guardBlock.search(/setStatus\(/);
      // the guarded branch must return before the NEXT setStatus() call
      // appears anywhere later in the block (i.e. no setStatus between the
      // guard check and its own return)
      return returnIdx !== -1 && (nextStatusIdx === -1 || returnIdx < nextStatusIdx);
    })());
}

{
  // handleAuthCallback must claim the guard AND the flow SYNCHRONOUSLY —
  // before its own first await — so the listener (which can fire at any
  // point, including mid-exchange) always observes setupInProgressRef==true
  // and a flow that's already 'set_password' by the time it looks.
  const cbStart = authCtx.indexOf('const handleAuthCallback = useCallback(async (rawUrl)');
  const firstAwaitIdx = authCtx.indexOf('await exchangeCodeForSession', cbStart);
  const block = cbStart !== -1 && firstAwaitIdx !== -1 ? authCtx.slice(cbStart, firstAwaitIdx) : '';
  ok('handleAuthCallback sets setupInProgressRef.current = true before its first await',
    /setupInProgressRef\.current\s*=\s*true/.test(block));
  ok('handleAuthCallback sets flow to set_password before its first await (not only after the exchange)',
    /setFlow\('set_password'\)/.test(block));
  ok('handleAuthCallback sets a non-dashboard status (initializing) before its first await',
    /setStatus\('initializing'\)/.test(block));
}

ok('setupInProgressRef starts true (covers the native cold-start gap before the URL is even parsed)',
  /setupInProgressRef\s*=\s*useRef\(true\)/.test(authCtx));

ok('handleAuthCallback releases the guard in a finally block (always cleared, success or failure)',
  (() => {
    const finallyIdx = authCtx.indexOf('} finally {');
    if (finallyIdx === -1) return false;
    const block = authCtx.slice(finallyIdx, finallyIdx + 300);
    return /setupInProgressRef\.current\s*=\s*false/.test(block);
  })());

ok('setNewPassword only calls acceptSchoolInvite when accept=true (never for a plain recovery)',
  /if\s*\(accept\)\s*\{[\s\S]{0,40}await acceptSchoolInvite/.test(authCtx));

ok('a successful password save clears flow/flowError and routes to the dashboard (status=signed_in)',
  /setFlowError\(null\);\s*\n\s*setFlow\(null\);\s*\n\s*setMode\('live'\);\s*\n\s*setStatus\('signed_in'\)/.test(authCtx));

// App.js: SetPasswordScreen must be checked before the dashboard/pending route.
// Anchor the search to the RENDER section only (starting at "if (loading)") —
// an earlier effect also mentions "signed_in" (to auto-dismiss the landing
// page) which is unrelated to render-priority ordering and would false-match.
const appJs = code(path.join(ROOT, 'App.js'));
{
  const renderStart = appJs.indexOf('if (loading)');
  const render = renderStart !== -1 ? appJs.slice(renderStart) : appJs;
  const flowIdx = render.indexOf("auth.flow === 'set_password'");
  const dashIdx = render.indexOf("auth.status === 'signed_in'");
  ok('App.js checks flow===set_password before status===signed_in (SetPasswordScreen is highest priority)',
    renderStart !== -1 && flowIdx !== -1 && dashIdx !== -1 && flowIdx < dashIdx);
}

// SetPasswordScreen: reads flowError and shows the invalid state immediately
const setPwScreen = code(path.join(ROOT, 'src', 'screens', 'auth', 'SetPasswordScreen.js'));
ok('SetPasswordScreen reads flowError from useAuth()', /flowError/.test(setPwScreen));
ok('SetPasswordScreen syncs flowError into its local invalid-state display', /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(flowError\)\s*setState\(flowError\)/.test(setPwScreen));

console.log('');
if (failures) { console.error(`password-reset-routing FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('password-reset-routing PASSED — recovery/invite callbacks always win over an existing session ✓\n');
