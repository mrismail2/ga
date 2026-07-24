/* ============================================================
   Kobciye — Central App Data Repository (Phase 1/2 FINAL foundation)

   THE single source of truth. One AsyncStorage key (kobciye_app_data_v3)
   holds the whole normalized store. Seeded once; migrated forward; never
   reseeded. Every screen reads through AppDataContext / dataSelectors and
   mutates through these functions.

   No backend — device-only prototype persistence.
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_DATA_KEY } from '../data/seedData';
import { migrateToV2, isV2, emptyAppData } from '../utils/dataMigration';
import { isLiveSupabaseMode } from './liveMode';

/* ---- low-level load / save (never throw) ----
   In LIVE mode this device-only demo store is off-limits: a real authenticated
   user must never read or write the AsyncStorage demo records. Reads return an
   empty store and writes are no-ops, so live and demo data can never mix. */
export async function loadAppData() {
  if (isLiveSupabaseMode()) return emptyAppData();
  try {
    const raw = await AsyncStorage.getItem(APP_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveAppData(data) {
  if (isLiveSupabaseMode()) return false;        // never persist demo data in live mode
  try { await AsyncStorage.setItem(APP_DATA_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

/* ---- one-time init + forward migration ----
   Reads storage, migrates legacy/missing → canonical v2, persists once.
   Safe on every launch: an existing v2 store is returned unchanged. In LIVE
   mode it never seeds — a real user starts from an empty, Supabase-backed
   store, not the demo seed. */
export async function initializeAppData() {
  if (isLiveSupabaseMode()) return emptyAppData();
  const existing = await loadAppData();
  if (isV2(existing)) return existing;          // already canonical — no reseed
  const migrated = migrateToV2(existing);        // seed (or migrate legacy)
  await saveAppData(migrated);
  return migrated;
}

/* ---- read-modify-write helper ----
   In LIVE mode demo writes are refused (returns the empty store) so a real
   user can never create demo records. Live per-module writes go to Supabase
   (wired incrementally; see dataProvider). */
async function mutate(fn) {
  if (isLiveSupabaseMode()) return emptyAppData();
  const data = (await loadAppData()) || (await initializeAppData());
  const next = fn(data) || data;
  await saveAppData(next);
  return next;
}

/* ============================================================
   Student registry functions (operate on the single store)
   ============================================================ */
export async function getStudentsBySchool(schoolId) {
  const d = await loadAppData();
  return (d ? d.students : []).filter((s) => s.school_id === schoolId);
}
export async function getStudentsByClass(schoolId, classId) {
  const d = await loadAppData();
  return (d ? d.students : []).filter((s) => s.school_id === schoolId && s.class_id === classId);
}
export async function getStudentByInternalId(studentInternalId) {
  const d = await loadAppData();
  return (d ? d.students : []).find((s) => s.student_internal_id === studentInternalId) || null;
}
export async function getStudentByStudentId(studentId) {
  const d = await loadAppData();
  return (d ? d.students : []).find((s) => s.student_id === studentId) || null;
}
export async function getActiveStudentsBySchool(schoolId) {
  const d = await loadAppData();
  return (d ? d.students : []).filter((s) => s.school_id === schoolId && s.status === 'active');
}

/* school settings: prefix + running sequence (lives in the same store) */
export async function getSchoolSettings(schoolId) {
  const d = await loadAppData();
  return (d ? d.school_settings : []).find((s) => s.school_id === schoolId)
    || { school_id: schoolId, student_id_prefix: 'KOB', next_student_sequence: 1 };
}

/* preview the next id WITHOUT consuming the sequence */
export function previewStudentId(settings) {
  const prefix = (settings && settings.student_id_prefix) || 'KOB';
  const seq = (settings && settings.next_student_sequence) || 1;
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

/* validate a student-id prefix (2–12 uppercase letters / digits / hyphens) */
const PREFIX_RE = /^[A-Z0-9-]{2,12}$/;
export function validateStudentIdPrefix(prefix) {
  const p = String(prefix || '').trim();
  if (!p) return { ok: false, error: 'Prefix waa loo baahan yahay.' };
  if (/\s/.test(p)) return { ok: false, error: 'Meel bannaan lama oggola.' };
  if (!PREFIX_RE.test(p)) return { ok: false, error: '2–12 xaraf oo waaweyn, lambarro ama xariiq (-).' };
  return { ok: true, value: p };
}

/* update a school's prefix (affects NEW students only; never re-IDs existing) */
export async function updateSchoolSettings(schoolId, updates) {
  let result = null;
  await mutate((d) => {
    d.school_settings = (d.school_settings || []).map((s) => {
      if (s.school_id !== schoolId) return s;
      result = { ...s, ...updates };
      return result;
    });
    return d;
  });
  return result;
}

/* Add a student. The id is generated from the ADMIN's own school prefix +
   sequence (never random, never hard-coded), then the sequence advances. */
export async function addStudent(profile, studentData = {}) {
  const schoolId = !profile || profile.school_id === '*' ? (studentData.school_id || 'school_001') : profile.school_id;
  let created = null;
  await mutate((d) => {
    const settings = (d.school_settings || []).find((s) => s.school_id === schoolId)
      || { school_id: schoolId, student_id_prefix: 'KOB', next_student_sequence: 1 };
    const student_id = `${settings.student_id_prefix}-${String(settings.next_student_sequence).padStart(6, '0')}`;
    const fullName = studentData.full_name || studentData.name || 'Arday Cusub';
    created = {
      student_internal_id: studentData.student_internal_id || ('student_' + Date.now()),
      student_id,
      school_id: schoolId,
      class_id: studentData.class_id || null,
      full_name: fullName,
      status: studentData.status || 'active',
      gender: studentData.gender || null,
      fee: studentData.fee || 'full',
      att: studentData.att != null ? studentData.att : 90,
      photo_uri: studentData.photo_uri || null,
      name: fullName,
      created_at: new Date().toISOString(),
    };
    d.students = [created, ...(d.students || [])];
    // advance the sequence for this school
    d.school_settings = (d.school_settings || []).map((s) =>
      (s.school_id === schoolId ? { ...s, next_student_sequence: (s.next_student_sequence || 1) + 1 } : s));
    return d;
  });
  return created;
}

export async function updateStudent(studentInternalId, updates) {
  let result = null;
  await mutate((d) => {
    d.students = (d.students || []).map((s) => {
      if (s.student_internal_id !== studentInternalId) return s;
      result = { ...s, ...updates, updated_at: new Date().toISOString() };
      // keep display aliases in sync
      if (updates.full_name) { result.name = updates.full_name; }
      return result;
    });
    return d;
  });
  return result;
}

export async function deactivateStudent(studentInternalId, status = 'inactive') {
  return updateStudent(studentInternalId, { status });
}
export async function transferStudent(studentInternalId, newClassId) {
  return updateStudent(studentInternalId, { class_id: newClassId, status: 'active' });
}

/* ---- exams / results persistence (canonical objects) ---- */
export async function getExamsBySchool(schoolId) {
  const d = await loadAppData();
  return (d ? d.exams : []).filter((e) => e.school_id === schoolId);
}
export async function addExam(exam) {
  let created = null;
  await mutate((d) => {
    created = { exam_id: exam.exam_id || ('exam_' + Date.now()), status: 'draft', ...exam };
    d.exams = [created, ...(d.exams || [])];
    return d;
  });
  return created;
}
export async function updateExam(examId, updates) {
  let result = null;
  await mutate((d) => {
    d.exams = (d.exams || []).map((e) => (e.exam_id === examId ? (result = { ...e, ...updates }) : e));
    return d;
  });
  return result;
}
export async function upsertResult(result) {
  let saved = null;
  await mutate((d) => {
    saved = { result_id: result.result_id || ('result_' + Date.now()), ...result };
    d.results = [...(d.results || []).filter((r) => !(r.exam_id === saved.exam_id && r.student_internal_id === saved.student_internal_id)), saved];
    return d;
  });
  return saved;
}
export async function publishExamResults(examId, published = true) {
  await mutate((d) => {
    d.exams = (d.exams || []).map((e) => (e.exam_id === examId ? { ...e, status: published ? 'published' : 'draft' } : e));
    d.results = (d.results || []).map((r) => (r.exam_id === examId ? { ...r, published } : r));
    return d;
  });
}

/* persist a teacher's entered marks for ONE exam (one subject + one term).
   Each student becomes a term-tagged result row; the exam is published with its
   class average so the per-student profile can combine terms automatically. */
export async function saveExamMarks(exam, entries = []) {
  await mutate((d) => {
    const others = (d.results || []).filter((r) => r.exam_id !== exam.exam_id);
    const rows = entries.map((e) => {
      const full = e.full_marks || exam.full_marks || 100;
      const pct = e.percentage != null ? e.percentage : Math.round((e.score / full) * 100);
      return {
        result_id: `result_${exam.exam_id}_${e.student_internal_id}`,
        school_id: exam.school_id, class_id: exam.class_id, subject_id: exam.subject_id,
        exam_id: exam.exam_id, term_id: exam.term_id, student_internal_id: e.student_internal_id,
        score: e.score, full_marks: full, percentage: pct,
        grade: pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F',
        result_status: pct >= 50 ? 'passed' : 'failed', published: true,
      };
    });
    const avg = rows.length ? Math.round(rows.reduce((a, r) => a + r.percentage, 0) / rows.length) : 0;
    d.results = [...others, ...rows];
    d.exams = (d.exams || []).map((x) => (x.exam_id === exam.exam_id ? { ...x, status: 'published', avg } : x));
    return d;
  });
}

/* ---- teachers (canonical permission records) ---- */
export async function getTeachers(schoolId) {
  const d = await loadAppData();
  return (d ? d.teacher_permissions : []).filter((t) => t.school_id === schoolId);
}

/* ---- terms (admin-owned academic calendar) ---- */
export async function getTerms(schoolId) {
  const d = await loadAppData();
  return (d ? (d.terms || []) : []).filter((t) => t.school_id === schoolId).sort((a, b) => (a.order || 0) - (b.order || 0));
}
export async function addTerm(schoolId, name) {
  let created = null;
  await mutate((d) => {
    const existing = (d.terms || []).filter((t) => t.school_id === schoolId);
    const order = existing.reduce((mx, t) => Math.max(mx, t.order || 0), 0) + 1;
    created = { term_id: `${schoolId}_term_local_${order}_${(d.terms || []).length + 1}`, school_id: schoolId, name: name || `Term ${order}`, order, status: 'active' };
    d.terms = [...(d.terms || []), created];
    return d;
  });
  return created;
}
export async function removeTerm(termId) {
  await mutate((d) => {
    d.terms = (d.terms || []).filter((t) => t.term_id !== termId);
    // any windows tied to the removed term go with it
    d.exam_windows = (d.exam_windows || []).filter((w) => w.term_id !== termId);
    return d;
  });
}

/* ---- exam windows (admin → teacher permission to enter an exam) ---- */
export async function getExamWindows(schoolId) {
  const d = await loadAppData();
  return (d ? (d.exam_windows || []) : []).filter((w) => w.school_id === schoolId);
}
export async function getOpenExamWindowsForTeacher(schoolId, teacherId) {
  const d = await loadAppData();
  return (d ? (d.exam_windows || []) : []).filter((w) => w.school_id === schoolId && w.teacher_id === teacherId && w.status === 'open');
}
export async function openExamWindow({ schoolId, teacherId, subjectId, termId, fullMarks }) {
  let created = null;
  await mutate((d) => {
    // one open window per (teacher, subject, term) — re-opening updates the marks
    const dup = (d.exam_windows || []).find((w) => w.school_id === schoolId && w.teacher_id === teacherId && w.subject_id === subjectId && w.term_id === termId);
    if (dup) {
      created = { ...dup, full_marks: fullMarks, status: 'open' };
      d.exam_windows = (d.exam_windows || []).map((w) => (w.window_id === dup.window_id ? created : w));
    } else {
      created = { window_id: 'examwin_local_' + ((d.exam_windows || []).length + 1) + '_' + termId, school_id: schoolId, teacher_id: teacherId, subject_id: subjectId, term_id: termId, full_marks: fullMarks, status: 'open' };
      d.exam_windows = [created, ...(d.exam_windows || [])];
    }
    return d;
  });
  return created;
}
export async function setExamWindowStatus(windowId, status) {
  await mutate((d) => {
    d.exam_windows = (d.exam_windows || []).map((w) => (w.window_id === windowId ? { ...w, status } : w));
    return d;
  });
}
