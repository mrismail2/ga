#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 3 onboarding guardrails (static, reproducible)

   Proves the invite-only production rules that a runtime UI test would check,
   by asserting the source/config directly. No app boot or network needed.

   Run:  cd mobile && node scripts/onboarding-guards.test.js
         (or: npm run test:onboarding)
   Exits non-zero on any failure.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const read = (p) => fs.readFileSync(p, 'utf8');
// strip block + line comments so "no X" checks test CODE, not prose in comments
const code = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// ---- 1. public Supabase signup disabled in config ----
const cfg = read(path.join(REPO, 'supabase', 'config.toml'));
ok('supabase config disables public signup (no enable_signup = true)', !/enable_signup\s*=\s*true/.test(cfg));
ok('supabase config sets enable_signup = false', /enable_signup\s*=\s*false/.test(cfg));

// ---- 2. RegisterSchoolScreen stores nothing: no password, no AsyncStorage ----
const reg = code(path.join(ROOT, 'src', 'screens', 'auth', 'RegisterSchoolScreen.js'));
ok('RegisterSchoolScreen has no password field (no secureTextEntry)', !/secureTextEntry/.test(reg));
ok('RegisterSchoolScreen keeps no password state/field (code)', !/password/i.test(reg));
ok('RegisterSchoolScreen does not import/use AsyncStorage (code)', !/AsyncStorage/.test(reg));
ok('RegisterSchoolScreen never persists anything (no setItem)', !/setItem/.test(reg));

// ---- 3. LoginScreen: invite-only, email+password ONLY, no demo entry point ----
const login = code(path.join(ROOT, 'src', 'screens', 'auth', 'LoginScreen.js'));
ok('LoginScreen shows no public "Diiwaan geli dugsi" register link', !/Diiwaan geli dugsi/.test(login));
ok('LoginScreen has no goRegister navigation', !/goRegister/.test(login));
ok('LoginScreen shows the invite-only info text', /School registration is handled by the Kobciye Super Admin/.test(login));
ok('LoginScreen has NO demo/preview entry point (no enterDemoMode)', !/enterDemoMode/.test(login));
ok('LoginScreen has NO role picker (no ROLE_ORDER/roleChip)', !/ROLE_ORDER/.test(login) && !/roleChip/.test(login));

// ---- 3b. Student/Parent login tabs are now REAL (Phase 5) ----
// They must NOT be "coming soon" mockups anymore, and must sign in through the
// real identifier-login flow (School ID + Student ID + password), never a
// local/fake auth path.
ok('LoginScreen no longer labels Student/Parent as "Coming Soon"',
  !/Dhawaan \(Coming Soon\)/.test(login) && !/submitComingSoon/.test(login));
ok('LoginScreen signs Student/Parent in through the real identifier-login flow',
  /signInWithSchoolIdentifier/.test(login));
ok('LoginScreen student/parent login uses no local/fake auth',
  !/AsyncStorage/.test(login) && !/localStorage/.test(login));

// ---- 4. AuthFlow: never routes to RegisterSchoolScreen in live (configured) mode ----
const flow = read(path.join(ROOT, 'src', 'screens', 'auth', 'AuthFlow.js'));
ok('AuthFlow gates the register route behind !configured', /register'\s*&&\s*!configured/.test(flow));

// ---- 5. BOTH landings are WhatsApp-enquiry-only (no public account creation) ----
// The two landing implementations must share the same business behaviour.
const landings = [
  ['mobile KobciyeLanding.js', path.join(ROOT, 'src', 'screens', 'landing', 'KobciyeLanding.js')],
  ['standalone landing/index.html', path.join(REPO, 'landing', 'index.html')],
];
// Sanitize before substring checks: drop base64 image data-URIs (they embed
// arbitrary letters) and code comments (an explanatory comment may legitimately
// mention "Supabase"/"localStorage"). URL "//" is preserved (the [^:] guard).
const sanitize = (s) => s
  .replace(/data:[^'"\s)]*;base64,[A-Za-z0-9+/=]+/g, 'DATAURI')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
for (const [label, file] of landings) {
  const src = sanitize(read(file));
  // "Diiwaan geli Dugsigaaga" exists ONLY as an enquiry CTA (kept per business rule)
  ok(`${label}: keeps the "Diiwaan geli Dugsigaaga" enquiry CTA`, /Diiwaan geli Dugsigaaga/.test(src));
  // it is an enquiry form, not account registration — WhatsApp submit handler present
  ok(`${label}: submits the enquiry via a WhatsApp handler (submitEnquiry)`, /submitEnquiry/.test(src));
  // The landings now host LOGIN UI (user-requested modal design) but must
  // never authenticate or leak a typed password from the public page itself:
  // no fetch/XHR anywhere, and no password state ever interpolated into the
  // WhatsApp URL (the only outbound URL the page builds).
  ok(`${label}: page performs no network auth (no fetch/XHR)`,
    !/fetch\s*\(/.test(src) && !/XMLHttpRequest/.test(src));
  ok(`${label}: typed password never leaves the page (never in a WhatsApp/encoded URL)`,
    !/encodeURIComponent\([^)]*(loginPw|stuPw)/.test(src) && !/wa\.me[^\n]*(loginPw|stuPw)/.test(src));
  // no login role picker (staff/student/parent tabs)
  ok(`${label}: has NO role-picker login (loginRole/roleStaff)`, !/loginRole/.test(src) && !/roleStaff/.test(src));
  // no fake role-based app entry (old submitForm that entered the app as a role)
  ok(`${label}: has NO fake role-based preview login (submitForm)`, !/submitForm/.test(src));
  // WhatsApp URL uses wa.me with a configurable digits-only number (no '+')
  ok(`${label}: WhatsApp URL uses wa.me + a variable number, not a hardcoded '+' number`,
    /wa\.me\/'\s*\+\s*WA/.test(src) && !/wa\.me\/\+/.test(src));
  // the generated WhatsApp text carries the school enquiry fields
  ok(`${label}: WhatsApp message contains the enquiry fields`,
    /Magaca Dugsiga:/.test(src) && /Qofka La Xiriirayo:/.test(src) && /Telefoonka:/.test(src));
  // no writes to any storage / backend from the public landing
  ok(`${label}: no AsyncStorage/localStorage/setItem writes`,
    !/AsyncStorage/.test(src) && !/localStorage/.test(src) && !/\.setItem\(/.test(src));
  // no account/school/invitation/role creation from the public landing
  ok(`${label}: creates no supabase/school/invitation/role record`,
    !/supabase/i.test(src) && !/createUser/i.test(src) && !/invitation/i.test(src) && !/school_admin/i.test(src));
  // Login goes to the real app login, not a fake preview: the mobile landing
  // via goLogin/onEnter (opens the real Supabase login modal), the standalone
  // page by redirecting to the deployed app (APP_LOGIN_URL).
  ok(`${label}: Login routes to the real app login (goLogin or APP_LOGIN_URL)`,
    /goLogin/.test(src) || /APP_LOGIN_URL/.test(src));
}

// mobile landing reads the configurable WhatsApp number from a public env var
const landingJs = read(path.join(ROOT, 'src', 'screens', 'landing', 'KobciyeLanding.js'));
ok('mobile landing reads EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER (configurable)',
  /EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER/.test(landingJs));
ok('mobile .env.example documents EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER',
  /EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER/.test(read(path.join(ROOT, '.env.example'))));
// standalone landing has a single documented config source with a digits-only number
const landingCfg = read(path.join(REPO, 'landing', 'config.js'));
ok('landing/config.js defines a digits-only WhatsApp number',
  /KOBCIYE_LANDING_WHATSAPP_NUMBER\s*=\s*'[0-9]+'/.test(landingCfg));

// ---- 6. new migration drops the direct-write policy (defence, also SQL-tested) ----
const mig = read(path.join(REPO, 'supabase', 'migrations', '20260703000002_invitations_harden.sql'));
ok('migration 0002 drops the direct super_admin write policy', /drop policy[^\n]*super_admin writes invitations/i.test(mig));
ok('migration 0002 adds an email delivery status', /email_delivery_status/.test(mig));

console.log('');
if (failures) { console.error(`onboarding-guards FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('onboarding-guards PASSED — invite-only production rules hold ✓\n');
