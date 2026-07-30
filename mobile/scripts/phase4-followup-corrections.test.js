#!/usr/bin/env node
/* Kobciye Phase 4 focused follow-up regression tests.
   Pure Node/source-level checks; no browser or remote Supabase is touched. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let failures = 0;
function ok(name, condition) {
  console.log(condition ? 'PASS' : 'FAIL', name);
  if (!condition) failures += 1;
}

const root = path.resolve(__dirname, '..');
const repo = path.resolve(root, '..');
const read = (rel, base = root) => fs.readFileSync(path.join(base, rel), 'utf8');

const lessonsContext = read('src/context/LessonsContext.js');
const lessonsScreen = read('src/screens/LessonsScreen.js');
const lessonService = read('src/services/lessonPlans.js');
const messagesScreen = read('src/screens/MessagesScreen.js');
const messagingService = read('src/services/messaging.js');
const modules = read('src/config/phase4Modules.js');
const p4View = read('src/components/P4ModuleView.js');
const phase4 = read('src/services/phase4.js');
const guardianView = read('src/components/GuardianManagementView.js');
const regression = read('scripts/phase4-correction-regression.test.js');
const migration = read('migrations/20260724000003_require_active_enrollment_class_year.sql', path.join(repo, 'supabase'));

/* A. Lessons */
ok('LessonsContext resolves the selected active school', /useActiveSchoolId/.test(lessonsContext));
ok('LessonsContext does not read profile.school_id for live scope', !/profile\s*\?\s*profile\.school_id|profile\.school_id/.test(lessonsContext));
ok('Live lessons never fall back to demo lessons', /const lessons = isLive \? liveLessons : demoLessons/.test(lessonsContext));
ok('Changing school clears old lesson rows before loading', /setLiveLessons\(\[\]\)[\s\S]{0,260}if \(!isLive \|\| !schoolId\)/.test(lessonsContext));
ok('Stale lesson requests are ignored', /requestSeq/.test(lessonsContext) && /requestSeq\.current === requestId/.test(lessonsContext));
ok('Lesson screen shows the standard school-selection prompt', /needsSchoolSelection/.test(lessonsScreen) && /<SchoolSelectPrompt/.test(lessonsScreen));
ok('Teacher assignments use the resolved active school', /myTeacherAssignments\(schoolId, liveTeacherId\)/.test(lessonsScreen));
ok('Lesson data service still rejects invalid school UUIDs', /function requireSchoolUuid/.test(lessonService) && /isUuid\(schoolId\)/.test(lessonService));

/* B. Messages */
ok('Messages screen resolves activeSchoolId through the shared hook', /useActiveSchoolId/.test(messagesScreen));
ok('Messages screen does not read liveProfile.school_id', !/liveProfile\.school_id/.test(messagesScreen));
ok('No live message query runs without profile and selected school', /if \(!isLive \|\| !profileId \|\| !schoolId\)[\s\S]{0,120}return/.test(messagesScreen));
ok('Conversation list receives the selected school UUID', /listMyConversations\(profileId, schoolId\)/.test(messagesScreen));
ok('Message send receives the selected school UUID', /sendConversationMessage\(open\.id, schoolId, profileId, text\)/.test(messagesScreen));
ok('School switching clears open conversation/thread/search state', /setOpen\(null\); setThread\(\[\]\); setDraft\(''\); setQ\(''\)/.test(messagesScreen));
ok('Messages screen shows school selector before querying', /needsSchoolSelection/.test(messagesScreen) && /<SchoolSelectPrompt/.test(messagesScreen));
ok('Messaging service hard-validates every school UUID', /function requireSchoolUuid/.test(messagingService) && /isUuid\(value\)/.test(messagingService));
ok('Conversation list is filtered by selected school', /\.in\('id', membershipIds\)[\s\S]{0,100}\.eq\('school_id', school\)/.test(messagingService));
ok('Message rows are filtered by selected school', /\.in\('conversation_id', allowedIds\)\.eq\('school_id', school\)/.test(messagingService));
ok('Thread/send/read verify conversation belongs to active school', /assertConversationInSchool/.test(messagingService));
ok('Live UI remains separate from demo MESSAGES', /const all = isLive \? liveConvs : filterMessagesForProfile/.test(messagesScreen));

/* C. Student validation */
const schoolModules = modules.split('export const UNIVERSITY_MODULES')[0];
const studentBlock = schoolModules.split("key: 'students'")[1].split("key: 'parents'")[0];
const admissionBlock = schoolModules.split("key: 'admissions'")[1];
ok('Student class is required', /key: 'class_id'[\s\S]{0,120}required: true/.test(studentBlock));
ok('Student academic year is required', /key: 'academic_year_id'[\s\S]{0,120}required: true/.test(studentBlock));
ok('Enrolled Admissions exposes academic-year selection', /key: 'academic_year_id'[\s\S]{0,140}virtual: true[\s\S]{0,80}enrollmentRequired: true/.test(admissionBlock));
ok('P4 form validates class/year before any write', /p4ValidateEnrollmentSelection/.test(p4View) && /if \(enrollmentErr\) \{ setFormErr\(enrollmentErr\); return; \}/.test(p4View));
ok('Admissions passes selected academic year to atomic writer', /academicYearId: extra\.academic_year_id/.test(p4View));
ok('Service rejects missing/invalid class and year', /Fadlan dooro fasalka\./.test(phase4) && /Fadlan dooro sannad-dugsiyeedka\./.test(phase4));
ok('Atomic writer requires validated enrollment selection', /requireEnrollmentSelection\(\{ classId, academicYearId, streamId \}\)/.test(phase4));
ok('Database trigger blocks active enrollment with no class', /new\.status = 'active' and new\.class_id is null/.test(migration));
ok('Database trigger blocks active enrollment with no academic year', /new\.status = 'active' and new\.academic_year_id is null/.test(migration));
ok('Database trigger preserves same-school FK checks', /class belongs to another school/.test(migration) && /academic_year belongs to another school/.test(migration));

/* D. Visible feedback */
ok('P4 forms prevent duplicate submissions', /if \(saving\) return;/.test(p4View) && /disabled=\{saving\}/.test(p4View));
ok('P4 failure keeps form open and shows normalized error', /setFormErr\(p4FriendlyError\(e\)\)/.test(p4View));
ok('Student save has visible Somali success confirmation', /Ardayga si guul leh ayaa loo kaydiyey\./.test(p4View));
ok('Admission save has visible Somali success confirmation', /Diiwaangelinta ardayga waa la dhammeeyey\./.test(p4View));
ok('Success feedback stays visible outside the closed modal', /successMsg[\s\S]{0,500}styles\.successBox/.test(p4View));
ok('Guardian form prevents duplicate submissions', /if \(saving \|\| !guardianForm\) return/.test(guardianView));
ok('Guardian link has visible Somali success confirmation', /Waalidka si guul leh ayaa ardayga loogu xidhay\./.test(guardianView));
ok('Guardian failure remains visible in the modal', /setFormError\(p4FriendlyError\(e\)\)/.test(guardianView));

/* E. Regression boundaries */
ok('Runtime non-Kobciye scan excludes audit reports', /runtimeRoots/.test(regression) && !/walk\(repoRoot\)/.test(regression));
ok('Runtime non-Kobciye scan still checks mobile source', /mobile\/src/.test(regression));
const classDetail = read('src/screens/ClassDetailScreen.js');
ok('Class Detail Live Mode remains Ardayda-only', /const LIVE_TABS = \['Ardayda'\]/.test(classDetail));
ok('Requested LoadingScreen still exists', fs.existsSync(path.join(root, 'src/screens/LoadingScreen.js')));
ok('Requested ForgotPasswordScreen still exists', fs.existsSync(path.join(root, 'src/screens/auth/ForgotPasswordScreen.js')));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preservedHashes = {
  'src/screens/LoadingScreen.js': '4af7924482d30f3d4e89d69fb51a5ad72a201415e563e04f616126eb0a6e9a08',
};
for (const [rel, expected] of Object.entries(preservedHashes)) {
  ok(`${rel} remains byte-for-byte preserved`, sha256(path.join(root, rel)) === expected);
}
const forgotPasswordScreen = read('src/screens/auth/ForgotPasswordScreen.js');
ok('ForgotPasswordScreen remains present and uses the required secure role-aware recovery panel',
  /AuthForgotPasswordPanel/.test(forgotPasswordScreen) && /<Logo/.test(forgotPasswordScreen));
ok('approved landing page remains byte-for-byte preserved',
  sha256(path.join(repo, 'landing/index.html')) === '3b32468dbc15624027b69346fb73296f92093aabe45d1593389f1f807c7d5f58');
ok('Live Ministry review code/card is hidden until a real backend exists',
  /reviewCode: isLive \? null : REVIEW_CODE/.test(lessonsContext)
  && /!isLive && reviewCode/.test(lessonsScreen));
const roleContext = read('src/context/RoleContext.js');
const appSource = read('App.js');
ok('Authenticated database roles are not persisted as demo roles',
  /options\.persist !== false/.test(roleContext)
  && /setRole\(roleKey, \{ persist: false \}\)/.test(appSource));
ok('Class Detail performs no local attendance reads in Live Mode',
  /if \(isLive \|\| !clsSchoolId \|\| !clsClassId\)/.test(classDetail)
  && /if \(isLive \|\| !readOnly \|\| !clsSchoolId\)/.test(classDetail));
ok('Foreign-key load failures are visible and block misleading saves',
  /fkErrors/.test(p4View) && /Doorashooyinka lama soo dejin karin/.test(p4View));
ok('Teacher assignment loading failures are visible and retryable',
  /assignmentError/.test(lessonsScreen) && /loadAssignments/.test(lessonsScreen));
ok('No service-role key was introduced into corrected runtime files', !/service_role|SUPABASE_SERVICE_ROLE/i.test([lessonsContext, messagesScreen, messagingService, p4View, phase4].join('\n')));

console.log(failures === 0
  ? '\nphase4-followup-corrections: all assertions passed'
  : `\nphase4-followup-corrections: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
