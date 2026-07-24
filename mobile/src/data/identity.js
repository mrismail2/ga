/* ============================================================
   Kobciye — Identity & ownership layer (frontend prototype)

   Stable IDs for access control. NEVER use class-name strings or student
   display names as access keys — two schools can both have a "Form 1A".
   Use: school_id, class_id, student_internal_id, child_student_ids.

   Two student identity fields:
     • student_internal_id — stable internal relationship key
     • student_id          — visible school-generated id + login identifier
   ============================================================ */
import { CLASSES, SCHOOL2_CLASSES, REGISTRY_STUDENTS, classId } from './mock';

export { classId };

/* GLOBALLY-UNIQUE class registry built from the class tuples.
   Every class_id embeds its school (school_001_class_form_1a) so two schools
   can each own a "Form 1A" without collision. `name` is display-only. */
export const CLASS_REGISTRY = [...CLASSES, ...SCHOOL2_CLASSES].map((c) => ({
  class_id: classId(c),                 // global id (reads school from tuple[7])
  id: classId(c),                       // alias kept for older callers
  school_id: c[7] || 'school_001',
  name: c[0],
  level: c[1] || '',
  tuple: c,
}));

/* resolve a class by its GLOBAL class_id */
export function getClassById(classId) {
  return CLASS_REGISTRY.find((c) => c.class_id === classId) || null;
}
export function getClassTupleById(classId) {
  const c = getClassById(classId);
  return c ? c.tuple : null;
}

/* every class belonging to one school (school-scoped, never name-keyed) */
export function getClassesBySchool(schoolId) {
  return CLASS_REGISTRY.filter((c) => c.school_id === schoolId);
}

/* display name for a class_id (UI only — never use the name as a key) */
export function getClassDisplayName(classId) {
  const c = getClassById(classId);
  return c ? c.name : classId;
}

/* may this profile access this class? (school_id + assignment/ownership) */
export function canAccessClass(profile, classId) {
  if (!profile || !classId) return false;
  const cls = getClassById(classId);
  if (!cls) return false;
  if (profile.school_id === '*') return true;             // Super Admin: any
  if (cls.school_id !== profile.school_id) return false;  // school isolation
  switch (profile.scope) {
    case 'school': return true;                            // School Admin: own school
    case 'assigned':                                       // Teacher: assigned classes
      return (profile.assigned_class_ids || []).indexOf(classId) !== -1;
    case 'children':                                       // Parent: child's class
      return getParentAccessibleClassIds(profile).indexOf(classId) !== -1;
    case 'self':                                           // Student: own class
      return getStudentAccessibleClassIds(profile).indexOf(classId) !== -1;
    default: return false;                                 // Accountant: no classes
  }
}

/* the canonical student registry (single source — defined in mock.js) */
export const STUDENT_REGISTRY = REGISTRY_STUDENTS;

export function getStudentByInternalId(studentInternalId) {
  return STUDENT_REGISTRY.find((s) => s.student_internal_id === studentInternalId) || null;
}
/* look up by the VISIBLE student_id (HID-…) — for display/login only */
export function getStudentByStudentId(studentId) {
  return STUDENT_REGISTRY.find((s) => s.student_id === studentId) || null;
}
/* legacy lookup: accepts the visible student_id (HID-…) or an old code (KOB-STU-…) */
export function getStudentByStudentCode(code) {
  return STUDENT_REGISTRY.find((s) => s.student_id === code || s.code === code) || null;
}
/* the class_id a student belongs to (by internal id) */
export function getStudentClassId(studentInternalId) {
  const s = getStudentByInternalId(studentInternalId);
  return s ? s.class_id : null;
}

/* one-time migration: turn any legacy student reference (old KOB-STU-* code or
   a student_id) into a normalized record keyed by student_internal_id, while
   preserving the visible student_id and avoiding duplicates. */
export function normalizeLegacyStudentData(records = []) {
  const seen = new Set();
  const out = [];
  records.forEach((r) => {
    const match = r.student_internal_id
      ? getStudentByInternalId(r.student_internal_id)
      : getStudentByStudentCode(r.code || r.student_id || r.studentCode);
    const internal = (match && match.student_internal_id) || r.student_internal_id;
    if (!internal || seen.has(internal)) return;     // skip duplicates / unresolved
    seen.add(internal);
    out.push({
      student_internal_id: internal,
      student_id: (match && match.student_id) || r.student_id || r.code || '',
      school_id: (match && match.school_id) || r.school_id || 'school_001',
      class_id: (match && match.class_id) || r.class_id || null,
      full_name: (match && match.full_name) || r.full_name || r.name || '',
      status: r.status || 'active',
    });
  });
  return out;
}

/* the login identifier shown for a student (their school-prefixed Student ID) */
export function getStudentLoginIdentifier(student) {
  return (student && (student.student_id || student.code)) || '';
}

/* normalise any student-ish record to the canonical identity shape */
export function normalizeStudentRecord(student) {
  if (!student) return null;
  const schoolId = student.school_id || 'school_001';
  return {
    student_internal_id: student.student_internal_id || ('gen_' + (student.code || student.student_id || '')),
    student_id: student.student_id || student.code || '',
    school_id: schoolId,
    class_id: student.class_id || (student.className ? classId(student.className, schoolId) : null),
    full_name: student.full_name || student.name || '',
    status: student.status || 'active',
  };
}

/* ---- parent / student ownership (by IDs, never names/class strings) ---- */
export function getParentChildren(profile) {
  const ids = (profile && profile.child_student_ids) || [];
  return ids.map(getStudentByInternalId).filter(Boolean);
}
export function getStudentClass(studentInternalId) {
  const s = getStudentByInternalId(studentInternalId);
  return s ? getClassById(s.class_id) : null;
}
export function getParentAccessibleClassIds(profile) {
  return Array.from(new Set(getParentChildren(profile).map((s) => s.class_id)));
}
export function getStudentAccessibleClassIds(profile) {
  const s = getStudentByInternalId(profile && profile.student_internal_id);
  return s ? [s.class_id] : (profile && profile.class_id ? [profile.class_id] : []);
}
export function canParentAccessStudent(profile, studentInternalId) {
  return (profile && (profile.child_student_ids || []).indexOf(studentInternalId) !== -1) || false;
}
export function canStudentAccessOwnRecord(profile, studentInternalId) {
  return !!(profile && profile.student_internal_id && profile.student_internal_id === studentInternalId);
}
