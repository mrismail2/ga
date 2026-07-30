/* ============================================================
   Kobciye — Role / profile access layer (frontend prototype)

   Filters mock data by the active profile so each role sees ONLY what
   it is allowed to:
     • by school_id   (record.school_id === profile.school_id)
     • by class assignment (teacher)
     • by child links (parent) / self (student)
     • by granular permissions (teacher, set by School Admin)

   This is UI-preview isolation only. Real enforcement must move to the
   backend (authentication + database row-level policies) in later phases.
   ============================================================ */

import {
  classId, getParentAccessibleClassIds, getStudentAccessibleClassIds,
  canParentAccessStudent, canStudentAccessOwnRecord,
} from './identity';

export { classId };

/* what each role may open. Teacher access is additionally gated by the
   per-permission grants below. */
const MODULES = {
  superadmin: '*',
  schooladmin: '*',
  teacher: ['dashboard', 'classes', 'attendance', 'exams', 'lessons', 'incidents', 'reports', 'messages', 'settings'],
  accountant: ['dashboard', 'finance', 'billing', 'reports', 'settings'],
  parent: ['dashboard', 'attendance', 'finance', 'exams', 'incidents', 'notice', 'settings'], // NO direct messages
  student: ['dashboard', 'attendance', 'finance', 'exams', 'notice', 'messages', 'settings'], // NO incidents module
};

export function canViewModule(profile, moduleName) {
  const m = MODULES[profile.key];
  return m === '*' || (Array.isArray(m) && m.indexOf(moduleName) !== -1);
}

/* ---- current session helpers ----------------------------------------
   RoleContext registers the active profile here so non-React modules can
   read it. (Frontend prototype only.) */
let _currentProfile = null;
export function setCurrentProfile(p) { _currentProfile = p; }
export function getCurrentProfile() { return _currentProfile; }
export function getCurrentRole() { return _currentProfile ? _currentProfile.key : null; }
export function getCurrentSchoolId() { return _currentProfile ? _currentProfile.school_id : null; }

/* ---- granular permissions (teacher) ----------------------------------
   The School Admin toggles these in the Permissions screen. Admins/Super
   Admins implicitly hold every permission. Permission keys come in two
   shapes — dotted ("attendance.mark") and underscored ("attendance_mark")
   — so we normalise and accept either. `profile.permissions` may be an
   array of dotted strings (legacy default) or an object of underscored
   booleans (persisted teacher grant). */
export function hasPermission(profile, perm) {
  if (!profile) return false;
  if (profile.scope === 'platform' || profile.scope === 'school') return true;
  const p = profile.permissions;
  if (!p) return false;
  const dot = perm.replace(/_/g, '.');
  const under = perm.replace(/\./g, '_');
  if (Array.isArray(p)) return p.indexOf(dot) !== -1 || p.indexOf(perm) !== -1;
  return p[under] === true || p[perm] === true;
}

/* ---- action gate -----------------------------------------------------
   Role-level allow-list first, then (for teachers) the granular permission.
   Use for buttons/flows like creating a class or marking attendance. */
const ACTION_ROLES = {
  'classes.create': ['superadmin', 'schooladmin'],
  'classes.edit': ['superadmin', 'schooladmin'],
  'classes.delete': ['superadmin', 'schooladmin'],
  'attendance.mark': ['superadmin', 'schooladmin', 'teacher'],
  'attendance.edit': ['superadmin', 'schooladmin', 'teacher'],
  'results.create': ['superadmin', 'schooladmin', 'teacher'],
  'results.update': ['superadmin', 'schooladmin', 'teacher'],
  'results.publish': ['superadmin', 'schooladmin', 'teacher'],
  'incidents.create': ['superadmin', 'schooladmin', 'teacher'],
  'messages.send': ['superadmin', 'schooladmin', 'teacher', 'student'],
};
export function canPerformAction(profile, action) {
  if (!profile) return false;
  const roles = ACTION_ROLES[action];
  if (roles && roles.indexOf(profile.key) === -1) return false;     // role not allowed
  if (profile.key === 'teacher') return hasPermission(profile, action); // teacher: fine-grained grant
  return true;                                                       // admins / other allowed roles
}

/* ---- school isolation helper ----------------------------------------
   The core rule: record.school_id === profile.school_id. A record with no
   school_id is treated as the legacy default (school_001). The Super Admin
   (school_id '*') sees every school. */
export function sameSchool(profile, record) {
  if (profile.school_id === '*') return true;
  const rs = (record && record.school_id) || 'school_001';
  return rs === (profile.school_id || 'school_001');
}
function bySchool(profile, records) {
  return (records || []).filter((r) => sameSchool(profile, r));
}

/* deterministic subject_id from a subject name ("Xisaab" -> "subject_xisaab") */
export function subjectId(name) {
  return 'subject_' + String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/* a teacher's assigned classes / subjects — returned as CANONICAL IDs
   (class_id / subject_id), never display names. */
export function getTeacherAllowedClasses(profile) {
  return profile.assigned_class_ids || [];
}
export function getTeacherAllowedSubjects(profile) {
  return profile.assigned_subject_ids || [];
}

/* ============================================================
   Class Detail access guard

   The Classes list is filtered, but a user could still try to open a
   class directly via navigation. The Class Detail screen must verify
   access against school_id, a teacher's assigned classes, and
   parent/student ownership BEFORE showing any data.
   ============================================================ */
function classSchoolId(cls) { return (cls && cls[7]) || 'school_001'; }
function classIdOf(cls) { return cls && cls[0]; }

/* may this profile OPEN the requested class at all? */
export function canAccessClassDetail(profile, cls) {
  if (!profile || !cls) return false;
  const sid = classSchoolId(cls);
  const cid = classIdOf(cls);
  switch (profile.scope) {
    case 'platform':
      return true;                                   // Super Admin: any class
    case 'school':
      return sid === profile.school_id;              // School Admin: own school only
    case 'assigned':                                 // Teacher: own school + assigned class
      return sid === profile.school_id && getTeacherAllowedClasses(profile).indexOf(classId(cls)) !== -1;
    case 'finance':
      return false;                                  // Accountant: never
    case 'children':                                 // Parent: only their child's class (by class_id)
      return sid === profile.school_id && getParentAccessibleClassIds(profile).indexOf(classId(cls)) !== -1;
    case 'self':                                     // Student: only their own class (by class_id)
      return sid === profile.school_id && getStudentAccessibleClassIds(profile).indexOf(classId(cls)) !== -1;
    default:
      return false;
  }
}

/* 'denied' | 'readonly' (parent/student) | 'full' (admins/teacher) */
export function getClassDetailModeForProfile(profile, cls) {
  if (!canAccessClassDetail(profile, cls)) return 'denied';
  if (profile.scope === 'children' || profile.scope === 'self') return 'readonly';
  return 'full';
}

/* which tabs this profile may see in Class Detail (role-aware). Teacher tabs
   are further gated by the School-Admin-granted permissions. */
export function getAllowedClassTabs(profile, cls) {
  if (!canAccessClassDetail(profile, cls)) return [];
  switch (profile.scope) {
    case 'platform':
    case 'school':
      return ['Ardayda', 'Xaadiris', 'Natiijada', 'Lacagta', 'Kiisaska'];
    case 'assigned': {
      const tabs = ['Ardayda'];
      if (hasPermission(profile, 'attendance_view')) tabs.push('Xaadiris');
      if (hasPermission(profile, 'results_view')) tabs.push('Natiijada');
      if (hasPermission(profile, 'incidents_view')) tabs.push('Kiisaska');
      return tabs; // teacher never sees class-wide payments (Lacagta)
    }
    case 'children':
    case 'self':
      // read-only, child/self only — incl. a read-only attendance section;
      // never class-wide list, incidents or settings
      return ['Ardayda', 'Xaadiris', 'Natiijada', 'Lacagta'];
    default:
      return [];
  }
}

/* send an unauthorized user back to a safe screen */
export function redirectUnauthorizedClassAccess(navigation) {
  if (!navigation) return;
  try {
    navigation.canGoBack && navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs');
  } catch (e) {
    navigation.goBack && navigation.goBack();
  }
}

/* ---- students (objects: { name, className, code, school_id }) -------- */
export function filterStudentsForProfile(profile, students) {
  const inSchool = bySchool(profile, students);
  switch (profile.scope) {
    case 'platform':
      return students; // every school
    case 'school':
    case 'finance':
      return inSchool;
    case 'assigned': {
      const cls = getTeacherAllowedClasses(profile);
      return inSchool.filter((s) => cls.indexOf(s.class_id) !== -1);
    }
    case 'children':
      // parent: own children, matched by stable student_internal_id
      return inSchool.filter((s) => canParentAccessStudent(profile, s.student_internal_id));
    case 'self':
      // student: own record, matched by stable student_internal_id
      return inSchool.filter((s) => canStudentAccessOwnRecord(profile, s.student_internal_id));
    default:
      return inSchool;
  }
}

/* ---- classes (tuple rows: [name, grade, …, school_id?]) -------------- */
export function filterClassesForProfile(profile, classes) {
  const tag = (c) => ({ school_id: c[7] || 'school_001' });
  const inSchool = profile.school_id === '*' ? classes : classes.filter((c) => sameSchool(profile, tag(c)));
  switch (profile.scope) {
    case 'assigned': {
      const cls = getTeacherAllowedClasses(profile);
      return inSchool.filter((c) => cls.indexOf(classId(c)) !== -1);
    }
    case 'children': {
      const ids = getParentAccessibleClassIds(profile);
      return inSchool.filter((c) => ids.indexOf(classId(c)) !== -1);
    }
    case 'self': {
      const ids = getStudentAccessibleClassIds(profile);
      return inSchool.filter((c) => ids.indexOf(classId(c)) !== -1);
    }
    default:
      return inSchool; // superadmin / schooladmin / accountant
  }
}

/* ---- attendance (objects with class_id/student_id/school_id) ---------
   Parent/Student see only their own; teacher sees assigned classes;
   admins see the whole school. Accountant gets nothing (no attendance). */
export function filterAttendanceForProfile(profile, records) {
  if (profile.scope === 'finance') return [];
  const inSchool = bySchool(profile, records);
  switch (profile.scope) {
    case 'platform':
      return records;
    case 'school':
      return inSchool;
    case 'assigned': {
      const cls = getTeacherAllowedClasses(profile);
      return inSchool.filter((r) => cls.indexOf(r.class_id) !== -1);
    }
    case 'children':
      return inSchool.filter((r) => (profile.child_student_ids || []).indexOf(r.student_internal_id) !== -1);
    case 'self':
      return inSchool.filter((r) => r.student_internal_id === profile.student_internal_id);
    default:
      return inSchool;
  }
}

/* ---- payments (tuple rows:
   [name, class, amount, method, date, status, student_code, school_id, student_internal_id]) ---
   Teacher gets none. Parent sees only their children's (by child_student_ids);
   student only their own (by student_internal_id). */
const paySchool = (p) => ({ school_id: p[7] || 'school_001' });
const payInternalId = (p) => p[8];
export function filterPaymentsForProfile(profile, payments) {
  const inSchool = profile.school_id === '*' ? payments : payments.filter((p) => sameSchool(profile, paySchool(p)));
  switch (profile.scope) {
    case 'platform':
      return payments;
    case 'school':
    case 'finance':
      return inSchool;
    case 'assigned':
      return []; // a teacher does not see fee payments
    case 'children':
      return inSchool.filter((p) => (profile.child_student_ids || []).indexOf(payInternalId(p)) !== -1);
    case 'self':
      return inSchool.filter((p) => payInternalId(p) === profile.student_internal_id);
    default:
      return inSchool;
  }
}

/* who may VIEW a payment record (after school isolation) */
export function canViewPayment(profile, payment) {
  if (!profile) return false;
  return filterPaymentsForProfile(profile, [payment]).length === 1;
}

/* who may EDIT payment data — ONLY Super Admin / School Admin / Accountant.
   Teacher, Parent and Student can never edit payments. */
export function canEditPayment(profile, payment) {
  if (!profile) return false;
  if (['superadmin', 'schooladmin', 'accountant'].indexOf(profile.key) === -1) return false;
  return profile.school_id === '*' || !payment || sameSchool(profile, { school_id: payment[7] || 'school_001' });
}

/* ---- exams (tuple rows:
   [class, subject, term, avg, pass%, school_id, subject_id, published]) ---
   Teacher: own school + assigned class + assigned subject. Parent/Student:
   ONLY published results for their class. Accountant: none. */
const examSchool = (e) => ({ school_id: e[5] || 'school_001' });
const isPublished = (e) => e[7] !== false; // default published unless explicitly false
export function filterExamsForProfile(profile, exams) {
  if (profile.scope === 'finance') return []; // accountant: no exams
  const inSchool = profile.school_id === '*' ? exams : exams.filter((e) => sameSchool(profile, examSchool(e)));
  switch (profile.scope) {
    case 'platform':
      return exams;
    case 'school':
      return inSchool;
    case 'assigned': {
      const cls = getTeacherAllowedClasses(profile);
      const subs = getTeacherAllowedSubjects(profile);
      return inSchool.filter((e) => cls.indexOf(classId(e[0], e[5])) !== -1 && (subs.length === 0 || subs.indexOf(subjectId(e[6] || e[1])) !== -1));
    }
    case 'children': {
      const ids = getParentAccessibleClassIds(profile);
      return inSchool.filter((e) => isPublished(e) && ids.indexOf(classId(e[0], e[5])) !== -1);
    }
    case 'self': {
      const ids = getStudentAccessibleClassIds(profile);
      return inSchool.filter((e) => isPublished(e) && ids.indexOf(classId(e[0], e[5])) !== -1);
    }
    default:
      return inSchool;
  }
}

/* Results share the exam rows; parents/students see only PUBLISHED ones. */
export function filterResultsForProfile(profile, results) {
  return filterExamsForProfile(profile, results);
}

/* ---- incidents. Display [0..8]; ownership [9]=school_id, [10]=class_id,
   [11]=student_internal_id, [12]=parent_visible_note. Filtering NEVER uses
   the class-name string — always school_id + class_id + student_internal_id.
   Student has no incidents module (returns []). Parent sees only
   parent-visible summaries for their own children. */
const incSchool = (it) => ({ school_id: it[9] || 'school_001' });
const incClassId = (it) => it[10];
const incInternalId = (it) => it[11];
export function filterIncidentsForProfile(profile, incidents) {
  if (profile.scope === 'self') return [];    // student: no full incidents module
  if (profile.scope === 'finance') return []; // accountant: no incidents at all
  const inSchool = profile.school_id === '*' ? incidents : incidents.filter((it) => sameSchool(profile, incSchool(it)));
  switch (profile.scope) {
    case 'platform':
      return incidents;
    case 'school':
      return inSchool;
    case 'assigned': {
      const ids = getTeacherAllowedClasses(profile);
      return inSchool.filter((it) => ids.indexOf(incClassId(it)) !== -1);
    }
    case 'children':
      return inSchool.filter((it) => it[8] === 'Haa'
        && (profile.child_student_ids || []).indexOf(incInternalId(it)) !== -1);
    default:
      return inSchool;
  }
}

/* incidents for one class (school + class scoped, role-aware) */
export function getIncidentsByClass(cid, profile, incidents) {
  return filterIncidentsForProfile(profile, incidents).filter((it) => incClassId(it) === cid);
}

/* incidents for one student (by internal id, role-aware) */
export function getIncidentsForStudent(studentInternalId, profile, incidents) {
  return filterIncidentsForProfile(profile, incidents).filter((it) => incInternalId(it) === studentInternalId);
}

/* ---- messages (objects with from/to/school_id) -----------------------
   Direct teacher–student chat ONLY. Parent and Accountant get nothing.
   Admins/Super Admin see a moderation summary, NOT private content (the
   message UI hides bodies for them — see MessagesScreen). */
export function filterMessagesForProfile(profile, messages) {
  if (profile.scope === 'children' || profile.scope === 'finance') return [];
  const inSchool = bySchool(profile, messages);
  switch (profile.scope) {
    case 'platform':
    case 'school':
      return inSchool; // moderation summary only
    case 'assigned': {
      // teacher ↔ students in assigned classes / subjects
      const cls = getTeacherAllowedClasses(profile);
      return inSchool.filter((m) => !m.class_id || cls.indexOf(m.class_id) !== -1);
    }
    case 'self':
      // student ↔ teachers of their class / subjects
      return inSchool.filter((m) => !m.student_internal_id || m.student_internal_id === profile.student_internal_id);
    default:
      return inSchool;
  }
}
