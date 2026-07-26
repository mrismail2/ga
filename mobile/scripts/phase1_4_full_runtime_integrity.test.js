#!/usr/bin/env node
/* Kobciye Phase 1–4 full source/runtime integrity audit.
   Pure Node checks: no network, browser, remote Supabase, or destructive action. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let failures = 0;
const ok = (name, condition) => {
  console.log(condition ? 'PASS' : 'FAIL', name);
  if (!condition) failures += 1;
};
const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..');
const read = (rel, base = root) => fs.readFileSync(path.join(base, rel), 'utf8');
const sha = (rel, base = root) => crypto.createHash('sha256').update(fs.readFileSync(path.join(base, rel))).digest('hex');

const nav = read('src/domain/navigationPolicy.js');
const rootNav = read('src/navigation/RootNavigator.js');
const more = read('src/screens/MoreScreen.js');
const sidebar = read('src/components/Sidebar.js');
const role = read('src/context/RoleContext.js');
const app = read('App.js');
const classDetail = read('src/screens/ClassDetailScreen.js');
const students = read('src/screens/StudentsScreen.js');
const classes = read('src/screens/ClassesScreen.js');
const dashboards = read('src/screens/dashboards/RoleDashboards.js');
const liveDashboard = read('src/services/liveDashboard.js');
const p4View = read('src/components/P4ModuleView.js');
const phase4 = read('src/services/phase4.js');
const modules = read('src/config/phase4Modules.js');
const lessonsContext = read('src/context/LessonsContext.js');
const lessonsScreen = read('src/screens/LessonsScreen.js');
const messages = read('src/screens/MessagesScreen.js');
const messaging = read('src/services/messaging.js');
const canonical = read('src/hooks/useCanonicalRows.js');
const migration = read('migrations/20260725000001_phase1_4_runtime_integrity.sql', path.join(repo, 'supabase'));
const supabaseService = read('src/services/supabase.js');
const universityShell = read('src/navigation/UniversityAppShell.js');
const schoolContext = read('src/context/SchoolContext.js');

console.log('\n[1] Live navigation boundary (Phase 5 revealed)');
// Phase 5 is now implemented and Supabase-backed, so these modules ARE part
// of the Live navigation (§15 "reveal a menu item only after its workflow is
// implemented"). `billing` remains a later-phase item and stays excluded.
for (const key of ['attendance','finance','exams','results','incidents','reports','jadwal','assignments','notifications']) {
  ok(`Live navigation now includes ${key} (Phase 5 revealed)`,
    new RegExp(`LIVE_NAV_KEYS[\\s\\S]{0,2000}['\"]${key}['\"]`).test(nav));
}
ok('Live navigation still excludes the later-phase billing key',
  !new RegExp(`LIVE_NAV_KEYS[\\s\\S]{0,2000}['\"]billing['\"]`).test(nav));
ok('RootNavigator filters every Live stack route through policy', /stackEntries[\s\S]{0,160}canAccessLiveRoute/.test(rootNav));
ok('More and Sidebar apply the same Live navigation policy', /canRoleNavigate/.test(more) && /canRoleNavigate/.test(sidebar));
ok('Class Detail Live tabs remain Ardayda-only', /const LIVE_TABS = \['Ardayda'\]/.test(classDetail));

console.log('\n[2] No fake/local Phase 5 data in Live Mode');
ok('Live School/Admin/Teacher/Parent/Student dashboards return before demo branches',
  (dashboards.match(/if \(isLive(?: \|\| profile\.live)?\) \{/g) || []).length >= 6);
ok('Live accountant dashboard declares finance as Phase 5 instead of showing fake totals',
  /if \(isLive\)[\s\S]{0,260}Qaybta Maaliyadda waxay bilaabmaysaa Phase 5/.test(dashboards));
ok('Live dashboard services read canonical Supabase tables', /supabase\.from\('student_enrollments'\)/.test(liveDashboard) && /myTeacherAssignments/.test(liveDashboard));
ok('Class Detail blocks local attendance reads in Live Mode',
  /if \(isLive \|\| !clsSchoolId \|\| !clsClassId\)/.test(classDetail)
  && /if \(isLive \|\| !readOnly \|\| !clsSchoolId\)/.test(classDetail));
ok('Live Ministry review code/card is suppressed',
  /reviewCode: isLive \? null : REVIEW_CODE/.test(lessonsContext)
  && /!isLive && reviewCode/.test(lessonsScreen));

console.log('\n[3] Tenant and role safety');
ok('Live DB role is never persisted as a demo role',
  /setRole\(roleKey, \{ persist: false \}\)/.test(app)
  && /options\.persist !== false/.test(role));
ok('Late AsyncStorage role cannot overwrite an installed live identity',
  /liveIdentityRef/.test(role) && /!liveIdentityRef\.current/.test(role));
ok('Canonical rows require a valid UUID and clear stale rows',
  /enabled && isUuid\(schoolId\)/.test(canonical)
  && /reload\(\{ clear: true \}\)/.test(canonical)
  && /requestSeq\.current === requestId/.test(canonical));
ok('Super Admin School Mode selector excludes university institutions and clears stale rows on failure',
  /filter\(\(s\) => s\.institution_type === 'school'\)/.test(schoolContext)
  && /catch \(e\)[\s\S]{0,220}setSuperSchools\(\[\]\)/.test(schoolContext));
ok('Messages and lessons use active school hook, not raw profile school',
  /useActiveSchoolId/.test(messages) && /useActiveSchoolId/.test(lessonsContext)
  && !/liveProfile\.school_id/.test(messages) && !/profile\.school_id/.test(lessonsContext));
ok('Message service validates school UUID and asserts conversation school',
  /requireSchoolUuid/.test(messaging) && /assertConversationInSchool/.test(messaging));

console.log('\n[4] Student, admission and enrollment integrity');
ok('Student list is derived from active enrollments',
  /useCanonicalRows\('student_enrollments'/.test(students) && /activeByStudent/.test(students));
ok('Class counts and roster are derived from active enrollments',
  /useCanonicalRows\('student_enrollments'/.test(classes) && /useCanonicalRows\('student_enrollments'/.test(classDetail));
ok('Student class and academic year are required in module config',
  /key: 'class_id'[\s\S]{0,140}required: true/.test(modules)
  && /key: 'academic_year_id'[\s\S]{0,140}required: true/.test(modules));
ok('Student editor uses a dedicated atomic RPC without creating admissions',
  /save_student_with_enrollment_atomic/.test(phase4)
  && !/p4SaveStudentWithEnrollment[\s\S]{0,750}admit_student_atomic/.test(phase4));
ok('Form blocks missing/invalid class-year before writing',
  /p4ValidateEnrollmentSelection/.test(p4View)
  && /if \(enrollmentErr\)[\s\S]{0,80}return/.test(p4View));
ok('Admissions cannot downgrade an already-enrolled row',
  /cannot be downgraded|cannot be silently downgraded|enrolled admission cannot be downgraded/i.test(migration));
ok('Database guard requires active enrollment class and year',
  /active enrollment requires a class/.test(migration)
  && /active enrollment requires an academic year/.test(migration));
ok('Database guard validates class/year/stream relationships',
  /class does not belong to the selected academic year/.test(migration)
  && /stream does not belong to the selected class/.test(migration));
ok('Teacher assignment guard validates subject/class/stream/term/year relationships',
  /subject does not belong to the selected class/.test(migration)
  && /term does not belong to the selected academic year/.test(migration));
ok('Admission retry reuses guardian/link and safely updates metadata',
  /update parents set email = coalesce/.test(migration)
  && /Idempotent retry/.test(migration)
  && /x\.id<>v_link/.test(migration));

console.log('\n[5] Honest loading, failure and success states');
ok('P4 save prevents duplicate clicks and keeps normalized errors visible',
  /if \(saving\) return/.test(p4View)
  && /disabled=\{saving\}/.test(p4View)
  && /setFormErr\(p4FriendlyError\(e\)\)/.test(p4View));
ok('P4 successful student/admission saves show Somali confirmation',
  /Ardayga si guul leh ayaa loo kaydiyey/.test(p4View)
  && /Diiwaangelinta ardayga waa la dhammeeyey/.test(p4View));
ok('Foreign-key network/RLS failures are not mislabeled as empty data',
  /fkErrors/.test(p4View)
  && /Doorashooyinka lama soo dejin karin/.test(p4View)
  && /Isku day mar kale/.test(p4View));
ok('Teacher assignment failures are visible and retryable',
  /assignmentError/.test(lessonsScreen)
  && /loadAssignments/.test(lessonsScreen)
  && /Isku day mar kale/.test(lessonsScreen));
ok('Message and lesson requests ignore stale school responses',
  /convRequestSeq/.test(messages) && /threadRequestSeq/.test(messages)
  && /requestSeq/.test(lessonsContext));
ok('Dashboard errors are shown instead of silently becoming truthful-looking zeroes',
  /Dugsiyada lama soo dejin karin/.test(dashboards)
  && /Tirooyinka dugsiga lama soo dejin karin/.test(dashboards)
  && /Tirooyinka jaamacadda lama soo dejin karin/.test(dashboards));
ok('Count services throw query failures instead of converting them to zero',
  /if \(error\) throw error;[\s\S]{0,100}out\[t\] = count \|\| 0/.test(phase4)
  && /getSchoolCounts[\s\S]{0,1800}if \(error\) throw error/.test(supabaseService));
ok('Class creation does not swallow active-year or section load failures',
  /p4ActiveAcademicYear\(schoolId\),/.test(phase4)
  && /p4List\('school_sections', schoolId, \{ activeOnly: true \}\),/.test(phase4)
  && !/p4ActiveAcademicYear\(schoolId\)\.catch/.test(phase4));
ok('University dashboard distinguishes loading/error from genuine zero counts',
  /countState/.test(universityShell)
  && /p4FriendlyError/.test(universityShell)
  && /Tirooyinka jaamacadda waa la soo dejinayaa/.test(universityShell)
  && /Isku day mar kale/.test(universityShell));
ok('Super Admin invitation failures are not silently hidden',
  /Promise\.all\(\[listSchools\(\), listInvitations\(\)\]\)/.test(dashboards));

console.log('\n[6] Preserved owner-approved UI and packaging boundaries');
ok('LoadingScreen owner-approved UI is byte-for-byte preserved',
  sha('src/screens/LoadingScreen.js') === '4af7924482d30f3d4e89d69fb51a5ad72a201415e563e04f616126eb0a6e9a08');
ok('ForgotPasswordScreen owner-approved UI is byte-for-byte preserved',
  sha('src/screens/auth/ForgotPasswordScreen.js') === 'd8541ca7a1eed09acf3d85e02b05e2c3c253b20aa5825b0800e0264a99178073');
ok('Approved landing page is byte-for-byte preserved',
  sha('landing/index.html', repo) === '3b32468dbc15624027b69346fb73296f92093aabe45d1593389f1f807c7d5f58');
ok('No runtime code contains a service-role secret',
  !/SUPABASE_SERVICE_ROLE|service_role_key/i.test([
    p4View, phase4, messages, messaging, lessonsContext, lessonsScreen, liveDashboard,
  ].join('\n')));
ok('No runtime source or configuration invokes supabase db reset', (() => {
  const roots = [path.join(repo, 'mobile', 'src'), path.join(repo, 'landing'), path.join(repo, 'supabase', 'functions')];
  const files = [path.join(repo, 'mobile', 'package.json'), path.join(repo, 'supabase', 'config.toml')];
  for (const base of roots) {
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (['node_modules','.expo','dist','build','coverage'].includes(entry.name)) continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (/\.(js|jsx|ts|tsx|json|sql|html|css|toml|ya?ml)$/.test(entry.name)) files.push(full);
      }
    }
  }
  return files.every((file) => !fs.existsSync(file) || !/supabase\s+db\s+reset/.test(fs.readFileSync(file, 'utf8')));
})());

console.log(failures === 0
  ? '\nphase1_4_full_runtime_integrity: all assertions passed'
  : `\nphase1_4_full_runtime_integrity: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
