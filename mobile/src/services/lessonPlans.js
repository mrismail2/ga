/* ============================================================
   Kobciye — canonical lesson plans (Casharrada, Live Mode)

   Thin CRUD over the lesson_plans table under the caller's own JWT —
   RLS is the authority (teachers create/submit their own, only school
   admins approve/reject, schools never see each other). Replaces the
   runtime demo LESSONS arrays in Live Mode; a new school starts with
   ZERO plans and the approved empty state, never a fake lesson.

   The screen keeps its existing lesson shape ({ id, title, subject,
   cls, status, teacher, submitted_at, ministry_feedback, ...detail })
   so the Lesson UI is preserved unchanged.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';
import { notifyCanonicalChange } from './canonicalStore';

function requireClient() {
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
}

/* canonical row → the exact shape LessonsScreen/LessonDetailModal render */
export function lessonRowToView(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject || 'Maadda',
    cls: row.class_label || '—',
    status: row.status,
    teacher: row.teacher_name || 'Macalin',
    submitted_at: row.updated_at ? String(row.updated_at).slice(0, 10) : '',
    ministry_feedback: [],
    ...(row.detail || {}),
  };
}

export async function listLessonPlans(schoolId) {
  requireClient();
  const { data, error } = await supabase.from('lesson_plans')
    .select('*').eq('school_id', schoolId)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map(lessonRowToView);
}

/* teacher (or admin) drafts a plan — the modal's extra fields persist in
   `detail` so drafts survive refresh exactly as entered. classId/subjectId
   are the REAL canonical ids (when the caller has them, i.e. the teacher
   picked from their own assignments) — the database guard rejects a
   class/subject that isn't actually assigned to this teacher, so a
   forged id can never be saved regardless of what the client sends. */
export async function createLessonPlan(schoolId, profileId, teacherName, v = {}) {
  requireClient();
  const { title, subject, cls, classId, subjectId, ...detail } = v || {};
  delete detail.id; // screen-generated preview id — the DB id is canonical
  const { data, error } = await supabase.from('lesson_plans').insert({
    school_id: schoolId,
    teacher_profile_id: profileId,
    teacher_name: teacherName || 'Macalin',
    title: String(title || '').trim(),
    subject: String(subject || '').trim() || null,
    class_label: String(cls || '').trim() || null,
    class_id: classId || null,
    subject_id: subjectId || null,
    status: 'draft',
    detail,
  }).select().single();
  if (error) throw error;
  notifyCanonicalChange('lesson_plans');
  return lessonRowToView(data);
}

/* the signed-in teacher's own assignments — used to build REAL
   class+subject PAIR pickers (never a hardcoded/demo list, and never two
   independently-flattened lists that could be combined into an invalid
   pair) in Live Mode. `pairs` is the single source of truth: each entry
   is one exact, real, currently-active teacher_assignments row with its
   class/subject names already resolved. */
export async function myTeacherAssignments(schoolId, profileId) {
  requireClient();
  const { data: teacherRows, error: terr } = await supabase.from('teachers')
    .select('id').eq('school_id', schoolId).eq('profile_id', profileId).limit(1);
  if (terr) throw terr;
  const teacherId = teacherRows && teacherRows[0] && teacherRows[0].id;
  if (!teacherId) return { pairs: [] };
  const { data, error } = await supabase.from('teacher_assignments')
    .select('class_id, subject_id').eq('school_id', schoolId).eq('teacher_id', teacherId).eq('is_active', true);
  if (error) throw error;
  const rows = (data || []).filter((r) => r.class_id && r.subject_id);
  const classIds = [...new Set(rows.map((r) => r.class_id))];
  const subjectIds = [...new Set(rows.map((r) => r.subject_id))];
  const [classesRes, subjectsRes] = await Promise.all([
    classIds.length ? supabase.from('classes').select('id, name').in('id', classIds) : { data: [] },
    subjectIds.length ? supabase.from('subjects').select('id, name').in('id', subjectIds) : { data: [] },
  ]);
  const classNameById = new Map((classesRes.data || []).map((c) => [c.id, c.name]));
  const subjectNameById = new Map((subjectsRes.data || []).map((s) => [s.id, s.name]));
  return {
    pairs: rows.map((r) => ({
      classId: r.class_id,
      className: classNameById.get(r.class_id) || '—',
      subjectId: r.subject_id,
      subjectName: subjectNameById.get(r.subject_id) || '—',
    })),
  };
}

/* draft → pending (teacher) · pending → approved/rejected (admin only —
   the DB guard enforces this even if the UI is bypassed) */
export async function setLessonPlanStatus(id, status) {
  requireClient();
  const { data, error } = await supabase.from('lesson_plans')
    .update({ status }).eq('id', id).select().single();
  if (error) throw error;
  notifyCanonicalChange('lesson_plans');
  return lessonRowToView(data);
}
