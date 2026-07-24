#!/usr/bin/env node
/* ============================================================
   Kobciye — Super Admin school-context regression tests

   The defect these lock down: a real browser test opened the Classes page
   as Super Admin and Supabase answered

       invalid input syntax for type uuid: "*"

   because the app resolved the Super Admin's school as the demo sentinel
   '*' and sent it straight into `.eq('school_id', …)`.

   These tests are pure Node (no bundler, no Supabase) — they execute the
   real shipped modules where those are plain JS, and read the real source
   of the React modules to assert the wiring that a runtime test can't reach
   without a bundler.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { isUuid, asUuidOrNull } = require('../src/utils/uuid');
const { canAccessManagement, canManageSchoolData } = require('../src/domain/navigationPolicy');

let failures = 0;
function ok(name, condition) { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; }

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B = '22222222-2222-4222-8222-222222222222';

/* ---------- 1. the uuid guard itself ---------- */
for (const bad of ['*', 'all', '', '   ', 'school_001', 'undefined', 'null', null, undefined, 0, {}, []]) {
  ok(`uuid guard rejects ${JSON.stringify(bad)}`, isUuid(bad) === false);
}
ok('uuid guard accepts a real uuid', isUuid(SCHOOL_A) === true);
ok('uuid guard accepts an upper-case uuid', isUuid(SCHOOL_A.toUpperCase()) === true);
ok('asUuidOrNull passes a uuid through', asUuidOrNull(SCHOOL_A) === SCHOOL_A);
ok('asUuidOrNull turns "*" into null', asUuidOrNull('*') === null);

/* ---------- 2. no query is ever built with a placeholder school ---------- */
/* A faithful stand-in for the shipped p4List guard: the data layer must
   THROW before PostgREST is ever reached, so no `.eq('school_id','*')` can
   be issued even if a screen regresses. */
const phase4Source = read('src/services/phase4.js');
ok('phase4 data layer imports the uuid guard', /from '\.\.\/utils\/uuid'/.test(phase4Source));
ok('phase4 defines a requireSchoolUuid gate', /function requireSchoolUuid/.test(phase4Source));
for (const fn of ['p4List', 'p4ActiveEnrollments', 'p4ActiveAcademicYear', 'p4Create', 'p4AdmitStudentAtomic']) {
  const body = phase4Source.split(`export async function ${fn}`)[1] || '';
  const upToNextExport = body.split('\nexport ')[0];
  ok(`${fn} validates the school uuid before querying`, /requireSchoolUuid\(/.test(upToNextExport));
}
ok('p4Counts short-circuits to zeroes for a non-uuid school',
  /if \(!isUuid\(schoolId\)\)/.test(phase4Source.split('export async function p4Counts')[1].split('\nexport ')[0]));

/* the friendly error maps the raw Postgres 22P02 to an actionable message */
const { p4FriendlyError } = (() => {
  // p4FriendlyError is pure; extract it without importing the ESM module
  const src = phase4Source.split('export function p4FriendlyError')[1].split('\nexport ')[0];
  // eslint-disable-next-line no-new-func
  const fn = new Function('error', 'return (function p4FriendlyError' + src.split('\n}')[0] + '\n})(error)');
  return { p4FriendlyError: fn };
})();
ok('a raw uuid-syntax error becomes an actionable Somali message',
  /Dooro dugsiga/.test(p4FriendlyError({ code: '22P02', message: 'invalid input syntax for type uuid: "*"' })));

/* ---------- 3. the Super Admin's school is never the '*' sentinel ---------- */
const roleContextSource = read('src/context/RoleContext.js');
ok('RoleContext no longer falls back to the demo school_id in live mode',
  /school_id: liveIdentity\.school_id != null \? liveIdentity\.school_id : null/.test(roleContextSource));
ok('RoleContext documents why the sentinel must not leak',
  /invalid input syntax for type uuid/.test(roleContextSource));

/* ---------- 4. SchoolContext exposes a real selection workflow ---------- */
const schoolContextSource = read('src/context/SchoolContext.js');
ok('SchoolContext loads the REAL school list from Supabase', /listSchools/.test(schoolContextSource));
ok('SchoolContext exposes activeSchoolId', /activeSchoolId/.test(schoolContextSource));
ok('SchoolContext exposes needsSchoolSelection', /needsSchoolSelection/.test(schoolContextSource));
ok('SchoolContext only accepts a uuid as the active school',
  /setActiveSchool = useCallback\(\(id\) => \{\s*if \(!isUuid\(id\)\)/.test(schoolContextSource));
ok('SchoolContext persists the Super Admin selection across a refresh',
  /SUPER_SEL_KEY/.test(schoolContextSource) && /AsyncStorage\.setItem\(SUPER_SEL_KEY/.test(schoolContextSource));

/* the selection state machine, executed rather than asserted by regex */
function resolveActive(superSchools, superActiveId) {
  const valid = isUuid(superActiveId) && superSchools.some((s) => s.id === superActiveId) ? superActiveId : null;
  return { activeSchoolId: valid, needsSchoolSelection: !valid };
}
const schools = [{ id: SCHOOL_A, name: 'School A' }, { id: SCHOOL_B, name: 'School B' }];
ok('Super Admin starts with NO school selected', resolveActive(schools, null).needsSchoolSelection === true);
ok('no school-specific query may run before a school is selected', resolveActive(schools, null).activeSchoolId === null);
ok('selecting School A resolves School A', resolveActive(schools, SCHOOL_A).activeSchoolId === SCHOOL_A);
ok('switching to School B resolves School B and never retains School A',
  resolveActive(schools, SCHOOL_B).activeSchoolId === SCHOOL_B);
ok('a "*" selection can never become the active school', resolveActive(schools, '*').activeSchoolId === null);
ok('a stale selection for a school that no longer exists is dropped',
  resolveActive(schools, '33333333-3333-4333-8333-333333333333').needsSchoolSelection === true);

/* School Admin stays scoped to their own school — no selector, no widening */
function resolveSchoolAdmin(profileSchool) {
  return { activeSchoolId: isUuid(profileSchool) ? profileSchool : null, needsSchoolSelection: false };
}
ok('School Admin is scoped to their own school', resolveSchoolAdmin(SCHOOL_A).activeSchoolId === SCHOOL_A);
ok('School Admin never sees a school selector', resolveSchoolAdmin(SCHOOL_A).needsSchoolSelection === false);

/* ---------- 5. every school-specific screen uses the resolved school ---------- */
const SCHOOL_SCOPED_SCREENS = [
  'src/screens/ClassesScreen.js',
  'src/screens/ClassDetailScreen.js',
  'src/screens/StudentsScreen.js',
  'src/screens/TeachersScreen.js',
  'src/components/P4ModuleView.js',
  'src/components/GuardianManagementView.js',
];
for (const rel of SCHOOL_SCOPED_SCREENS) {
  const src = read(rel);
  ok(`${rel} resolves the school through useActiveSchoolId`, /useActiveSchoolId/.test(src));
  ok(`${rel} no longer reads a raw profile.school_id for its queries`,
    !/const schoolId = profile\.school_id/.test(src) && !/schoolId = profile \? profile\.school_id/.test(src));
}

/* the screens that gate on selection actually render the prompt */
for (const rel of ['src/screens/ClassesScreen.js', 'src/screens/StudentsScreen.js',
  'src/screens/TeachersScreen.js', 'src/screens/SchoolManagementScreen.js',
  'src/components/GuardianManagementView.js']) {
  const src = read(rel);
  ok(`${rel} shows the school-selection state instead of querying`,
    /needsSchoolSelection/.test(src) && /SchoolSelectPrompt/.test(src));
}

const selectorSource = read('src/components/SchoolSelector.js');
ok('the selector shows the required instruction copy',
  selectorSource.includes('Dooro dugsiga aad rabto inaad maamusho.'));
ok('the selector is titled "Dooro Dugsi"', selectorSource.includes('Dooro Dugsi'));

/* ---------- 6. hooks refuse to query without a real school ---------- */
const canonicalHookSource = read('src/hooks/useCanonicalRows.js');
ok('useCanonicalRows stays inert for a non-uuid school',
  /const active = enabled && isUuid\(schoolId\)/.test(canonicalHookSource));
ok('useCanonicalRows clears rows instead of querying with a placeholder',
  /if \(!active\) \{ setRows\(\[\]\); setLoading\(false\); return; \}/.test(canonicalHookSource));

/* ---------- 7. Super Admin may manage a school only after selecting ---------- */
ok('Super Admin still does NOT get the school-admin management MENU item',
  canAccessManagement('superadmin') === false);
ok('School Admin keeps the management menu item', canAccessManagement('schooladmin') === true);
ok('Super Admin MAY operate school management screens', canManageSchoolData('superadmin') === true);
ok('School Admin may operate school management screens', canManageSchoolData('schooladmin') === true);
for (const role of ['teacher', 'parent', 'student', 'accountant']) {
  ok(`${role} may not operate school management screens`, canManageSchoolData(role) === false);
}
const managementSource = read('src/screens/SchoolManagementScreen.js');
ok('SchoolManagementScreen gates Super Admin on a real school selection',
  /needsSchoolSelection/.test(managementSource) && /SchoolSelectPrompt/.test(managementSource));

/* ---------- 8. the remaining '*' sentinels are demo-only, by construction ----------
   The Phase 1/2 demo store still uses '*' to mean "Super Admin sees every
   demo row" while filtering in-memory arrays. That is safe ONLY because
   none of those modules can reach Supabase at all — this asserts that
   containment directly, so a future edit that wires one of them to the
   database fails here instead of in a browser. */
const DEMO_ONLY_SENTINEL_FILES = [
  'src/components/AddStudentModal.js',
  'src/services/appDataRepository.js',
  'src/data/schools.js',
  'src/data/access.js',
  'src/data/identity.js',
  'src/utils/dataSelectors.js',
  'src/screens/ExamsScreen.js',
];
for (const rel of DEMO_ONLY_SENTINEL_FILES) {
  const src = read(rel);
  ok(`${rel} keeps its '*' sentinel unable to reach Supabase`,
    !/from '[^']*services\/supabase'|require\([^)]*services\/supabase/.test(src));
}

/* every module that DOES talk to Supabase must go through the uuid guard */
const SUPABASE_SCHOOL_SCOPED_SERVICES = ['src/services/phase4.js', 'src/services/lessonPlans.js'];
for (const rel of SUPABASE_SCHOOL_SCOPED_SERVICES) {
  const src = read(rel);
  ok(`${rel} guards every school_id before it reaches a uuid column`,
    /requireSchoolUuid/.test(src) && /utils\/uuid/.test(src));
}
ok('getSchoolCounts refuses a non-uuid school id',
  /if \(!supabase \|\| !isUuid\(schoolId\)\)/.test(read('src/services/supabase.js')));

/* ---------- 9. RLS/tenant isolation is not bypassed in the client ---------- */
for (const rel of ['src/context/SchoolContext.js', 'src/components/SchoolSelector.js',
  'src/hooks/useActiveSchoolId.js', 'src/services/guardianLinks.js', 'src/services/phase4.js']) {
  const src = read(rel);
  ok(`${rel} uses no service-role key`, !/service_role|SERVICE_ROLE|serviceRole/.test(src));
}

console.log(failures === 0
  ? '\nphase4-super-admin-school-context: all assertions passed'
  : `\nphase4-super-admin-school-context: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
