/* Real, Phase 1–4-only dashboard summaries.
   No AsyncStorage/demo datasets and no Phase 5 attendance/finance/results. */
import { supabase, isSupabaseConfigured } from './supabase';
import { isUuid } from '../utils/uuid';
import { myTeacherAssignments, listLessonPlans } from './lessonPlans';

function requireLive(profileId, schoolId) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Backend-ka Supabase lama habayn.');
  if (!isUuid(profileId) || !isUuid(schoolId)) throw new Error('Akoon ama dugsi sax ah ayaa loo baahan yahay.');
}

async function classNames(ids) {
  const unique = [...new Set((ids || []).filter(isUuid))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from('classes').select('id, name').in('id', unique);
  if (error) throw error;
  return new Map((data || []).map((r) => [r.id, r.name]));
}

export async function getTeacherPhase4Summary(profileId, schoolId) {
  requireLive(profileId, schoolId);
  const [{ pairs }, plans] = await Promise.all([
    myTeacherAssignments(schoolId, profileId),
    listLessonPlans(schoolId),
  ]);
  return {
    classes: new Set((pairs || []).map((p) => p.classId)).size,
    subjects: new Set((pairs || []).map((p) => p.subjectId)).size,
    assignments: (pairs || []).length,
    lessons: (plans || []).filter((p) => p.teacherProfileId === profileId).length,
  };
}

export async function getParentPhase4Children(profileId, schoolId) {
  requireLive(profileId, schoolId);
  const { data: parents, error: pe } = await supabase.from('parents')
    .select('id').eq('school_id', schoolId).eq('profile_id', profileId).limit(5);
  if (pe) throw pe;
  const parentIds = (parents || []).map((p) => p.id);

  let links = [];
  if (parentIds.length) {
    const { data, error } = await supabase.from('student_parents')
      .select('student_id').in('parent_id', parentIds).limit(100);
    if (error) throw error;
    links = data || [];
  } else {
    // Legacy cache path retained by the schema; RLS still proves ownership.
    const { data, error } = await supabase.from('student_parents')
      .select('student_id').eq('parent_profile_id', profileId).limit(100);
    if (error) throw error;
    links = data || [];
  }
  const studentIds = [...new Set(links.map((l) => l.student_id).filter(isUuid))];
  if (!studentIds.length) return [];
  const [{ data: students, error: se }, { data: enrollments, error: ee }] = await Promise.all([
    supabase.from('students').select('id, student_id, full_name').eq('school_id', schoolId).in('id', studentIds),
    supabase.from('student_enrollments').select('student_id, class_id, academic_year_id').eq('school_id', schoolId).eq('status', 'active').in('student_id', studentIds),
  ]);
  if (se) throw se;
  if (ee) throw ee;
  const enrollmentByStudent = new Map((enrollments || []).map((e) => [e.student_id, e]));
  const names = await classNames((enrollments || []).map((e) => e.class_id));
  return (students || []).map((s) => {
    const e = enrollmentByStudent.get(s.id) || null;
    return {
      id: s.id,
      studentId: s.student_id,
      name: s.full_name,
      classId: e && e.class_id,
      className: e && names.get(e.class_id) || '—',
    };
  });
}

export async function getStudentPhase4Self(profileId, schoolId) {
  requireLive(profileId, schoolId);
  const { data: rows, error } = await supabase.from('students')
    .select('id, student_id, full_name').eq('school_id', schoolId).eq('profile_id', profileId).limit(1);
  if (error) throw error;
  const student = rows && rows[0];
  if (!student) return null;
  const { data: enrollments, error: ee } = await supabase.from('student_enrollments')
    .select('class_id, academic_year_id').eq('school_id', schoolId).eq('student_id', student.id).eq('status', 'active').limit(1);
  if (ee) throw ee;
  const enrollment = enrollments && enrollments[0];
  const names = await classNames(enrollment && enrollment.class_id ? [enrollment.class_id] : []);
  return {
    id: student.id,
    studentId: student.student_id,
    name: student.full_name,
    classId: enrollment && enrollment.class_id,
    className: enrollment && names.get(enrollment.class_id) || '—',
  };
}
