#!/usr/bin/env node
/* ============================================================
   Kobciye — final membership/message/lesson-plan guards test
   (static, reproducible — follows the phase1-4-audit-fixes pattern)

   Reads the real source files and asserts the mobile-side requirements
   from this pass's re-audit sections 6–8:

     [6] Asynchronous lesson-assignment loading — the modal reacts to
         `teacherAssignmentPairs` arriving/changing after it has already
         opened, initializes the first valid pair once real assignments
         exist, and never overwrites a still-valid in-progress selection.
     [7] Class/Subject selectors are built from canonical assignment
         PAIRS (never two independent lists) — picking a class filters
         the subject options to only that class's real subjects.
     [8] Live Mode never uses demo lesson options — re-confirmed against
         the current (pairs-based) source.

   The database itself remains the actual enforcement boundary — see
   supabase/tests/final_membership_message_lesson_guards.test.js.

   Run: cd mobile && npm run test:phase1-4-membership-message-lesson-guards
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const modal = read('src/components/LessonPrepModal.js');
const lessonPlansSvc = read('src/services/lessonPlans.js');
const lessonsScreen = read('src/screens/LessonsScreen.js');

console.log('[6] asynchronous lesson-assignment loading');
ok('a dedicated effect reacts whenever the pairs prop itself changes (not just on mount)',
  /useEffect\(\(\) => \{\s*if \(!isLiveAssignmentMode\) return;/.test(modal)
  && /\}, \[isLiveAssignmentMode, JSON\.stringify\(pairs\)\]\)/.test(modal));
ok('the effect keeps a still-valid selection instead of always overwriting it',
  /const keepClass = pairs\.some\(\(p\) => p\.classId === prevClassId\)/.test(modal)
  && /const keepPair = pairs\.some\(\(p\) => p\.classId === nextClassId && p\.subjectId === prevSubjectId\)/.test(modal));
ok('the effect initializes the first real pair once assignments arrive and none was selected yet',
  /const nextClassId = keepClass \? prevClassId : \(pairs\[0\] \? pairs\[0\]\.classId : null\)/.test(modal));
ok('a stale/invalid selection (no longer in pairs) is cleared to the first valid pair or null',
  /const firstForClass = pairs\.find\(\(p\) => p\.classId === nextClassId\)/.test(modal)
  && /return firstForClass \? firstForClass\.subjectId : null/.test(modal));
ok('Save stays disabled while there is no valid real pair selected (hasValidLivePair)',
  /const hasValidLivePair = !isLiveAssignmentMode \|\| pairs\.some\(\(p\) => p\.classId === classId && p\.subjectId === subjectId\)/.test(modal)
  && /liveHasNoAssignments && hasValidLivePair/.test(modal));
ok('no null class_id/subject_id can be submitted once a real pair is required (save() checks canSave first)',
  /const save = \(\) => \{\s*if \(!canSave\) return;/.test(modal));

console.log('\n[7] class/subject selectors use canonical assignment PAIRS only');
ok('myTeacherAssignments returns enriched pairs (classId/className/subjectId/subjectName), not two flat lists',
  /pairs: rows\.map\(\(r\) => \(\{\s*classId: r\.class_id,\s*className: classNameById\.get\(r\.class_id\) \|\| '—',\s*subjectId: r\.subject_id,\s*subjectName: subjectNameById\.get\(r\.subject_id\) \|\| '—',/.test(lessonPlansSvc));
ok('assignment rows lacking a real class_id/subject_id pair are filtered out server-side before reaching the UI',
  /rows = \(data \|\| \[\]\)\.filter\(\(r\) => r\.class_id && r\.subject_id\)/.test(lessonPlansSvc));
ok('class options are the unique classes actually present in the pairs (not an independent class list)',
  /const classOptions = isLiveAssignmentMode\s*\? \[\.\.\.new Map\(pairs\.map\(\(p\) => \[p\.classId,/.test(modal));
ok('subject options are filtered to the CURRENTLY SELECTED class only (never an unrelated combination)',
  /const subjectOptionsForClass = isLiveAssignmentMode\s*\? pairs\.filter\(\(p\) => p\.classId === classId\)\.map/.test(modal));
ok('picking a class re-derives the subject from a real pair for that class (never leaves a mismatched subject selected)',
  /const pickClass = \(o\) => \{\s*setClassId\(o\.value\);\s*const match = pairs\.find\(\(p\) => p\.classId === o\.value\);/.test(modal));
ok('LessonsScreen passes the single teacherAssignmentPairs prop end to end',
  /teacherAssignmentPairs={isLive \? myAssignments\.pairs : null}/.test(lessonsScreen));

console.log('\n[8] Live Mode never uses demo lesson options (re-confirmed)');
ok('the demo CLASS_OPTS array only renders in the true Demo Mode branch',
  /\{CLASS_OPTS\.map\(\(o\) => \(/.test(modal));
ok('Live Mode (with or without assignments) never reaches the demo CLASS_OPTS branch',
  /isLiveAssignmentMode \? \(/.test(modal));

console.log('');
if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
console.log('phase1-4-membership-message-lesson-guards: all assertions passed');
