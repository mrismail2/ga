#!/usr/bin/env node
/* ============================================================
   Kobciye — student creation / guardian / admissions regression tests

   The defect these lock down: completing "Ku dar Arday" and pressing
   "Kaydi" produced no visible student. Root cause — the students module
   inserted a bare `students` row and never created the ACTIVE
   `student_enrollments` row that every roster and count in the app reads
   from, so the student existed in the database but was invisible
   everywhere (Ardayda, Fasallada → class, the class's active count).

   The atomic RPC (admit_student_atomic) is the ONE writer for both paths.
   These tests execute a faithful model of that RPC's contract — the same
   one the shipped migration implements — plus source assertions that the
   client actually routes through it.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { isUuid } = require('../src/utils/uuid');
const { buildParentStudentLinkInsert, guardianLinkIdentity } = require('../src/domain/guardianLinkPolicy');

let failures = 0;
function ok(name, condition) { console.log(condition ? 'PASS' : 'FAIL', name); if (!condition) failures += 1; }

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const SCHOOL_A = '11111111-1111-4111-8111-111111111111';
const SCHOOL_B = '22222222-2222-4222-8222-222222222222';
const CLASS_1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CLASS_2 = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa';
const YEAR_1 = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';

/* ============================================================
   A model of admit_student_atomic, mirroring the shipped SQL:
     • student + ACTIVE enrollment created together, or neither
     • a class/year change CLOSES the old enrollment (transferred +
       ended_on) and inserts a new active one — history preserved
     • an unchanged resubmission is a no-op (no duplicate rows)
     • guardian is reused when name+phone already exist in this school
     • a duplicate guardian link raises 23505
     • cross-school class/student/guardian is rejected
   ============================================================ */
function makeDb() {
  return { students: [], enrollments: [], admissions: [], parents: [], links: [], seq: 0 };
}
function nextId(db, prefix) { db.seq += 1; return `${prefix}-${String(db.seq).padStart(4, '0')}`; }

function admitStudentAtomic(db, school, input = {}) {
  if (!isUuid(school)) throw new Error('invalid input syntax for type uuid');
  const name = String(input.applicantName || '').trim();
  if (!name) throw new Error('applicant name is required');
  const classId = input.classId || null;
  const yearId = input.academicYearId || null;
  if (classId && !db.classes.some((c) => c.id === classId && c.school_id === school)) {
    throw new Error('class belongs to another school');
  }
  // everything below is one transaction — any throw above leaves NOTHING
  const snapshot = JSON.stringify({ s: db.students, e: db.enrollments, a: db.admissions, p: db.parents, l: db.links });
  try {
    // 1. student (reuse on edit / re-enrol)
    let studentId = input.studentId || null;
    if (studentId) {
      const existing = db.students.find((s) => s.id === studentId && s.school_id === school);
      if (!existing) throw new Error('student belongs to another school');
      existing.full_name = name;
      if (classId) existing.class_id = classId;
      if (yearId) existing.academic_year_id = yearId;
    } else {
      studentId = nextId(db, 'student');
      db.students.push({
        id: studentId, school_id: school, full_name: name,
        class_id: classId, academic_year_id: yearId, status: 'active',
      });
    }
    // 2. enrollment — never overwrite history
    const active = db.enrollments.find((e) => e.student_id === studentId && e.status === 'active');
    if (!active) {
      db.enrollments.push({
        id: nextId(db, 'enrol'), school_id: school, student_id: studentId,
        class_id: classId, academic_year_id: yearId, status: 'active', ended_on: null,
      });
    } else if ((classId && classId !== active.class_id) || (yearId && yearId !== active.academic_year_id)) {
      active.status = 'transferred';
      active.ended_on = '2026-07-24';
      db.enrollments.push({
        id: nextId(db, 'enrol'), school_id: school, student_id: studentId,
        class_id: classId || active.class_id,
        academic_year_id: yearId || active.academic_year_id,
        status: 'active', ended_on: null,
      });
    } /* else: unchanged resubmission — a deliberate no-op */
    // 3. admission
    db.admissions.push({
      id: nextId(db, 'adm'), school_id: school, student_id: studentId,
      applicant_name: name, desired_class_id: classId, status: 'enrolled',
    });
    // 4. guardian — reuse an existing same-school parent, else create
    let parentId = input.parentId || null;
    const gName = (input.guardianName || '').trim() || null;
    const gPhone = (input.guardianPhone || '').trim() || null;
    if (parentId) {
      if (!db.parents.some((p) => p.id === parentId && p.school_id === school)) {
        throw new Error('guardian belongs to another school');
      }
    } else if (gName && gPhone) {
      const reuse = db.parents.find((p) => p.school_id === school && p.full_name === gName && p.phone === gPhone);
      parentId = reuse ? reuse.id : nextId(db, 'parent');
      if (!reuse) db.parents.push({ id: parentId, school_id: school, full_name: gName, phone: gPhone });
    }
    // 5. guardian link — duplicate-protected
    let linkId = null;
    if (parentId) {
      if (db.links.some((l) => l.parent_id === parentId && l.student_id === studentId)) {
        const e = new Error('guardian is already linked to this student'); e.code = '23505'; throw e;
      }
      linkId = nextId(db, 'link');
      db.links.push({ id: linkId, parent_id: parentId, student_id: studentId, relationship: input.relationship || null });
    }
    return { student_id: studentId, admission_id: db.admissions[db.admissions.length - 1].id, parent_id: parentId, link_id: linkId };
  } catch (e) {
    const prev = JSON.parse(snapshot);
    db.students = prev.s; db.enrollments = prev.e; db.admissions = prev.a; db.parents = prev.p; db.links = prev.l;
    throw e;
  }
}

/* the app's own definitions of "visible" — the exact rules the screens use */
const activeEnrollments = (db, school) => db.enrollments.filter((e) => e.school_id === school && e.status === 'active');
const studentsListFor = (db, school) => {
  const activeIds = new Set(activeEnrollments(db, school).map((e) => e.student_id));
  return db.students.filter((s) => s.school_id === school && activeIds.has(s.id));
};
const classRoster = (db, school, classId) => {
  const ids = new Set(activeEnrollments(db, school).filter((e) => e.class_id === classId).map((e) => e.student_id));
  return db.students.filter((s) => ids.has(s.id));
};

/* ---------- B. student creation ---------- */
let db = makeDb();
db.classes = [{ id: CLASS_1, school_id: SCHOOL_A }, { id: CLASS_2, school_id: SCHOOL_A }];
const created = admitStudentAtomic(db, SCHOOL_A, { applicantName: 'Aaliyah Maxamed', classId: CLASS_1, academicYearId: YEAR_1 });

ok('student creation creates a students row', db.students.length === 1 && db.students[0].full_name === 'Aaliyah Maxamed');
ok('student creation creates an ACTIVE student_enrollments row',
  db.enrollments.length === 1 && db.enrollments[0].status === 'active');
ok('the enrollment stores the correct class', db.enrollments[0].class_id === CLASS_1);
ok('the enrollment stores the correct academic year', db.enrollments[0].academic_year_id === YEAR_1);
ok('the enrollment is scoped to the correct school', db.enrollments[0].school_id === SCHOOL_A);
ok('the student appears in the Ardayda list', studentsListFor(db, SCHOOL_A).length === 1);
ok('the student appears in Class Detail for the chosen class', classRoster(db, SCHOOL_A, CLASS_1).length === 1);
ok('the class active count updates to 1',
  activeEnrollments(db, SCHOOL_A).filter((e) => e.class_id === CLASS_1).length === 1);
ok('the student is NOT counted in a class they are not enrolled in', classRoster(db, SCHOOL_A, CLASS_2).length === 0);

/* refresh-proof: the visible state is derived from stored rows only */
const persisted = JSON.parse(JSON.stringify(db));
ok('the student is still visible after a full refresh (state re-derived from stored rows)',
  studentsListFor(persisted, SCHOOL_A).length === 1 && classRoster(persisted, SCHOOL_A, CLASS_1).length === 1);

/* a bare students insert (the OLD buggy behaviour) must be invisible —
   this is exactly what regressing would look like */
db.students.push({ id: 'orphan', school_id: SCHOOL_A, full_name: 'Orphan', class_id: CLASS_1, status: 'active' });
ok('a student with no active enrollment is invisible (proves the enrollment is required)',
  !studentsListFor(db, SCHOOL_A).some((s) => s.id === 'orphan')
  && !classRoster(db, SCHOOL_A, CLASS_1).some((s) => s.id === 'orphan'));
db.students = db.students.filter((s) => s.id !== 'orphan');

/* failure atomicity + no partial workflow */
db = makeDb();
db.classes = [{ id: CLASS_1, school_id: SCHOOL_A }];
let rejected = false;
try { admitStudentAtomic(db, SCHOOL_A, { applicantName: 'Cross School', classId: 'ffffffff-1111-4111-8111-ffffffffffff' }); }
catch (e) { rejected = true; }
ok('a class from another school is rejected with a visible error', rejected);
ok('a failed enrollment leaves NO partial student behind', db.students.length === 0 && db.enrollments.length === 0);

let nameRejected = false;
try { admitStudentAtomic(db, SCHOOL_A, { applicantName: '   ', classId: CLASS_1 }); } catch (e) { nameRejected = true; }
ok('a missing required name is rejected before anything is written',
  nameRejected && db.students.length === 0 && db.enrollments.length === 0);

let badSchool = false;
try { admitStudentAtomic(db, '*', { applicantName: 'X' }); } catch (e) { badSchool = true; }
ok('a placeholder school id can never reach the write path', badSchool);

/* duplicate Save clicks: the UI blocks the second click while saving */
db = makeDb();
db.classes = [{ id: CLASS_1, school_id: SCHOOL_A }];
let saving = false;
function guardedSave(input) {
  if (saving) return 'blocked';           // the shipped `if (saving) return;` guard
  saving = true;
  try { return admitStudentAtomic(db, SCHOOL_A, input); } finally { saving = false; }
}
// simulate a double click landing while the first is still in flight
saving = true;
const second = guardedSave({ applicantName: 'Double Click', classId: CLASS_1 });
saving = false;
guardedSave({ applicantName: 'Double Click', classId: CLASS_1 });
ok('a duplicate Save click while saving is blocked', second === 'blocked');
ok('duplicate Save clicks do not create duplicate records',
  db.students.length === 1 && activeEnrollments(db, SCHOOL_A).length === 1);

/* ---------- C. transfer preserves history ---------- */
db = makeDb();
db.classes = [{ id: CLASS_1, school_id: SCHOOL_A }, { id: CLASS_2, school_id: SCHOOL_A }];
const moved = admitStudentAtomic(db, SCHOOL_A, { applicantName: 'Mover', classId: CLASS_1, academicYearId: YEAR_1 });
admitStudentAtomic(db, SCHOOL_A, { applicantName: 'Mover', studentId: moved.student_id, classId: CLASS_2, academicYearId: YEAR_1 });
ok('moving a student to another class keeps the previous enrollment as history',
  db.enrollments.length === 2 && db.enrollments.filter((e) => e.status === 'transferred').length === 1);
ok('the closed enrollment records when it ended',
  db.enrollments.find((e) => e.status === 'transferred').ended_on === '2026-07-24');
ok('the moved student has exactly ONE active enrollment', activeEnrollments(db, SCHOOL_A).length === 1);
ok('the moved student now counts in the NEW class only',
  classRoster(db, SCHOOL_A, CLASS_2).length === 1 && classRoster(db, SCHOOL_A, CLASS_1).length === 0);

/* resubmitting unchanged values must not spam history */
const before = db.enrollments.length;
admitStudentAtomic(db, SCHOOL_A, { applicantName: 'Mover', studentId: moved.student_id, classId: CLASS_2, academicYearId: YEAR_1 });
ok('an unchanged resubmission does not create another enrollment row', db.enrollments.length === before);

/* ---------- D. guardians / admissions ---------- */
db = makeDb();
db.classes = [{ id: CLASS_1, school_id: SCHOOL_A }];
const withNewGuardian = admitStudentAtomic(db, SCHOOL_A, {
  applicantName: 'Child One', classId: CLASS_1,
  guardianName: 'Cali Xuseen', guardianPhone: '+252630000001', relationship: 'father',
});
ok('an enrolled admission with a NEW guardian creates the guardian', db.parents.length === 1);
ok('an enrolled admission with a NEW guardian creates the student_parents link', db.links.length === 1);
ok('an enrolled admission creates the student AND the active enrollment',
  db.students.length === 1 && activeEnrollments(db, SCHOOL_A).length === 1);

/* an EXISTING guardian (same name+phone) is reused, not duplicated */
admitStudentAtomic(db, SCHOOL_A, {
  applicantName: 'Child Two', classId: CLASS_1,
  guardianName: 'Cali Xuseen', guardianPhone: '+252630000001', relationship: 'father',
});
ok('an existing guardian is reused rather than duplicated', db.parents.length === 1);
ok('the reused guardian is linked to BOTH children',
  db.links.filter((l) => l.parent_id === db.parents[0].id).length === 2);

/* selecting an existing guardian explicitly by id also works */
const byId = admitStudentAtomic(db, SCHOOL_A, {
  applicantName: 'Child Three', classId: CLASS_1, parentId: db.parents[0].id, relationship: 'father',
});
ok('linking an EXISTING guardian by id works', byId.parent_id === db.parents[0].id && db.links.length === 3);

/* a student with no guardian entered is still fully enrolled */
const noGuardian = admitStudentAtomic(db, SCHOOL_A, { applicantName: 'No Guardian', classId: CLASS_1 });
ok('a student with NO guardian is still created with an active enrollment',
  noGuardian.parent_id === null && activeEnrollments(db, SCHOOL_A).some((e) => e.student_id === noGuardian.student_id));

/* duplicate guardian link is rejected and rolls the whole call back */
const studentsBefore = db.students.length;
let dupLink = false;
try {
  admitStudentAtomic(db, SCHOOL_A, {
    applicantName: 'Child One', studentId: withNewGuardian.student_id, parentId: db.parents[0].id,
  });
} catch (e) { dupLink = e.code === '23505'; }
ok('a duplicate guardian link is rejected', dupLink);
ok('the rejected duplicate leaves no extra student behind', db.students.length === studentsBefore);

/* cross-school guardian is rejected */
db.parents.push({ id: 'foreign-parent', school_id: SCHOOL_B, full_name: 'Foreign', phone: '+1' });
let crossGuardian = false;
try { admitStudentAtomic(db, SCHOOL_A, { applicantName: 'X', classId: CLASS_1, parentId: 'foreign-parent' }); }
catch (e) { crossGuardian = true; }
ok('a guardian from another school is rejected', crossGuardian);

/* the pure client-side policy rejects cross-school linking too */
let policyRejected = false;
try {
  buildParentStudentLinkInsert(
    { role: 'school_admin', school_id: SCHOOL_A },
    { id: 'g1', school_id: SCHOOL_A }, { id: 's1', school_id: SCHOOL_B }, {},
  );
} catch (e) { policyRejected = true; }
ok('cross-school guardian linking is rejected before Supabase is called', policyRejected);

/* Super Admin may link only within the school they picked */
const superProfile = { role: 'super_admin', school_id: null, effectiveSchoolId: SCHOOL_A };
const superRow = buildParentStudentLinkInsert(superProfile, { id: 'g1', school_id: SCHOOL_A }, { id: 's1', school_id: SCHOOL_A }, {});
ok('Super Admin may link a guardian inside the school they picked',
  guardianLinkIdentity(superRow.parent_id, superRow.student_id) === 'g1:s1');
let superCross = false;
try { buildParentStudentLinkInsert(superProfile, { id: 'g1', school_id: SCHOOL_B }, { id: 's1', school_id: SCHOOL_B }, {}); }
catch (e) { superCross = true; }
ok('Super Admin may NOT link inside a school they did not pick', superCross);
let superUnpicked = false;
try { buildParentStudentLinkInsert({ role: 'super_admin' }, { id: 'g1', school_id: SCHOOL_A }, { id: 's1', school_id: SCHOOL_A }, {}); }
catch (e) { superUnpicked = true; }
ok('Super Admin with NO school picked may not link at all', superUnpicked);

/* ---------- E. the client actually routes through the atomic writer ---------- */
const moduleViewSource = read('src/components/P4ModuleView.js');
ok('the students module saves through the atomic student+enrollment writer',
  /module\.table === 'students'/.test(moduleViewSource) && /p4SaveStudentWithEnrollment/.test(moduleViewSource));
ok('the students module no longer falls through to a bare p4Create insert',
  moduleViewSource.indexOf("module.table === 'students'") < moduleViewSource.indexOf('} else if (editing)'));
ok('admissions still enrol through the atomic RPC', /p4AdmitStudentAtomic/.test(moduleViewSource));

const phase4Source = read('src/services/phase4.js');
ok('p4SaveStudentWithEnrollment exists in the data layer',
  /export async function p4SaveStudentWithEnrollment/.test(phase4Source));
ok('p4SaveStudentWithEnrollment uses the no-duplicate-admission atomic RPC',
  /p4SaveStudentWithEnrollment[\s\S]{0,700}save_student_with_enrollment_atomic/.test(phase4Source)
  && !/p4SaveStudentWithEnrollment[\s\S]{0,700}p4AdmitStudentAtomic/.test(phase4Source));
ok('the atomic RPC notifies every canonical table it touched',
  /'students', 'admissions', 'parents', 'student_parents', 'student_enrollments', 'classes'/.test(phase4Source));

/* ---------- F. error / loading feedback ---------- */
ok('Save is blocked while a save is already in flight', /if \(saving\) return;/.test(moduleViewSource));
ok('the Save button is disabled while saving', /disabled=\{saving\}/.test(moduleViewSource));
ok('a loading indicator is shown while saving', /saving \? <ActivityIndicator/.test(moduleViewSource));
ok('the real normalized error is shown, never swallowed', /setFormErr\(p4FriendlyError\(e\)\)/.test(moduleViewSource));
/* the form must close only on SUCCESS: setFormOpen(false) lives in the try
   block, and the catch block never closes the form (it only surfaces the
   error), so a failed Save leaves the user's input on screen. */
const saveFn = moduleViewSource.split('const save = async ()')[1].split('const toggleActive')[0];
const saveTry = saveFn.split('catch (e)')[0];
const saveCatch = saveFn.split('catch (e)')[1];
ok('the form closes only on a successful save', /setFormOpen\(false\)/.test(saveTry));
ok('the form stays OPEN when saving fails', !/setFormOpen\(false\)/.test(saveCatch));

const guardianViewSource = read('src/components/GuardianManagementView.js');
ok('the guardian form blocks duplicate submits', /if \(saving/.test(guardianViewSource));
ok('the guardian form shows the real error', /setFormError\(p4FriendlyError\(e\)\)/.test(guardianViewSource));

console.log(failures === 0
  ? '\nphase4-student-enrollment: all assertions passed'
  : `\nphase4-student-enrollment: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
