#!/usr/bin/env node
/* ============================================================
   Kobciye — final independent-audit security correction test
   (static, reproducible — follows the phase1-4-audit-fixes pattern)

   Reads the real source files and asserts:

     [2] the approved landing-page UI is restored — the phone/dashboard
         mockup is back, the paperwork-photo replacement is gone, and the
         (separately approved, unrelated) logo swap is still present
     [4] lesson-plan Class/Subject pickers source real teacher assignments
         in Live Mode (never a hardcoded/demo list) — the database itself
         is still the actual enforcement boundary (see
         supabase/tests/final_security_corrections.test.js)
     [5] ClassDetail Live Mode exposes ONLY the Ardayda tab — the
         Xaadiris/Natiijada/Lacagta/Kiisaska later-phase modules (still
         backed by the Phase 1/2 demo/AsyncStorage store) are not offered
         to an authenticated Live Mode user
     [—] ClassDetail navigation still uses a stable classId (unaffected
         by this pass — re-confirmed here since this file is what this
         pass's report cites as evidence)
     [—] the browser title is unaffected

   Run: cd mobile && npm run test:phase1-4-final-security
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const landing = read('src/screens/landing/KobciyeLanding.js');
const classDetail = read('src/screens/ClassDetailScreen.js');
const classesScreen = read('src/screens/ClassesScreen.js');
const lessonPlansSvc = read('src/services/lessonPlans.js');
const lessonPrepModal = read('src/components/LessonPrepModal.js');
const lessonsScreen = read('src/screens/LessonsScreen.js');
const appJson = JSON.parse(read('app.json'));

console.log('[2] approved landing-page UI restored');
ok('the approved phone/dashboard mockup block is present', /phone mockup \+ decorative shapes/.test(landing));
ok('the paperwork-photo hero replacement is gone', !/Warqado aan dhammaad lahayn/.test(landing));
ok('the paperwork-photo bottom-bar copy is gone', !/warqadaha iyo buugaagta badan/.test(landing));
ok('the (separately approved) logo swap is still present', /const LOGO = 'data:image\/png;base64,/.test(landing) && /const LOGO_WHITE = 'data:image\/png;base64,/.test(landing));
ok('the web title config is unaffected by this pass', appJson.expo && appJson.expo.web && appJson.expo.web.name === 'Kobciye School Management');

console.log('\n[4] lesson-plan Class/Subject pickers use real teacher assignments in Live Mode');
ok('lessonPlans.js exposes myTeacherAssignments (real assignment data, not a demo list)', /export async function myTeacherAssignments/.test(lessonPlansSvc));
ok('createLessonPlan persists the real class_id/subject_id when supplied', /class_id: classId \|\| null/.test(lessonPlansSvc) && /subject_id: subjectId \|\| null/.test(lessonPlansSvc));
ok('LessonPrepModal accepts teacherClassOpts/teacherSubjectOpts props', /teacherClassOpts, teacherSubjectOpts/.test(lessonPrepModal));
ok('LessonPrepModal sources its pickers from the live options when given (not the hardcoded CLASS_OPTS)', /liveClassOpts \? pickClass/.test(lessonPrepModal) && /liveSubjectOpts \? \(/.test(lessonPrepModal));
ok('the demo CLASS_OPTS fallback still exists (demo mode/no-assignments unaffected)', /const CLASS_OPTS = \['Form 5A', 'Form 6B', 'Form 7A'\]/.test(lessonPrepModal));
ok('LessonsScreen fetches the signed-in teacher\'s own assignments in Live Mode', /myTeacherAssignments\(liveProfile\.school_id, liveProfile\.id\)/.test(lessonsScreen));
ok('LessonsScreen only offers real options to LessonPrepModal when live', /teacherClassOpts={isLive \? myAssignments\.classes : null}/.test(lessonsScreen));

console.log('\n[5] ClassDetail Live Mode: only Ardayda is offered (no Phase 5 tabs)');
ok('a dedicated LIVE_TABS constant restricts Live Mode to Ardayda only', /const LIVE_TABS = \['Ardayda'\]/.test(classDetail));
ok('allowedTabs uses LIVE_TABS (not the full 5-tab TABS) when live', /isLive \? \(allowed \? LIVE_TABS : \[\]\)/.test(classDetail));
ok('demo mode\'s tab set is unaffected (still the full role-aware getAllowedClassTabs)', /: \(cls \? getAllowedClassTabs\(profile, cls\) : \[\]\)/.test(classDetail));

console.log('\n[unaffected — re-confirmed] ClassDetail stable classId routing (prior pass)');
ok('ClassesScreen still navigates live mode with a stable classId only', /isLive \? \{ classId: cls\[8\] \} : \{ cls \}/.test(classesScreen));
ok('ClassDetailScreen still loads the class from the canonical repository by id', /liveClasses\.rows\.find\(\(r\) => r\.id === liveRouteClassId\)/.test(classDetail));
ok('the not-found vs permission-denied distinction is still intact', /Fasalkan lama helin/.test(classDetail));

console.log('');
if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
console.log('phase1-4-final-security: all assertions passed');
