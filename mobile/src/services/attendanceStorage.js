/* ============================================================
   Kobciye — Attendance storage service (frontend prototype)

   Persists attendance to AsyncStorage so a saved register survives
   closing/reopening the class screen. NO backend — local, device-only.

   A register is stored under a SCHOOL- and CLASS-safe key (never the class
   display name, since two schools can both have a "Form 1A"):

     attendance:${schoolId}:${classId}:${date}

   Each record:
     { school_id, class_id, student_internal_id, attendance_date,
       status, reason, notes, recorded_by, recorded_at, updated_at }
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'attendance:';
const keyFor = (schoolId, classId, date) => `${PREFIX}${schoolId}:${classId}:${date}`;

/* statuses that require a reason before they can be saved */
export const REASON_REQUIRED = ['absent', 'late', 'excused'];
export function reasonRequired(status) {
  return REASON_REQUIRED.indexOf(status) !== -1;
}

async function readKey(k) {
  try {
    const raw = await AsyncStorage.getItem(k);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

/* every attendance entry across all keys (used by student/parent history) */
export async function loadAttendanceRecords(schoolId) {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith(PREFIX) && (!schoolId || k.startsWith(`${PREFIX}${schoolId}:`)));
    const pairs = await AsyncStorage.multiGet(keys);
    const out = [];
    pairs.forEach(([, v]) => { try { const a = JSON.parse(v); if (Array.isArray(a)) out.push(...a); } catch (e) {} });
    return out;
  } catch (e) { return []; }
}

function normalise(e, ctx, now) {
  return {
    school_id: e.school_id || ctx.school_id || 'school_001',
    class_id: e.class_id || ctx.class_id,
    student_internal_id: e.student_internal_id,
    attendance_date: e.attendance_date || ctx.date,
    status: e.status || 'present',
    reason: e.reason || null,
    notes: e.notes || '',
    recorded_by: e.recorded_by || ctx.recorded_by || 'unknown',
    recorded_at: e.recorded_at || now,
    updated_at: now,
  };
}

/* Save (replace) one class register for one date. `records` is an array of
   { student_internal_id, status, reason?, notes? }. Throws on a missing
   reason for absent/late/excused. Keyed by school_id + class_id + date. */
export async function saveClassAttendance(schoolId, classId, date, records, ctx = {}) {
  const now = new Date().toISOString();
  const missing = (records || []).filter((r) => reasonRequired(r.status) && !(r.reason && String(r.reason).trim()));
  if (missing.length) {
    const err = new Error('reason_required');
    err.code = 'reason_required';
    err.students = missing.map((m) => m.student_internal_id);
    throw err;
  }
  const fresh = (records || []).map((r) => normalise(
    { ...r, school_id: schoolId, class_id: classId, attendance_date: date },
    { school_id: schoolId, class_id: classId, date, recorded_by: ctx.recorded_by },
    now,
  ));
  await AsyncStorage.setItem(keyFor(schoolId, classId, date), JSON.stringify(fresh)).catch(() => {});
  return fresh;
}

/* the saved register for one class on one date */
export async function getClassAttendance(schoolId, classId, date) {
  return readKey(keyFor(schoolId, classId, date));
}

/* full attendance history for one student (by internal id), newest first */
export async function getStudentAttendance(schoolId, studentInternalId) {
  const all = await loadAttendanceRecords(schoolId);
  return all
    .filter((e) => e.student_internal_id === studentInternalId)
    .sort((a, b) => (a.attendance_date < b.attendance_date ? 1 : -1));
}

/* { student_internal_id: {status,reason,notes} } for re-hydrating the marking UI */
export async function getClassMarksMap(schoolId, classId, date) {
  const rows = await getClassAttendance(schoolId, classId, date);
  const map = {};
  rows.forEach((r) => { map[r.student_internal_id] = { status: r.status, reason: r.reason, notes: r.notes }; });
  return map;
}

/* parent: saved attendance for each linked child (grouped by child) */
export async function getAttendanceHistoryForParent(profile) {
  const ids = (profile && profile.child_student_ids) || [];
  const out = {};
  for (const id of ids) out[id] = await getStudentAttendance(profile.school_id, id);
  return out;
}

/* student: saved attendance for the student's own internal id */
export async function getAttendanceHistoryForStudent(profile) {
  return getStudentAttendance(profile.school_id, profile && profile.student_internal_id);
}
