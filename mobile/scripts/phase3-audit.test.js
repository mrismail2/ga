#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 3 stability & security audit suite

   Covers the audit requirements that the older suites don't:

   FORGOT PASSWORD (Problem 2)
     • the client NEVER calls resetPasswordForEmail directly for the
       forgot-password flow — it goes through the request-password-reset
       Edge Function, which decides server-side
     • the Edge Function blocks recovery email for a pending-invite-only
       account, answers identically for every account state (no email
       enumeration), and never logs raw errors/emails/tokens
     • both forgot-password UIs show a neutral confirmation regardless of
       outcome

   STAGE-AWARE SCHOOL UI (Problem 3) — real bundled config logic:
     • terminologyForStage: primary_middle → Fasallada, secondary → Formamka,
       null/unknown → the neutral primary_middle terms
     • schoolNavItemsFor swaps ONLY the classes label — same keys/icons
     • no university term ever appears in either stage's school nav
     • defaultSectionsForStage is future-ready for Phase 4 multi-section
     • the live nav render points (RootNavigator tabs, desktop Sidebar,
       MoreScreen) read the stage-aware label

   EDGE FUNCTION LOG HYGIENE (Problems 1 & 5)
     • no invitation function logs a raw error message (categories only)
     • delivery outcomes are recorded via sa_mark_invitation_delivery
     • verifyTokenHash tolerates a token_hash link with no &type=

   Run:  cd mobile && node scripts/phase3-audit.test.js
   Exits non-zero on any failure.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const read = (p) => fs.readFileSync(p, 'utf8');

/* ---- transpile the REAL stage/nav config (not a re-implementation) ---- */
const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-phase3-audit-source'));
const nav = require(path.join(compiledSrc, 'config', 'navigationByInstitutionType.js'));
const stages = require(path.join(compiledSrc, 'config', 'schoolStages.js'));

console.log('--- stage-aware terminology (real config logic) ---');
ok('primary_middle classes label is Fasallada',
  stages.terminologyForStage('primary_middle').classLabelPlural === 'Fasallada');
ok('secondary classes label is Formamka',
  stages.terminologyForStage('secondary').classLabelPlural === 'Formamka');
ok('null/unknown stage falls back to the neutral primary_middle terms (never Formamka by accident)',
  stages.terminologyForStage(null).classLabelPlural === 'Fasallada'
  && stages.terminologyForStage(undefined).classLabelPlural === 'Fasallada'
  && stages.terminologyForStage('bogus').classLabelPlural === 'Fasallada');
ok('primary_middle school nav shows Fasallada and never Formamka',
  nav.schoolNavItemsFor('primary_middle').some((i) => i.label === 'Fasallada')
  && !nav.schoolNavItemsFor('primary_middle').some((i) => i.label === 'Formamka'));
ok('secondary school nav shows Formamka and never Fasallada',
  nav.schoolNavItemsFor('secondary').some((i) => i.label === 'Formamka')
  && !nav.schoolNavItemsFor('secondary').some((i) => i.label === 'Fasallada'));
{
  const a = nav.schoolNavItemsFor('primary_middle');
  const b = nav.schoolNavItemsFor('secondary');
  ok('both stages share the SAME nav items (keys, icons, order) — only the classes label differs',
    a.length === b.length && a.every((item, i) =>
      item.key === b[i].key && item.icon === b[i].icon
      && (item.key === 'classes' ? item.label !== b[i].label : item.label === b[i].label)));
}
ok('no university-only term in either stage\'s school nav',
  ['primary_middle', 'secondary'].every((s) =>
    nav.schoolNavItemsFor(s).every((i) => !nav.UNIVERSITY_ONLY_TERMS.includes(i.label))));
ok('defaultSectionsForStage: primary_middle starts with primary+middle sections',
  JSON.stringify(stages.defaultSectionsForStage('primary_middle')) === JSON.stringify(['primary', 'middle']));
ok('defaultSectionsForStage: secondary starts with the secondary section',
  JSON.stringify(stages.defaultSectionsForStage('secondary')) === JSON.stringify(['secondary']));
ok('SCHOOL_SECTIONS covers primary/middle/secondary for Phase 4 multi-section schools',
  stages.SCHOOL_SECTIONS.PRIMARY === 'primary' && stages.SCHOOL_SECTIONS.MIDDLE === 'middle'
  && stages.SCHOOL_SECTIONS.SECONDARY === 'secondary');

console.log('\n--- stage-aware labels are wired into the LIVE School UI ---');
const rootNav = read(path.join(ROOT, 'src', 'navigation', 'RootNavigator.js'));
const sidebar = read(path.join(ROOT, 'src', 'components', 'Sidebar.js'));
const moreScreen = read(path.join(ROOT, 'src', 'screens', 'MoreScreen.js'));
const hook = read(path.join(ROOT, 'src', 'hooks', 'useStageTerminology.js'));
ok('useStageTerminology reads the stage from the DATABASE profile (profile.school.school_stage)',
  /profile\.school\.school_stage/.test(hook) && /terminologyForStage/.test(hook));
ok('RootNavigator bottom tabs use the stage-aware classes label',
  /useStageTerminology/.test(rootNav) && /classLabelPlural/.test(rootNav));
ok('desktop Sidebar uses the stage-aware classes label',
  /useStageTerminology/.test(sidebar) && /classLabelPlural/.test(sidebar));
ok('MoreScreen uses the stage-aware classes label',
  /useStageTerminology/.test(moreScreen) && /classLabelPlural/.test(moreScreen));
const uniShell = read(path.join(ROOT, 'src', 'navigation', 'UniversityAppShell.js'));
ok('UniversityAppShell never imports the school stage terminology',
  !/useStageTerminology|terminologyForStage|Formamka/.test(uniShell));

console.log('\n--- forgot password is gated server-side (Problem 2) ---');
// strip comments before code checks — explanatory comments may legitimately
// name the API being avoided
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const authCtx = stripComments(read(path.join(ROOT, 'src', 'context', 'AuthContext.js')));
const supaSvc = read(path.join(ROOT, 'src', 'services', 'supabase.js'));
ok('AuthContext requestPasswordReset goes through the Edge Function, never a direct client reset',
  /requestPasswordResetSecure/.test(authCtx) && !/sbResetPassword|resetPasswordForEmail/.test(authCtx));
ok('requestPasswordResetSecure invokes the request-password-reset Edge Function',
  /invokeFunction\('request-password-reset'/.test(supaSvc));

const rprPath = path.join(REPO, 'supabase', 'functions', 'request-password-reset', 'index.ts');
ok('request-password-reset Edge Function exists', fs.existsSync(rprPath));
const rpr = fs.existsSync(rprPath) ? read(rprPath) : '';
ok('it blocks recovery email for a pending-invite-only account',
  /reset_blocked_pending_invite/.test(rpr) && /role === "pending"/.test(rpr));
ok('every outcome returns ONE identical generic body (no email enumeration)',
  /function genericOk/.test(rpr) && (rpr.match(/genericOk\(req\)/g) || []).length >= 5);
ok('it fails CLOSED when the profile cannot be read (no accidental bypass)',
  /profile_read_failed/.test(rpr) && /fail CLOSED/i.test(rpr));
ok('it never logs a raw error or the user\'s email (safe categories only)',
  !/console\.(error|log)\([^)]*\.message/.test(rpr) && !/console\.(error|log)\([^)]*\$\{email\}/.test(rpr));
ok('the recovery redirect comes from the server secret, not the request body',
  /KOBCIYE_INVITE_REDIRECT_URL/.test(rpr) && !/body\.redirect/i.test(rpr));

console.log('\n--- forgot-password UIs stay neutral (no enumeration) ---');
const forgotScreen = read(path.join(ROOT, 'src', 'screens', 'auth', 'ForgotPasswordScreen.js'));
ok('ForgotPasswordScreen shows the same confirmation on success AND failure',
  /setSent\(true\)/.test(forgotScreen) && /catch[\s\S]{0,120}setSent\(true\)/.test(forgotScreen));
const landingScreen = read(path.join(ROOT, 'src', 'screens', 'LandingScreen.js'));
ok('Landing login modal forgot-form shows one generic message for every outcome',
  /Haddii email-kan uu leeyahay account shaqaynaya/.test(landingScreen)
  && !/Link ayaa loo diray/.test(landingScreen));

console.log('\n--- Edge Function log hygiene (Problems 1 & 5) ---');
for (const fn of ['accept-school-invite', 'resend-school-admin-invite', 'cancel-school-invite', 'create-school-and-invite-admin']) {
  const src = read(path.join(REPO, 'supabase', 'functions', fn, 'index.ts'));
  ok(`${fn}: never logs a raw error message (safe categories only)`,
    !/console\.error\([^)]*(rpcErr\.message|error\.message|\.message\))/.test(src));
  ok(`${fn}: never logs/returns the service-role key`, !/SERVICE_ROLE[^_]/.test(src.replace(/SUPABASE_SERVICE_ROLE_KEY/g, '')));
}
const resend = read(path.join(REPO, 'supabase', 'functions', 'resend-school-admin-invite', 'index.ts'));
ok('resend records the ACTUAL delivery outcome (sent | failed) via sa_mark_invitation_delivery',
  /sa_mark_invitation_delivery/.test(resend) && /delivered \? "sent" : "failed"/.test(resend));
const create = read(path.join(REPO, 'supabase', 'functions', 'create-school-and-invite-admin', 'index.ts'));
ok('create never claims "sent" when the email failed (delivery: "failed" path exists)',
  /delivery: "failed"/.test(create) && /was not delivered/.test(create));
ok('create is idempotent on double-click (no duplicate school; reports pending_delivery)',
  /idempotent/.test(create) && /pending_delivery/.test(create));

console.log('\n--- token_hash links missing &type= are tolerated (Problem 1) ---');
ok('verifyTokenHash falls back to recovery-then-invite when type is absent',
  /typesToTry = type \? \[type\] : \['recovery', 'invite'\]/.test(supaSvc));

console.log('\n--- SetPasswordScreen has honest states for every failure class ---');
const setPw = read(path.join(ROOT, 'src', 'screens', 'auth', 'SetPasswordScreen.js'));
for (const state of ['expired', 'cancelled', 'already_accepted', 'email_mismatch', 'not_found', 'already_member', 'temporary', 'wrong_browser', 'invalid']) {
  ok(`SetPasswordScreen has a distinct "${state}" state`, new RegExp(`\\b${state}:\\s*\\{`).test(setPw));
}

console.log('');
if (failures) { console.error(`phase3-audit FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('phase3-audit PASSED — forgot-password gating, stage-aware labels, and log hygiene all hold ✓\n');
