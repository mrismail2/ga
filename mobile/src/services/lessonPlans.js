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
   `detail` so drafts survive refresh exactly as entered */
export async function createLessonPlan(schoolId, profileId, teacherName, v = {}) {
  requireClient();
  const { title, subject, cls, ...detail } = v || {};
  delete detail.id; // screen-generated preview id — the DB id is canonical
  const { data, error } = await supabase.from('lesson_plans').insert({
    school_id: schoolId,
    teacher_profile_id: profileId,
    teacher_name: teacherName || 'Macalin',
    title: String(title || '').trim(),
    subject: String(subject || '').trim() || null,
    class_label: String(cls || '').trim() || null,
    status: 'draft',
    detail,
  }).select().single();
  if (error) throw error;
  notifyCanonicalChange('lesson_plans');
  return lessonRowToView(data);
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
