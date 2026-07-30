/* ============================================================
   Kobciye — Data migration (legacy → canonical v2)

   One controlled migration. On startup the repository:
     1. reads existing AsyncStorage,
     2. detects legacy / missing format,
     3. normalizes into the canonical v2 shape,
     4. saves it, marking schema_version = 2,
     5. never repeats or duplicates after success.

   Legacy tokens are allowed in THIS migration module only — never in active
   screens.
   ============================================================ */
import { buildSeedData, SCHEMA_VERSION } from '../data/seedData';
import { classId } from '../data/mock';

/* the empty canonical skeleton */
export function emptyAppData() {
  return {
    schema_version: SCHEMA_VERSION,
    schools: [], classes: [], students: [], profiles: [], subjects: [], teacher_permissions: [],
    terms: [], exam_windows: [],
    attendance: [], payments: [], billing_records: [], exams: [], results: [], incidents: [], messages: [],
    school_settings: [], grading_rules: [],
  };
}

/* migrate ONE legacy student record into canonical identity fields. Accepts
   old shapes (code / studentCode / className) and never duplicates. */
export function normalizeLegacyStudentData(records = []) {
  const seen = new Set();
  const out = [];
  (records || []).forEach((r) => {
    const internal = r.student_internal_id || ('gen_' + (r.code || r.student_id || r.studentCode || r.full_name || r.name || ''));
    if (!internal || seen.has(internal)) return;
    seen.add(internal);
    const schoolId = r.school_id || 'school_001';
    const studentId = r.student_id || r.code || r.studentCode || '';
    out.push({
      student_internal_id: internal,
      student_id: studentId,
      school_id: schoolId,
      class_id: r.class_id || (r.className ? classId(r.className, schoolId) : null),
      full_name: r.full_name || r.name || 'Arday',
      status: r.status || 'active',
      gender: r.gender || null,
      fee: r.fee || 'full',
      att: r.att != null ? r.att : 90,
      photo_uri: r.photo_uri != null ? r.photo_uri : null,
      name: r.full_name || r.name || 'Arday',
    });
  });
  return out;
}

/* true if the stored object is already canonical v2 */
export function isV2(data) {
  return !!(data && data.schema_version === SCHEMA_VERSION && Array.isArray(data.students) && Array.isArray(data.classes));
}

/* Produce a canonical v2 object from whatever was in storage.
   - nothing stored          → fresh seed
   - already v2              → returned unchanged (no reseed, no duplicates)
   - legacy/partial shape    → normalized, merged onto a fresh seed skeleton,
                                preserving any user-added students/attendance. */
export function migrateToV2(existing) {
  if (!existing) return buildSeedData();
  if (isV2(existing)) return existing;

  const base = buildSeedData();
  // legacy v1 student registry (array of student records) → merge as students
  if (Array.isArray(existing)) {
    const migrated = normalizeLegacyStudentData(existing);
    const seen = new Set(base.students.map((s) => s.student_internal_id));
    migrated.forEach((s) => { if (!seen.has(s.student_internal_id)) { seen.add(s.student_internal_id); base.students.push(s); } });
    return base;
  }
  // legacy object with some arrays — carry over anything recognizable
  if (existing.students) {
    const migrated = normalizeLegacyStudentData(existing.students);
    const seen = new Set(base.students.map((s) => s.student_internal_id));
    migrated.forEach((s) => { if (!seen.has(s.student_internal_id)) { seen.add(s.student_internal_id); base.students.push(s); } });
  }
  ['attendance', 'results', 'exams', 'payments', 'incidents', 'messages'].forEach((k) => {
    if (Array.isArray(existing[k]) && existing[k].length && !base[k].length) base[k] = existing[k];
  });
  return base;
}
