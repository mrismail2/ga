#!/usr/bin/env node
/* ============================================================
   Kobciye — final privacy & lesson-plan security correction test
   (static, reproducible — follows the phase1-4-audit-fixes pattern)

   Reads the real source files and asserts:

     [5] LessonPrepModal never falls back to demo classes/free-text
         subjects when a Live Mode teacher has zero real assignments —
         it shows an honest empty/disabled state and Save is disabled;
         Demo Mode (no live options passed at all) is unaffected.
     [6] UniversityAppShell.js no longer shows "Phase 4"/"Phase 5+" in
         any user-facing (rendered) string; layout/styling untouched.

   The database itself remains the actual enforcement boundary for both
   areas — see supabase/tests/final_privacy_and_lesson_security.test.js.

   Run: cd mobile && npm run test:phase1-4-privacy-security
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const modal = read('src/components/LessonPrepModal.js');
const universityShell = read('src/navigation/UniversityAppShell.js');

console.log('[5] Live zero-assignment lesson state — no demo fallback');
// NOTE: updated 2026-07-24 for the pairs-based rewrite — see
// mobile/scripts/phase1-4-membership-message-lesson-guards.test.js for the
// full async-loading + valid-pair-only coverage added this pass.
ok('Live Mode is detected by prop TYPE (an array), not by non-empty length',
  /const isLiveAssignmentMode = Array\.isArray\(teacherAssignmentPairs\)/.test(modal));
ok('a Live Mode teacher with zero assignments is explicitly distinguished (liveHasNoAssignments)',
  /const liveHasNoAssignments = isLiveAssignmentMode && pairs\.length === 0/.test(modal));
ok('the zero-assignment case renders a dedicated empty/disabled explanation, not the demo picker',
  /liveHasNoAssignments \? \(/.test(modal) && /Wali lagama xilsaarin fasal ama maaddo/.test(modal));
ok('the empty/disabled state reuses the existing dashed cover-box style (no new visual language)',
  /styles\.cover, styles\.noAssignBox/.test(modal));
ok('Save is disabled whenever there is no title, zero assignments, or an invalid pair',
  /const canSave = !!title\.trim\(\) && !liveHasNoAssignments && hasValidLivePair/.test(modal));
ok('the Save button itself is wired to canSave, not just title',
  /onPress={save} disabled={!canSave}/.test(modal));
ok('save() itself refuses to proceed when canSave is false (defense in depth, not just a disabled button)',
  /const save = \(\) => \{\s*if \(!canSave\) return;/.test(modal));
ok('the demo CLASS_OPTS fallback is reachable ONLY when Live Mode was never signalled at all',
  /const CLASS_OPTS = \['Form 5A', 'Form 6B', 'Form 7A'\]/.test(modal)
  && /isLiveAssignmentMode \? \(/.test(modal));
ok('a Live Mode teacher WITH real assignments still gets the real segmented pickers sourced from canonical pairs (unaffected)',
  /classOptions\.map/.test(modal) && /subjectOptionsForClass\.map/.test(modal));

console.log('\n[6] University development-phase labels removed from rendered UI');
ok('the Cohorts/Levels empty-state copy no longer mentions a Phase number',
  !/Cohort-ka iyo Level-ka waxaa lagu qoraa[\s\S]{0,120}Phase \d/.test(universityShell));
ok('the "not built yet" empty-state copy no longer mentions a Phase number',
  !/Nidaamkan wali lama dhisin[\s\S]{0,120}Phase \d/.test(universityShell));
ok('no rendered <Text> content anywhere in the file contains the literal string "Phase 4" or "Phase 5"',
  !/>\s*\{?\s*['"`][^'"`]*Phase [45][^'"`]*['"`]/.test(universityShell)
  && !/Cohort-ka iyo Level-ka[\s\S]*?Phase [45]/.test(universityShell)
  && !/Nidaamkan wali lama dhisin[\s\S]*?Phase [45]/.test(universityShell));
ok('the header/doc comment may still name the phase (comments are exempt, not user-facing)',
  /Phase 4: the core-management items/.test(universityShell));

console.log('');
if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
console.log('phase1-4-privacy-security: all assertions passed');
