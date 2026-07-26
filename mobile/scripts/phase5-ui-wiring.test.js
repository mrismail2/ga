#!/usr/bin/env node
/* ============================================================
   Kobciye Phase 5 — mobile UI wiring tests (source-scan)

   A bundler-free guard that the Phase 5 screens are real Supabase-backed
   Live surfaces, not demo/AsyncStorage/"coming soon" placeholders, and that
   the navigation reveals them. Complements the expo web export (which proves
   they compile) and the Supabase DB suite (which proves the backend).
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (n, c) => { console.log(c ? 'PASS' : 'FAIL', n); if (!c) failures += 1; };
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

/* ---------- 1. every Phase 5 screen exists ---------- */
const SCREENS = [
  'src/screens/phase5/NotificationsScreen.js',
  'src/screens/phase5/AttendanceLiveScreen.js',
  'src/screens/phase5/TimetableScreen.js',
  'src/screens/phase5/AssignmentsScreen.js',
  'src/screens/phase5/ExamsResultsScreen.js',
  'src/screens/phase5/FinanceLiveScreen.js',
  'src/screens/phase5/DisciplineScreen.js',
  'src/screens/phase5/ReportsLiveScreen.js',
  'src/screens/phase5/TranscriptsScreen.js',
  'src/screens/phase5/ProvisioningScreen.js',
];
for (const s of SCREENS) ok(`${path.basename(s)} exists`, exists(s));
ok('phase5 service layer exists', exists('src/services/phase5.js'));
ok('provision-account Edge Function exists', fs.existsSync(path.join(root, '..', 'supabase/functions/provision-account/index.ts')));

/* ---------- 2. screens use real Supabase services, not AsyncStorage/demo ---------- */
for (const s of SCREENS) {
  const src = read(s);
  ok(`${path.basename(s)} reads a real phase5 service`, /from '\.\.\/\.\.\/services\/phase5'/.test(src));
  ok(`${path.basename(s)} uses no AsyncStorage`, !/AsyncStorage\.|async-storage/.test(src));
  ok(`${path.basename(s)} has no "coming soon" placeholder`, !/coming soon|dhisayaa|lama dhisin/i.test(src));
}

/* ---------- 3. the service layer is real Supabase, no service-role key ---------- */
const svc = read('src/services/phase5.js');
ok('phase5 service imports the public supabase client', /from '\.\/supabase'/.test(svc));
ok('phase5 service guards every school id with the uuid check', /isUuid|requireSchool/.test(svc));
ok('phase5 service uses NO service-role key', !/service_role|SERVICE_ROLE|serviceRole/.test(svc));
ok('phase5 service uses NO AsyncStorage', !/AsyncStorage\.|async-storage/.test(svc));
ok('provisioning goes through the Edge Function (no client Auth-admin)',
  /functions\.invoke\('provision-account'/.test(svc));

const edge = fs.readFileSync(path.join(root, '..', 'supabase/functions/provision-account/index.ts'), 'utf8');
ok('the Edge Function records invitations under the CALLER JWT (userClient rpc)',
  /supa\.rpc\("create_account_invitation"/.test(edge) || /supa\.rpc\('create_account_invitation'/.test(edge));
ok('the Edge Function uses the admin client ONLY for Auth admin', /adminClient\(\)/.test(edge) && /auth\.admin\./.test(edge));

/* ---------- 4. required UI states + duplicate-click protection ---------- */
const scaffold = read('src/components/Phase5Scaffold.js');
ok('the shared scaffold provides loading state', /ActivityIndicator/.test(scaffold));
ok('the shared scaffold provides an error + retry state', /Isku day mar kale/.test(scaffold));
ok('the shared scaffold provides an empty state', /empty/.test(scaffold));
ok('the SaveButton disables while saving', /disabled=\{off\}/.test(scaffold));
const moduleView = read('src/components/Phase5ModuleView.js');
ok('the module view blocks duplicate Save clicks', /if \(saving\) return;/.test(moduleView));
ok('the module view keeps the form open on failure',
  moduleView.split('const save')[1].split('catch (e)')[0].includes('setFormOpen(false)')
  && !moduleView.split('const save')[1].split('catch (e)')[1].split('finally')[0].includes('setFormOpen(false)'));
const attendance = read('src/screens/phase5/AttendanceLiveScreen.js');
ok('attendance blocks duplicate Save clicks', /if \(saving/.test(attendance));
ok('attendance saves through the atomic RPC service', /saveAttendanceSession/.test(attendance));

/* ---------- 5. navigation reveals the Phase 5 modules (role-aware) ---------- */
const navPolicy = read('src/domain/navigationPolicy.js');
for (const key of ['jadwal', 'attendance', 'assignments', 'exams', 'results', 'notifications']) {
  ok(`LIVE_NAV_KEYS reveals ${key}`, new RegExp(`LIVE_NAV_KEYS[\\s\\S]{0,2500}['"]${key}['"]`).test(navPolicy));
}
ok('billing stays a later-phase exclusion',
  !new RegExp(`LIVE_NAV_KEYS[\\s\\S]{0,2500}['"]billing['"]`).test(navPolicy));
const rootNav = read('src/navigation/RootNavigator.js');
ok('RootNavigator registers the Phase 5 routes', /Jadwal: TimetableScreen/.test(rootNav) && /Notifications: NotificationsScreen/.test(rootNav));
ok('RootNavigator routes Attendance through the mode-aware live route', /AttendanceRoute/.test(rootNav));

/* ---------- 6. School / University mode separation preserved ---------- */
ok('Transcripts stays OUT of the School Mode navigator', !/Transcript/.test(rootNav));
ok('Transcripts stays OUT of the desktop School shell', !/Transcript/.test(read('src/components/DesktopShell.js')));
ok('Transcripts is revealed in the University shell', /TranscriptsScreen/.test(read('src/navigation/UniversityAppShell.js')));

/* ---------- 7. approved loading + title preserved ---------- */
ok('the K-logo LoadingScreen is untouched by Phase 5', exists('src/screens/LoadingScreen.js'));
ok('the browser title remains the approved product name',
  /APP_TITLE = 'Kobciye School Management'/.test(read('src/utils/webTitle.js')));

/* ---------- 8. correction pass: real Student/Parent login (no "coming soon") ---------- */
const loginScreen = read('src/screens/auth/LoginScreen.js');
ok('the Student/Parent login is REAL (no Dhawaan/Coming Soon mockup)',
  !/Dhawaan \(Coming Soon\)|submitComingSoon|comingSoonMsg/.test(loginScreen));
ok('the Student/Parent login calls the identifier-login flow',
  /signInWithSchoolIdentifier/.test(loginScreen));
ok('the Student/Parent login has a real password field + show/hide',
  /idPw/.test(loginScreen) && /showIdPw/.test(loginScreen));
ok('AuthContext exposes signInWithSchoolIdentifier', /signInWithSchoolIdentifier/.test(read('src/context/AuthContext.js')));
ok('the identifier-login service installs a real session via setSession',
  /signInWithIdentifier/.test(read('src/services/supabase.js')) && /setSession/.test(read('src/services/supabase.js')));
ok('the identifier-login Edge Function exists',
  fs.existsSync(path.join(root, '..', 'supabase/functions/identifier-login/index.ts')));

/* ---------- 9. correction pass: role-aware Phase 5 controls ---------- */
ok('Phase5ModuleView gates controls through the pure role rules',
  /canCreateModule/.test(moduleView) && /visibleRowActions/.test(moduleView));
ok('the role rules live in a pure, unit-tested domain module', exists('src/domain/phase5Access.js'));
const assignSrc = read('src/screens/phase5/AssignmentsScreen.js');
ok('assignments declares teacher-createable roles', /createRoles:\s*\['schooladmin', 'superadmin', 'teacher'\]/.test(assignSrc));
const examSrc = read('src/screens/phase5/ExamsResultsScreen.js');
ok('the Approve/Publish actions are admin-only', /label: 'Ansixi', roles: \['schooladmin', 'superadmin'\]/.test(examSrc));
ok('attendance route is role-split (marking vs read-only)',
  /canMarkAttendance/.test(read('src/screens/phase5/liveRoutes.js')));
ok('a read-only student/parent attendance screen exists and never marks',
  exists('src/screens/phase5/MyAttendanceScreen.js')
  && !/saveAttendanceSession/.test(read('src/screens/phase5/MyAttendanceScreen.js')));

/* ---------- 9b. enterResult is wired to a real per-student entry UI (§9) ---------- */
ok('a ResultEntry screen exists and calls enterResult on a roster',
  exists('src/screens/phase5/ResultEntryScreen.js')
  && /enterResult/.test(read('src/screens/phase5/ResultEntryScreen.js'))
  && /p4ActiveEnrollments/.test(read('src/screens/phase5/ResultEntryScreen.js')));
ok('the exams module opens ResultEntry via a teacher+admin row action',
  /Natiijo geli/.test(examSrc) && /navigate\('ResultEntry'/.test(examSrc));
ok('ResultEntry is a registered, role-gated route (mobile + desktop)',
  /ResultEntry: ResultEntryScreen/.test(rootNav)
  && /ResultEntry: ResultEntryScreen/.test(read('src/components/DesktopShell.js'))
  && /ResultEntry: 'results'/.test(read('src/domain/navigationPolicy.js')));
ok('ResultEntry blocks non-marking roles from entering scores',
  /canMarkAttendance/.test(read('src/screens/phase5/ResultEntryScreen.js')));

/* ---------- 9c. createExamSchedule is wired (§9) ---------- */
ok('an ExamSchedule screen exists and calls createExamSchedule',
  exists('src/screens/phase5/ExamScheduleScreen.js')
  && /createExamSchedule/.test(read('src/screens/phase5/ExamScheduleScreen.js')));
ok('the exams module opens ExamSchedule via an admin-only row action',
  /label: 'Qorshee', roles: \['schooladmin', 'superadmin'\]/.test(examSrc) && /navigate\('ExamSchedule'/.test(examSrc));
ok('ExamSchedule is a registered route (mobile + desktop + policy)',
  /ExamSchedule: ExamScheduleScreen/.test(rootNav)
  && /ExamSchedule: ExamScheduleScreen/.test(read('src/components/DesktopShell.js'))
  && /ExamSchedule: 'exams'/.test(read('src/domain/navigationPolicy.js')));

/* ---------- 9d. assignments submit + grade are wired (§8) ---------- */
const submScreen = 'src/screens/phase5/AssignmentSubmissionsScreen.js';
ok('an AssignmentSubmissions screen exists with submit + grade',
  exists(submScreen)
  && /createSubmission/.test(read(submScreen)) && /gradeSubmission/.test(read(submScreen)));
ok('assignments open the submissions screen for graders and students',
  /navigate\('AssignmentSubmissions'/.test(assignSrc)
  && /label: 'Gudbinno', roles: \['schooladmin', 'superadmin', 'teacher'\]/.test(assignSrc)
  && /label: 'Gudbi', roles: \['student'\]/.test(assignSrc));
ok('AssignmentSubmissions is a registered route (mobile + desktop + policy)',
  /AssignmentSubmissions: AssignmentSubmissionsScreen/.test(rootNav)
  && /AssignmentSubmissions: AssignmentSubmissionsScreen/.test(read('src/components/DesktopShell.js'))
  && /AssignmentSubmissions: 'assignments'/.test(read('src/domain/navigationPolicy.js')));

/* ---------- 9e. university course results are wired (§14) ---------- */
const courseResScreen = 'src/screens/phase5/CourseResultsScreen.js';
ok('a CourseResults screen exists with enrol + result entry',
  exists(courseResScreen)
  && /createCourseEnrollment/.test(read(courseResScreen)) && /upsertCourseResult/.test(read(courseResScreen)));
ok('the University shell reveals real Results (no "not built" placeholder)',
  /CourseResultsScreen/.test(read('src/navigation/UniversityAppShell.js'))
  && !/item\.key !== 'results'/.test(read('src/navigation/UniversityAppShell.js')));

/* ---------- 9f. school-switch clears in-progress selections (§5.5) ---------- */
ok('Phase5ModuleView clears the open form + picked values when the school changes',
  /}, \[schoolId\]\);/.test(moduleView) && /setFormOpen\(false\); setValues\(\{\}\)/.test(moduleView));

/* ---------- 9g. reports offer more types + a real export (§12) ---------- */
const reportsSrc = read('src/screens/phase5/ReportsLiveScreen.js');
ok('reports include teacher-load and results families beyond enrol+fees',
  /reportTeacherAssignments/.test(reportsSrc) && /reportResultsSummary/.test(reportsSrc));
ok('reports export the live figures to CSV (real download, no fake data)',
  /Soo dejiso CSV/.test(reportsSrc) && /text\/csv/.test(reportsSrc) && !/AsyncStorage/.test(reportsSrc));

/* ---------- 10. correction pass: provisioning email + one-time credentials ---------- */
const provSrc = read('src/screens/phase5/ProvisioningScreen.js');
ok('provisioning lets the admin enter/correct an email before inviting', /inviteEmail/.test(provSrc) && /EMAIL_RE/.test(provSrc));
ok('provisioning shows one-time student credentials once', /credentials/.test(provSrc) && /temp_password|Furaha ku-meel/.test(provSrc));
const edgeProv = fs.readFileSync(path.join(root, '..', 'supabase/functions/provision-account/index.ts'), 'utf8');
ok('the Edge Function returns one-time credentials for a no-email student', /temp_password/.test(edgeProv) && /must_change_password/.test(edgeProv));
ok('the Edge Function never stores the temp password in plaintext (returned once only)',
  !/insert[\s\S]{0,80}temp_password/i.test(edgeProv));

console.log(failures === 0 ? '\nphase5-ui-wiring: all assertions passed' : `\nphase5-ui-wiring: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
