/* ============================================================
   Kobciye — Seed data (Phase 1/2 FINAL foundation)

   THE ONLY place legacy mock generators may be referenced. This file builds
   the canonical, normalized `kobciye_app_data_v3` object ONCE to initialize
   AsyncStorage. No active screen imports this file — only the repository.

   After initialization the central repository (appDataRepository) is the
   single source of truth; nothing reads these generators at runtime.
   ============================================================ */
import { CLASSES, SCHOOL2_CLASSES, REGISTRY_STUDENTS, studentsForSchool, classId } from './mock';
import { PAYMENTS, INCIDENTS, EXAMS, MESSAGES, TEACHERS } from './datasets';
import { SCHOOL_REGISTRY } from './schools';
import { ROLES, ROLE_ORDER } from './roles';
import { subjectId } from './access';
import { DEFAULT_GRADING } from '../services/gradingStorage';

export const SCHEMA_VERSION = 2;
export const APP_DATA_KEY = 'kobciye_app_data_v4';

const NON_BILLED = ['left', 'transferred', 'graduated', 'inactive', 'suspended_not_billed'];

/* ---- schools (canonical identity) ---- */
function buildSchools() {
  return SCHOOL_REGISTRY.map((s) => ({
    school_id: s.school_id,
    slug: s.slug,
    name: s.name,
    student_id_prefix: s.student_id_prefix,
    next_student_sequence: s.next_student_sequence,
    plan: s.plan,
    status: s.status,
  }));
}

/* ---- subjects (canonical subject_id) ---- */
function buildSubjects() {
  const names = ['Xisaab', 'Sayniska', 'Af-Soomaali', 'Ingiriis', 'Cilmiga Diinta', 'Juqraafi', 'Taariikh'];
  const en = { Xisaab: 'Mathematics', Sayniska: 'Science', 'Af-Soomaali': 'Somali', Ingiriis: 'English', 'Cilmiga Diinta': 'Islamic Studies', Juqraafi: 'Geography', Taariikh: 'History' };
  return names.map((n) => ({ subject_id: subjectId(n), name: n, name_en: en[n] || n }));
}

/* ---- classes (globally-unique class_id + subject_ids) ----
   The class set is the UNION of the timetable classes and every class
   referenced by exams / incidents, so all relational records resolve. */
function subjectsFor(level) {
  return level && /sare|secondary/i.test(level)
    ? [subjectId('Xisaab'), subjectId('Sayniska'), subjectId('Ingiriis')]
    : [subjectId('Xisaab'), subjectId('Af-Soomaali'), subjectId('Cilmiga Diinta')];
}
function buildClasses() {
  const byId = new Map();
  [...CLASSES, ...SCHOOL2_CLASSES].forEach((c) => {
    const school_id = c[7] || 'school_001';
    const cid = classId(c, school_id);
    byId.set(cid, { class_id: cid, school_id, name: c[0], level: c[1] || '', teacher_name: c[2] || '', capacity: c[4] || 0, subject_ids: subjectsFor(c[1]) });
  });
  // add any class referenced by an exam or incident but missing above
  const addRef = (name, school_id) => {
    const cid = classId(name, school_id);
    if (!byId.has(cid)) byId.set(cid, { class_id: cid, school_id, name, level: '', teacher_name: '', capacity: 0, subject_ids: subjectsFor('') });
  };
  EXAMS.forEach((e) => addRef(e[0], e[5] || 'school_001'));
  INCIDENTS.forEach((it) => { if (it[1] && it[9]) addRef(it[1], it[9]); });
  return Array.from(byId.values());
}

/* ---- students (canonical identity + display aliases) ---- */
function toStudent(r, schoolId) {
  const sid = r.school_id || schoolId || 'school_001';
  const studentId = r.student_id || r.code || '';
  return {
    student_internal_id: r.student_internal_id || ('gen_' + (r.code || r.student_id || r.full_name || r.name || '')),
    student_id: studentId,
    school_id: sid,
    class_id: r.class_id || (r.className ? classId(r.className, sid) : null),
    full_name: r.full_name || r.name || 'Arday',
    status: r.status || 'active',
    gender: r.gender || null,
    fee: r.fee || 'full',
    att: r.att != null ? r.att : 90,
    photo_uri: r.photo_uri != null ? r.photo_uri : null,
    // display alias only (NOT a relationship key); `code` is fully removed
    name: r.full_name || r.name || 'Arday',
  };
}
/* EVERY student gets the school's own prefix + a sequential number
   (HID-000142, HID-000143 … for school_001; NUR-000001 … for school_002).
   The canonical registry students keep their fixed login IDs; the rest are
   renumbered from the school prefix so no student carries a generic code. */
const SCHOOL_PREFIX = SCHOOL_REGISTRY.reduce((m, s) => ((m[s.school_id] = s.student_id_prefix), m), {});

function buildStudents() {
  const seen = new Set();
  const out = [];
  const used = {};     // school_id -> Set of numeric suffixes already taken
  const next = {};     // school_id -> next number to try
  const push = (rec) => { if (rec.student_internal_id && !seen.has(rec.student_internal_id)) { seen.add(rec.student_internal_id); out.push(rec); } };
  const noteUsed = (rec) => {
    const m = String(rec.student_id).match(/(\d+)\s*$/);
    if (!m) return;
    used[rec.school_id] = used[rec.school_id] || new Set();
    used[rec.school_id].add(parseInt(m[1], 10));
  };

  // 1) canonical relation students keep their documented login IDs (HID-000142…)
  REGISTRY_STUDENTS.forEach((r) => { const rec = toStudent(r); push(rec); noteUsed(rec); });

  // 2) every other student is assigned the SCHOOL prefix + next free number
  ['school_001', 'school_002'].forEach((schoolId) => {
    const prefix = SCHOOL_PREFIX[schoolId] || 'KOB';
    used[schoolId] = used[schoolId] || new Set();
    next[schoolId] = next[schoolId] || 1;
    studentsForSchool(schoolId).forEach((r, i) => {
      const internal = r.student_internal_id || ('gen_' + (r.code || r.student_id || r.full_name || r.name || ''));
      if (seen.has(internal)) return;               // already added as a canonical student
      while (used[schoolId].has(next[schoolId])) next[schoolId] += 1;   // skip taken numbers
      const num = next[schoolId];
      used[schoolId].add(num); next[schoolId] += 1;
      const studentId = `${prefix}-${String(num).padStart(6, '0')}`;
      const rec = toStudent({ ...r, student_id: studentId, code: studentId }, schoolId);
      if (i > 0 && i % 9 === 0) rec.status = NON_BILLED[i % NON_BILLED.length]; // visible exclusions
      push(rec);
    });
  });
  return out;
}

/* ---- profiles (the role preview accounts) ---- */
function buildProfiles() {
  return ROLE_ORDER.map((k) => ({ ...ROLES[k] }));
}

/* ---- teacher permissions ----
   Canonical teacher records (teacher_001 = the role-preview Macalin). Each
   teacher's assigned_subject_ids are parsed from their subject label and kept
   ONLY where the subject exists in the canonical subject list. The admin opens
   exam windows against these assignments (a teacher can only ever be opened for
   a subject they actually teach). */
function buildTeacherPermissions() {
  const t = ROLES.teacher;
  const valid = new Set(buildSubjects().map((s) => s.subject_id));
  return TEACHERS.map((row, i) => {
    const teacher_id = 'teacher_' + String(i + 1).padStart(3, '0');
    const parsed = String(row[1] || '')
      .split(/[&,]/)
      .map((s) => subjectId(s.trim()))
      .filter((sid) => valid.has(sid));
    const isPreview = teacher_id === (t.teacher_id || 'teacher_001');
    return {
      teacher_id,
      teacher_name: row[0],
      school_id: 'school_001',
      assigned_class_ids: isPreview ? (t.assigned_class_ids || []) : [],
      assigned_subject_ids: isPreview ? (t.assigned_subject_ids || parsed) : parsed,
      permissions: isPreview ? (t.permissions || []) : [],
    };
  });
}

/* ---- terms (admin-defined, dynamic) ----
   The admin owns the calendar: terms are created/removed by the School Admin,
   never by a teacher. Seeded with three standard terms per school. */
function buildTerms() {
  const out = [];
  ['school_001', 'school_002'].forEach((schoolId) => {
    ['Term 1', 'Term 2', 'Term 3'].forEach((name, i) => {
      out.push({ term_id: `${schoolId}_term_${i + 1}`, school_id: schoolId, name, order: i + 1, status: 'active' });
    });
  });
  return out;
}

/* ---- exam windows (admin → teacher permission) ----
   ONE window = "teacher X may enter an exam for subject Y, in term Z, out of N
   marks". The admin opens/closes them; full_marks (25/50/100) is locked by the
   admin. A teacher can only create an exam where an OPEN window exists for one
   of their assigned subjects. */
function buildExamWindows() {
  return [
    { window_id: 'examwin_001', school_id: 'school_001', teacher_id: 'teacher_001', subject_id: subjectId('Xisaab'), term_id: 'school_001_term_1', full_marks: 100, status: 'open', created_at: '2026-01-10' },
    { window_id: 'examwin_002', school_id: 'school_001', teacher_id: 'teacher_001', subject_id: subjectId('Sayniska'), term_id: 'school_001_term_1', full_marks: 50, status: 'open', created_at: '2026-01-10' },
  ];
}

/* ---- exams (canonical objects, converted from legacy EXAMS tuples) ---- */
function buildExams() {
  // EXAMS tuple: [className, subject, term, avg, pass%, school_id, subject_id, published]
  return EXAMS.map((e, i) => {
    const school_id = e[5] || 'school_001';
    return {
      exam_id: 'exam_' + String(i + 1).padStart(3, '0'),
      school_id,
      academic_year_id: 'year_2026_2027',
      term_id: 'term_1',
      class_id: classId(e[0], school_id),     // GLOBAL class_id
      subject_id: subjectId(e[6] || e[1]),
      teacher_id: 'teacher_001',
      title: `${e[1]} — ${e[2]}`,
      subject_name: e[1],
      class_name: e[0],
      term: e[2],
      avg: e[3],
      pass_mark: 50,
      full_marks: 100,
      pass_pct: e[4],
      status: e[7] === false ? 'draft' : 'published',
    };
  });
}

/* ---- results (a few published results so Parent/Student views have data) ---- */
function buildResults() {
  const exams = buildExams();
  const examFor = (className, subjectName) => exams.find((x) => x.class_name === className && x.subject_name === subjectName);
  // term-tagged so the student profile can show per-term + an auto-combined
  // average. student_001 has BOTH terms for Xisaab → demonstrates the combine.
  const seed = [
    { sid: 'student_001', cls: 'Form 5A', subj: 'Xisaab', score: 78, term: 'school_001_term_1', full: 100 },
    { sid: 'student_001', cls: 'Form 5A', subj: 'Xisaab', score: 66, term: 'school_001_term_2', full: 100 },
    { sid: 'student_001', cls: 'Form 5A', subj: 'Af-Soomaali', score: 85, term: 'school_001_term_1', full: 100 },
    { sid: 'student_003', cls: 'Form 5A', subj: 'Xisaab', score: 64, term: 'school_001_term_1', full: 100 },
    { sid: 'student_002', cls: 'Form 4A', subj: 'Xisaab', score: 72, term: 'school_001_term_1', full: 100 },
  ];
  const out = [];
  seed.forEach((s, i) => {
    const ex = examFor(s.cls, s.subj) || exams.find((x) => x.subject_name === s.subj);
    if (!ex) return;
    const full = s.full || 100;
    const pct = Math.round((s.score / full) * 100);
    out.push({
      result_id: 'result_' + String(i + 1).padStart(3, '0'),
      school_id: ex.school_id,
      class_id: ex.class_id,
      subject_id: ex.subject_id,
      exam_id: ex.exam_id,
      term_id: s.term,
      student_internal_id: s.sid,
      score: s.score,
      full_marks: full,
      percentage: pct,
      grade: pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F',
      result_status: pct >= 50 ? 'passed' : 'failed',
      attendance_status: 'present',
      published: true,
    });
  });
  return out;
}

/* ---- school settings (prefix + sequence per school) ----
   next_student_sequence continues PAST the highest number already used by a
   seeded student, so a newly-added student never collides with an existing id. */
function buildSchoolSettings(students) {
  return SCHOOL_REGISTRY.map((s) => {
    let maxNum = s.next_student_sequence - 1;
    (students || []).forEach((st) => {
      if (st.school_id !== s.school_id) return;
      const m = String(st.student_id).match(/(\d+)\s*$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    return {
      school_id: s.school_id,
      student_id_prefix: s.student_id_prefix,
      next_student_sequence: maxNum + 1,
    };
  });
}

/* ---- grading rules (per school) ---- */
function buildGradingRules() {
  return SCHOOL_REGISTRY.map((s) => ({ school_id: s.school_id, ...DEFAULT_GRADING }));
}

/* Build the full canonical v2 object. Pure — no AsyncStorage, no side effects. */
export function buildSeedData() {
  const students = buildStudents();
  return {
    schema_version: SCHEMA_VERSION,
    schools: buildSchools(),
    classes: buildClasses(),
    students,
    profiles: buildProfiles(),
    subjects: buildSubjects(),
    teacher_permissions: buildTeacherPermissions(),
    terms: buildTerms(),
    exam_windows: buildExamWindows(),

    attendance: [],
    payments: PAYMENTS.map((p) => p.slice()),     // tuple rows (canonical-keyed)
    billing_records: [],
    exams: buildExams(),
    results: buildResults(),
    incidents: INCIDENTS.map((it) => it.slice()),  // tuple rows (canonical-keyed)
    messages: MESSAGES.map((m) => ({ ...m })),

    school_settings: buildSchoolSettings(students),
    grading_rules: buildGradingRules(),
  };
}
