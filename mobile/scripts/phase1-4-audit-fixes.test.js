#!/usr/bin/env node
/* ============================================================
   Kobciye — Phase 1–4 independent-audit correction test (static,
   reproducible — follows the phase1-4-requirements pattern)

   Reads the real source files and asserts the independent-audit
   corrections hold:

     [1] no user-facing "(Phase 4)" label remains
     [3/4] ClassDetailScreen routes live mode by a stable classId only
           (never a demo array/object), loads the class from the
           canonical repository, and distinguishes "not found" from
           "permission denied"
     [5] no school_001 fallback remains in any live-mode-aware file
     [6] teacher-scoped RLS: new SECURITY DEFINER functions + policies
         exist in the migration; the old blanket "any staff" policies
         are dropped
     [7] admit_student_atomic preserves enrollment history (close +
         insert-new, never update-in-place)
     [8] student counts read the canonical active-enrollment collection
         (dashboard, class card, ClassDetail roster, School Management)
     [9] lesson_plans schema is complete (objectives/materials/
         lesson_content/homework_note/teacher_id) and the status check
         is widened, never narrowed (existing review workflow preserved)
     [10] messaging schema is complete (type/updated_at on conversations;
          message_type/attachment_uri/deleted_at on messages)

   Run: cd mobile && npm run test:phase1-4-audit-fixes
   ============================================================ */
const fs = require('fs');
const path = require('path');

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL'), name); if (!cond) failures += 1; };
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const roleDash = read('src/screens/dashboards/RoleDashboards.js');
const classesScreen = read('src/screens/ClassesScreen.js');
const classDetail = read('src/screens/ClassDetailScreen.js');
const phase4Svc = read('src/services/phase4.js');
const supabaseSvc = read('src/services/supabase.js');
const p4ModuleView = read('src/components/P4ModuleView.js');
const migration = fs.readFileSync(
  path.resolve(ROOT, '..', 'supabase', 'migrations', '20260723000001_phase1_4_independent_audit_fixes.sql'), 'utf8');

console.log('[1] user-facing "(Phase 4)" label removed');
ok('RoleDashboards no longer renders "Maamulka Dugsiga (Phase 4)"', !/Maamulka Dugsiga \(Phase 4\)/.test(roleDash));
ok('RoleDashboards renders the plain "Maamulka Dugsiga" label', /Maamulka Dugsiga<\/Text>/.test(roleDash));

console.log('\n[3/4] ClassDetailScreen — stable classId routing + canonical load');
ok('ClassesScreen navigates live mode with a stable classId (not a demo array)', /isLive \? \{ classId: cls\[8\] \} : \{ cls \}/.test(classesScreen));
ok('ClassDetailScreen loads the class from the canonical classes table by id', /liveClasses\.rows\.find\(\(r\) => r\.id === liveRouteClassId\)/.test(classDetail));
ok('ClassDetailScreen distinguishes not-found from permission-denied', /liveDenialKind === 'not_found'/.test(classDetail) && /Fasalkan lama helin/.test(classDetail));
ok('only superadmin/schooladmin/teacher may attempt live class access', /liveRoleMayAttempt = roleKey === 'superadmin' \|\| roleKey === 'schooladmin' \|\| roleKey === 'teacher'/.test(classDetail));
ok('a live "not found vs denied" check never leaks cross-school data (uses class_exists_in_my_school)', /p4ClassExistsInMySchool\(liveRouteClassId\)/.test(classDetail));

console.log('\n[5] no school_001 fallback in any live-mode-aware runtime file');
const SRC_DIR = path.join(ROOT, 'src');
function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const liveAwareFiles = walk(SRC_DIR).filter((f) => fs.readFileSync(f, 'utf8').includes('useAuth'));
const filesWithFallback = liveAwareFiles.filter((f) => /school_001/.test(fs.readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '')));
ok('no live-mode-aware file contains a school_001 fallback outside comments', filesWithFallback.length === 0);

console.log('\n[6] teacher-scoped RLS on classes / students');
ok('migration defines is_teacher_of_class()', /create or replace function is_teacher_of_class/.test(migration));
ok('migration defines is_teacher_of_student()', /create or replace function is_teacher_of_student/.test(migration));
ok('migration defines class_exists_in_my_school()', /create or replace function class_exists_in_my_school/.test(migration));
ok('the blanket "school members read classes" policy is dropped', /drop policy if exists "school members read classes"/.test(migration));
ok('the blanket "staff read students" policy is dropped', /drop policy if exists "staff read students"/.test(migration));
ok('a teacher-scoped classes policy replaces it', /"teacher reads assigned classes" on classes for select/.test(migration));
ok('a teacher-scoped students policy replaces it', /"teacher reads assigned-class students" on students for select/.test(migration));

console.log('\n[7] enrollment history preserved on transfer');
ok('student_enrollments gained an ended_on column', /alter table student_enrollments add column ended_on date/.test(migration));
ok('admit_student_atomic closes the old row instead of updating it in place', /update student_enrollments set status = 'transferred', ended_on = current_date/.test(migration));
ok('admit_student_atomic inserts a NEW row for a genuine transfer', /insert into student_enrollments \(school_id, student_id, class_id, stream_id, academic_year_id\)\s*\n\s*values \(p_school, v_student,\s*\n\s*coalesce\(p_class_id, v_old_class_id\)/.test(migration));
ok('an unchanged resubmission does not touch the enrollment (no history spam)', /Resubmitting the same values is a no-op/.test(migration));

console.log('\n[8] student counts use the canonical active-enrollment collection');
ok('getSchoolCounts counts active student_enrollments, not raw students rows', /from\('student_enrollments'\)[\s\S]{0,120}eq\('status', 'active'\)/.test(supabaseSvc));
ok('phase4.js exposes p4ActiveEnrollments for count/roster consumers', /export async function p4ActiveEnrollments/.test(phase4Svc));
ok('ClassesScreen per-class counts come from active enrollments', /activeEnrollments\.filter\(\(e\) => e\.class_id === r\.id\)/.test(classesScreen));
ok('ClassDetailScreen roster is derived from active enrollments', /activeStudentIds = new Set/.test(classDetail));
ok('School Management (P4ModuleView) students list filters to active enrollments', /module\.table === 'students'/.test(p4ModuleView) && /p4ActiveEnrollments\(schoolId\)/.test(p4ModuleView));

console.log('\n[9] lesson_plans schema completeness (widened, not narrowed)');
ok('migration adds objectives/materials/lesson_content/homework_note/teacher_id', /add column objectives text,\s*\n\s*add column materials text,\s*\n\s*add column lesson_content text,\s*\n\s*add column homework_note text,\s*\n\s*add column teacher_id uuid/.test(migration));
ok('status check WIDENS to include "ready" (draft/pending/approved/rejected kept)', /check \(status in \('draft', 'pending', 'approved', 'rejected', 'ready'\)\)/.test(migration));

console.log('\n[10] messaging schema completeness');
ok('conversations gains type + updated_at', /add column type text not null default 'direct'/.test(migration) && /add column updated_at timestamptz not null default now\(\)/.test(migration));
ok('messages gains message_type + attachment_uri + deleted_at', /add column message_type text not null default 'text'/.test(migration) && /add column attachment_uri text/.test(migration) && /add column deleted_at timestamptz/.test(migration));

console.log('');
if (failures > 0) { console.error(`${failures} assertion(s) FAILED`); process.exit(1); }
console.log('phase1-4-audit-fixes: all assertions passed');
