#!/usr/bin/env node
/* ============================================================
   Kobciye Phase 5 — role-capability unit tests

   Executes the REAL shipped rules in src/domain/phase5Access.js (the same
   module the views import) so the "hide unauthorised controls before render"
   guarantee (§5) is proven by logic, not only by scanning source text.
   ============================================================ */
const { canCreateModule, visibleRowActions, canRecordPayment, canMarkAttendance } = require('../src/domain/phase5Access');

let failures = 0;
const ok = (n, c) => { console.log(c ? 'PASS' : 'FAIL', n); if (!c) failures += 1; };

const ROLES = ['superadmin', 'schooladmin', 'teacher', 'accountant', 'parent', 'student'];

/* ---- create gating ---- */
// admin-only module (default): timetable, fee structures, exams
for (const r of ROLES) {
  const allowed = r === 'superadmin' || r === 'schooladmin';
  ok(`${r} create on admin-only module = ${allowed}`, canCreateModule(r, undefined) === allowed);
}
// teacher-creatable module: assignments, discipline
const TEACHER_CREATE = ['schooladmin', 'superadmin', 'teacher'];
ok('teacher may create an assignment', canCreateModule('teacher', TEACHER_CREATE) === true);
ok('student may NOT create an assignment', canCreateModule('student', TEACHER_CREATE) === false);
ok('parent may NOT create an assignment', canCreateModule('parent', TEACHER_CREATE) === false);
// finance staff module: fee structures
const FIN = ['schooladmin', 'superadmin', 'accountant'];
ok('accountant may create a fee structure', canCreateModule('accountant', FIN) === true);
ok('teacher may NOT create a fee structure', canCreateModule('teacher', FIN) === false);
ok('parent may NOT create a fee structure', canCreateModule('parent', FIN) === false);

/* ---- row-action gating (exams/results workflow) ---- */
const RESULT_ACTIONS = [
  { label: 'Gudbi', roles: ['schooladmin', 'superadmin', 'teacher'] },
  { label: 'Ansixi', roles: ['schooladmin', 'superadmin'] },
  { label: 'Daabac', roles: ['schooladmin', 'superadmin'] },
];
const teacherActions = visibleRowActions('teacher', RESULT_ACTIONS).map((a) => a.label);
ok('teacher sees Submit but NOT Approve/Publish', teacherActions.length === 1 && teacherActions[0] === 'Gudbi');
const adminActions = visibleRowActions('schooladmin', RESULT_ACTIONS).map((a) => a.label);
ok('school admin sees Submit + Approve + Publish', adminActions.length === 3);
ok('student sees NO result actions', visibleRowActions('student', RESULT_ACTIONS).length === 0);
ok('parent sees NO result actions', visibleRowActions('parent', RESULT_ACTIONS).length === 0);

/* ---- payments ---- */
ok('accountant may record a payment', canRecordPayment('accountant') === true);
ok('admin may record a payment', canRecordPayment('schooladmin') === true);
for (const r of ['teacher', 'parent', 'student']) {
  ok(`${r} may NOT record a payment`, canRecordPayment(r) === false);
}

/* ---- attendance marking vs read-only ---- */
for (const r of ['schooladmin', 'superadmin', 'teacher']) ok(`${r} may MARK attendance`, canMarkAttendance(r) === true);
for (const r of ['student', 'parent', 'accountant']) ok(`${r} gets READ-ONLY attendance`, canMarkAttendance(r) === false);

/* ---- defensive: an empty/garbage roles array falls back to admins-only ---- */
ok('empty createRoles falls back to admins-only', canCreateModule('teacher', []) === false && canCreateModule('schooladmin', []) === true);
ok('null actions yields no visible actions', visibleRowActions('schooladmin', null).length === 0);

console.log(failures === 0 ? '\nphase5-role-access: all assertions passed' : `\nphase5-role-access: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
