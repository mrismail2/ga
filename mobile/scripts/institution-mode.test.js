#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 3 foundation: School Mode vs University Mode
   (institution_type / school_stage) — mobile-side structural suite

   Static, reproducible (no app boot, no network) — proves the specific
   routing/config/terminology-isolation invariants a runtime UI test would
   check, by asserting the shipped source directly (same convention as
   onboarding-guards.test.js / password-reset-routing.test.js).

   Covers:
     3. Super Admin registration requires institution_type (client gate)
     4. Selecting Dugsi requires school_stage
     5. Selecting Jaamacad does not require school_stage
     6. Invalid values are rejected by the Edge Function (DB-level coverage
        is in supabase/tests/institution_type.test.js)
     7/8/9. school + primary_middle AND school + secondary route to the
        SAME shared SchoolAppShell (RootNavigator) — there is no separate
        branch keyed on school_stage anywhere in the routing decision
    10. University routes ONLY to UniversityAppShell
    11. University UI never displays School Mode terminology/navigation
    12. School UI never displays University-only terminology/navigation
    13. No client code path can write institution_type/school_stage (the
        DB guard trigger is the enforcement layer — SQL-tested separately)

   Run:  cd mobile && node scripts/institution-mode.test.js
         (or: npm run test:institution-mode)
   Exits non-zero on any failure.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const read = (p) => fs.readFileSync(p, 'utf8');
const code = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const onboarding = code(path.join(ROOT, 'src', 'screens', 'SchoolOnboardingScreen.js'));
const appJs = code(path.join(ROOT, 'App.js'));
const rootNav = code(path.join(ROOT, 'src', 'navigation', 'RootNavigator.js'));
const desktopShell = code(path.join(ROOT, 'src', 'components', 'DesktopShell.js'));
const uniShell = code(path.join(ROOT, 'src', 'navigation', 'UniversityAppShell.js'));
const edgeFn = code(path.join(REPO, 'supabase', 'functions', 'create-school-and-invite-admin', 'index.ts'));
const supabaseSvc = code(path.join(ROOT, 'src', 'services', 'supabase.js'));
const { SHELLS, resolveInstitutionShell } = require(path.join(ROOT, 'src', 'domain', 'institutionRouting.js'));

console.log('\n[3/4/5] Super Admin registration: institution_type required, school_stage conditionally required');

ok('the form reads its options from the central config (not hardcoded strings)',
  /INSTITUTION_TYPE_OPTIONS/.test(onboarding) && /SCHOOL_STAGE_OPTIONS/.test(onboarding));

ok('institutionType must be a valid value before submit is allowed',
  /isValidInstitutionType\(f\.institutionType\)/.test(onboarding));

ok('when institutionType is university, school_stage is NOT required',
  /f\.institutionType === INSTITUTION_TYPES\.UNIVERSITY\s*\n?\s*\?\s*true/.test(onboarding));

ok('when institutionType is anything else (school), school_stage must be a valid stage',
  /isValidSchoolStage\(f\.schoolStage\)/.test(onboarding));

ok('the Heerka Dugsiga picker only renders when Nooca Hay\'adda === school',
  /f\.institutionType === INSTITUTION_TYPES\.SCHOOL \? \(/.test(onboarding));

ok('the submit button is disabled until BOTH institution and (if applicable) stage are valid',
  /disabled=\{submitting \|\| !canSubmitInstitution\}/.test(onboarding));

ok('canSubmitInstitution requires both institutionValid AND schoolStageValid',
  /canSubmitInstitution = institutionValid && schoolStageValid/.test(onboarding));

ok('the real create call sends institutionType/schoolStage to the Edge Function',
  /createSchoolAndInvite\(\{[\s\S]{0,400}institutionType: f\.institutionType/.test(onboarding));

console.log('\n[6] Edge Function rejects invalid institution_type / school_stage combinations');

ok('Edge Function rejects a missing/invalid institution_type',
  /institutionType !== "school" && institutionType !== "university"/.test(edgeFn));
ok('Edge Function requires a valid school_stage when institution_type is school',
  /institutionType === "school" && schoolStage !== "primary_middle" && schoolStage !== "secondary"/.test(edgeFn));
ok('Edge Function rejects a school_stage when institution_type is university',
  /institutionType === "university" && schoolStage !== null/.test(edgeFn));
ok('Edge Function forwards both fields to the RPC (defense in depth with the DB check)',
  /p_institution_type: institutionType, p_school_stage: schoolStage/.test(edgeFn));

console.log('\n[7/8/9/10] Safe routing: school (any stage) -> shared SchoolAppShell; university -> UniversityAppShell only');

ok('App.js imports UniversityAppShell as a separate component',
  /import UniversityAppShell from '\.\/src\/navigation\/UniversityAppShell'/.test(appJs));

ok('institution routing runs only AFTER the pending-role gate (never routes before role is known)',
  (() => {
    const pendingIdx = appJs.indexOf("auth.roleKey === 'pending'");
    const instIdx = appJs.indexOf('const shell = resolveInstitutionShell');
    return pendingIdx !== -1 && instIdx !== -1 && pendingIdx < instIdx;
  })());

const ready = (institution_type, school_stage) => ({ authStatus: 'signed_in', profileStatus: 'ready', roleKey: 'schooladmin', profile: { school: { institution_type, school_stage } } });
ok('school primary_middle resolves to the shared SchoolAppShell', resolveInstitutionShell(ready('school', 'primary_middle')) === SHELLS.SCHOOL);
ok('school secondary resolves to the same shared SchoolAppShell', resolveInstitutionShell(ready('school', 'secondary')) === SHELLS.SCHOOL);
ok('university + null stage resolves only to UniversityAppShell', resolveInstitutionShell(ready('university', null)) === SHELLS.UNIVERSITY);
ok('unclassified institutions resolve to a safe state', resolveInstitutionShell(ready(null, null)) === SHELLS.UNCLASSIFIED);

ok('UniversityAppShell is rendered in exactly one place in App.js',
  (appJs.match(/<UniversityAppShell/g) || []).length === 1);

ok('App.js never branches on school_stage — primary_middle and secondary cannot reach a different shell',
  !/school_stage/i.test(appJs) && !/schoolStage/.test(appJs));

ok('platform/demo routing still retains the existing RootNavigator explicitly', /<RootNavigator \/>/.test(appJs));
ok('unclassified routing renders the safe institution state instead of RootNavigator', /kind="unclassified"/.test(appJs));

console.log('\n[11] University UI never displays School Mode terminology/navigation');

const SCHOOL_ONLY_FORBIDDEN = [
  'Fasallada', 'Waalidiinta', 'Primary Grade', 'Secondary Form', 'Stream',
  'Class Teacher', 'School Report Card', 'School Homework',
];
for (const term of SCHOOL_ONLY_FORBIDDEN) {
  ok(`UniversityAppShell.js does not contain School Mode term "${term}"`, !uniShell.includes(term));
}

console.log('\n[12] School UI never displays University-only terminology/navigation');

const UNIVERSITY_ONLY_FORBIDDEN = ['Kulliyadaha', 'Semester', 'Transcript', 'Faculty', 'Programme', 'Cohort'];
for (const term of UNIVERSITY_ONLY_FORBIDDEN) {
  ok(`RootNavigator.js does not contain University-only term "${term}"`, !rootNav.includes(term));
  ok(`DesktopShell.js does not contain University-only term "${term}"`, !desktopShell.includes(term));
}

console.log('\n[13] No client code path can write institution_type/school_stage (DB guard trigger is SQL-tested separately)');

ok('services/supabase.js has NO write (.update/.insert) call against the schools table',
  !/\.from\('schools'\)[\s\S]{0,120}\.(update|insert|upsert|delete)\(/.test(supabaseSvc));
ok('schools table client access is limited to the two intended read-only paths (profile institution + listSchools)',
  (supabaseSvc.match(/\.from\('schools'\)/g) || []).length === 2
  && /getMyProfile\(\)[\s\S]*?\.from\('schools'\)[\s\S]*?\.select\('id, name, location, student_id_prefix, next_student_sequence, institution_type, school_stage'\)/.test(supabaseSvc)
  && /listSchools\(\)[\s\S]*?\.from\('schools'\)[\s\S]*?\.select\('id, name, slug, location, plan, status, created_at, subscriptions/.test(supabaseSvc));
ok('createSchoolAndInvite only ever CREATES (via the Edge Function), never updates an existing school',
  /invokeFunction\('create-school-and-invite-admin'/.test(supabaseSvc));

console.log('');
if (failures) { console.error(`institution-mode FAILED with ${failures} issue(s)\n`); process.exit(1); }
console.log('institution-mode PASSED — School vs University routing, terminology isolation, and registration gating all hold ✓\n');
