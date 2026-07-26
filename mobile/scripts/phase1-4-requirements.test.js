#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 1–4 additional mandatory requirements test
   (static, reproducible — follows the phase3-audit pattern)

   Reads the real source files and asserts the additional Phase 1–4
   requirements hold:

     A/C. one canonical repository + two-way sync
       - phase4.js notifies the canonical change bus on create/update
       - the menu screens (Fasallada/Macallimiinta/Ardayda) read live data
         through useCanonicalRows (the same p4List repository)
       - P4ModuleView (Maamulka Dugsiga) reloads on canonical changes
       - no screen keeps a separate live-mode array of canonical records

     B. School Admin class creation from Fasallada
       - AddClassModal saves through p4CreateClassCanonical in live mode
       - p4CreateClassCanonical enforces role, school, active year, level,
         duplicate protection

     D. Admissions guardian linking
       - admissions module offers existing-guardian selection (parents fk),
         relationship options and new-guardian fields
       - saving as 'enrolled' calls the atomic RPC (admit_student_atomic)

     E. web Sign Out
       - the sidebar (web shell) wires the REAL AuthContext signOut
       - AuthContext.signOut calls Supabase signOut and clears state

     F/G/H. no demo data in Live Mode
       - Macallimiinta/Casharrada/Fariimaha never render their demo arrays
         when live; the Messages empty state is the approved wording;
         voice/photo attachments are never simulated live

   Run: cd mobile && npm run test:phase1-4-requirements
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const phase4 = read('src/services/phase4.js');
const bus = read('src/services/canonicalStore.js');
const hook = read('src/hooks/useCanonicalRows.js');
const moduleView = read('src/components/P4ModuleView.js');
const modules = read('src/config/phase4Modules.js');
const addClass = read('src/components/AddClassModal.js');
const classes = read('src/screens/ClassesScreen.js');
const teachers = read('src/screens/TeachersScreen.js');
const students = read('src/screens/StudentsScreen.js');
const classDetail = read('src/screens/ClassDetailScreen.js');
const lessonsCtx = read('src/context/LessonsContext.js');
const lessonsSvc = read('src/services/lessonPlans.js');
const messages = read('src/screens/MessagesScreen.js');
const messagingSvc = read('src/services/messaging.js');
const sidebar = read('src/components/Sidebar.js');
const auth = read('src/context/AuthContext.js');
const dash = read('src/screens/dashboards/RoleDashboards.js');
const migration = fs.readFileSync(path.resolve(ROOT, '..', 'supabase', 'migrations', '20260717000001_additional_phase1_4_requirements.sql'), 'utf8');
const pkg = JSON.parse(read('package.json'));

console.log('[A/C] one canonical repository + two-way synchronization');
ok('p4Create notifies the canonical change bus', /notifyCanonicalChange\(table\)/.test(phase4));
ok('canonicalStore clears listeners when live mode ends', /onLiveModeChange\([\s\S]*?listeners\.clear\(\)/.test(bus));
ok('useCanonicalRows reads through p4List (same repository as Maamulka Dugsiga)', /p4List\(table, schoolId\)/.test(hook));
ok('useCanonicalRows reloads on canonical changes', /onCanonicalChange\(/.test(hook));
ok('P4ModuleView reloads when another screen persists canonically', /onCanonicalChange\(\(table\)/.test(moduleView));
ok('Fasallada reads canonical classes live', /useCanonicalRows\('classes'/.test(classes));
ok('Macallimiinta reads canonical teachers live', /useCanonicalRows\('teachers'/.test(teachers));
ok('Ardayda reads canonical students live', /useCanonicalRows\('students'/.test(students));
ok('Class detail reads the canonical roster live', /useCanonicalRows\('students'/.test(classDetail));
ok('dashboard counts re-read on canonical changes', /onCanonicalChange\(\(\) => refresh\(\)\)/.test(dash));

console.log('\n[B] School Admin creates a class from Fasallada');
ok('AddClassModal saves through the canonical repository in live mode', /p4CreateClassCanonical\(/.test(addClass));
ok('AddClassModal guards duplicate submissions (saving flag)', /if \(!name\.trim\(\) \|\| saving\) return/.test(addClass));
ok('creation verifies the School Admin role', /roleKey !== 'schooladmin'/.test(phase4));
ok('creation uses the active academic year', /p4ActiveAcademicYear\(schoolId\)/.test(phase4));
ok('creation uses the selected school level (school_sections match)', /level_type === levelType/.test(phase4));
ok('creation blocks inappropriate duplicate class names', /toLowerCase\(\) === clean\.toLowerCase\(\)/.test(phase4));
ok('Fasallada + Maamulka Dugsiga share ONE record format (both p4 classes table)', /table: 'classes'/.test(modules) && /p4Create\('classes'/.test(phase4));

console.log('\n[D] Admissions guardian linking (atomic)');
ok('admissions form offers existing same-school guardians', /parent_id[^}]*fk: \{ table: 'parents'/.test(modules));
ok('admissions form offers relationship types', /relationship[^]*?father[^]*?mother[^]*?guardian/.test(modules));
ok('enrolled admissions run the atomic RPC', /enrollAtomic && payload\.status === 'enrolled'/.test(moduleView));
ok('client calls admit_student_atomic', /rpc\('admit_student_atomic'/.test(phase4));
ok('migration defines the atomic RPC', /create or replace function admit_student_atomic/.test(migration));
ok('RPC rejects duplicate guardian links', /guardian is already linked to this student/.test(migration));
ok('RPC rejects cross-school guardians', /guardian belongs to another school/.test(migration));
ok('migration creates student_enrollments', /create table student_enrollments/.test(migration));

console.log('\n[E] web Sign Out');
ok('sidebar wires the real signOut action', /useAuth\(\)/.test(sidebar) && /onPress={signOut}/.test(sidebar));
ok('AuthContext signOut terminates the Supabase session', /await sbSignOut\(\)/.test(auth));
ok('AuthContext signOut clears profile + role + session state', /setSession\(null\); setProfile\(null\)/.test(auth));

console.log('\n[F] Macallimiinta — no demo teachers live');
ok('live branch returns before the demo TEACHERS list renders', /if \(isLive\) \{/.test(teachers) && teachers.indexOf('if (isLive) {') < teachers.indexOf('data={teachers}'));
ok('live list is only canonical rows (no fake insert on empty)', /liveActive\.length === 0/.test(teachers) && !/setTeachers\(TEACHERS\)[^]*isLive/.test(teachers));
ok('teacher profile modal never fabricates live contact details', /live \? \(live\.phone \|\| '—'\)/.test(read('src/components/TeacherProfileModal.js')));

console.log('\n[G] Casharrada — no demo lessons live');
ok('live mode loads canonical lesson_plans', /listLessonPlans\(schoolId\)/.test(lessonsCtx));
ok('demo seed only serves demo mode', /const lessons = isLive \? liveLessons : demoLessons/.test(lessonsCtx));
ok('lesson service reads the lesson_plans table', /from\('lesson_plans'\)/.test(lessonsSvc));
ok('migration guards approval to admins', /only a school admin may approve or reject/.test(migration));

console.log('\n[H] Fariimaha — no demo conversations live');
ok('live mode loads canonical conversations scoped to the active school', /listMyConversations\(profileId, schoolId\)/.test(messages));
ok('demo MESSAGES array only serves demo mode', /isLive \? liveConvs : filterMessagesForProfile/.test(messages));
ok('approved empty state wording', /Weli wada-hadal ma jiro\./.test(messages));
ok('voice/photo never simulated in live mode', /canAttach = canSend && !isLive/.test(messages));
ok('unread state uses last_read_at', /last_read_at/.test(messagingSvc));
ok('membership-only access (canonical tables)', /from\('conversation_members'\)/.test(messagingSvc) && /create policy "members read conversation messages"/.test(migration));

console.log('\n[entry] Expo web entry point');
ok('package.json main is index.js', pkg.main === 'index.js');
ok('index.js registers the root component', /registerRootComponent\(App\)/.test(read('index.js')));

console.log('');
if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
console.log('phase1-4-requirements: all assertions passed');
