/* ============================================================
   Kobciye — Data selectors (the read interface for screens)

   Pure, role-aware selectors over the central store. Screens import these
   (plus useAppData) instead of touching raw arrays. The filtering logic is
   the canonical access layer (data/access.js); this module is the single
   selector surface so screens never reach into raw data.
   ============================================================ */
export {
  filterStudentsForProfile,
  filterClassesForProfile,
  filterAttendanceForProfile,
  filterPaymentsForProfile,
  filterExamsForProfile,
  filterResultsForProfile,
  filterIncidentsForProfile,
  filterMessagesForProfile,
  getIncidentsByClass,
  getIncidentsForStudent,
} from '../data/access';

/* ---- canonical exam/result selectors (object shape, role-aware) ---- */

/* exams visible to a profile (school + teacher-assignment + published gates).
   For a parent, pass the children's class_ids via opts.childClassIds (derived
   from the central students array) so no other class's exams leak. */
export function selectExamsForProfile(profile, exams, opts = {}) {
  const rows = exams || [];
  if (!profile) return [];
  if (profile.school_id === '*') return rows;                       // Super Admin
  const inSchool = rows.filter((e) => e.school_id === profile.school_id);
  switch (profile.scope) {
    case 'school': return inSchool;                                 // School Admin
    case 'assigned': {                                              // Teacher
      const cls = profile.assigned_class_ids || [];
      const subs = profile.assigned_subject_ids || [];
      return inSchool.filter((e) => cls.indexOf(e.class_id) !== -1 && (subs.length === 0 || subs.indexOf(e.subject_id) !== -1));
    }
    case 'children': {                                              // Parent: published only, child's class
      const childClassIds = new Set(opts.childClassIds || []);
      return inSchool.filter((e) => e.status === 'published' && childClassIds.has(e.class_id));
    }
    case 'self':                                                    // Student: published only, own class
      return inSchool.filter((e) => e.status === 'published' && e.class_id === profile.class_id);
    default: return [];                                             // Accountant: none
  }
}

/* results visible to a profile (parents/students see PUBLISHED only) */
export function selectResultsForProfile(profile, results) {
  const rows = results || [];
  if (!profile) return [];
  if (profile.school_id === '*') return rows;
  const inSchool = rows.filter((r) => r.school_id === profile.school_id);
  switch (profile.scope) {
    case 'school': return inSchool;
    case 'assigned': {
      const cls = profile.assigned_class_ids || [];
      return inSchool.filter((r) => cls.indexOf(r.class_id) !== -1);
    }
    case 'children':
      return inSchool.filter((r) => r.published === true && (profile.child_student_ids || []).indexOf(r.student_internal_id) !== -1);
    case 'self':
      return inSchool.filter((r) => r.published === true && r.student_internal_id === profile.student_internal_id);
    default: return [];
  }
}

/* student roster for a class from the central students array */
export function selectStudentsByClass(students, schoolId, classId) {
  return (students || []).filter((s) => s.school_id === schoolId && s.class_id === classId);
}
export function selectActiveStudentsBySchool(students, schoolId) {
  return (students || []).filter((s) => s.school_id === schoolId && s.status === 'active');
}
