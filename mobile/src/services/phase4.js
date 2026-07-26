/* ============================================================
   Kobciye — Phase 4 core-management data services

   Thin, allow-listed CRUD over the Phase 4 tables. LIVE data only: every
   call goes straight to Supabase under the caller's own JWT, so RLS is the
   real authority — nothing here reads or writes AsyncStorage, and no
   secret/service key is ever involved (only the public client from
   services/supabase.js). school_id scoping is enforced server-side by RLS;
   we still always pass it explicitly so a bug can only ever *narrow* a
   query, never widen it.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';
import { notifyCanonicalChange } from './canonicalStore';
import { isUuid } from '../utils/uuid';

/* Allow-list: table -> default ordering. p4* functions refuse any table
   not in this map, so a screen bug can never touch other tables. */
const TABLES = {
  academic_years: { order: 'name' },
  terms: { order: 'name' },
  school_sections: { order: 'name' },
  classes: { order: 'display_order' },
  class_streams: { order: 'name' },
  subjects: { order: 'name' },
  teachers: { order: 'full_name' },
  staff: { order: 'full_name' },
  teacher_assignments: { order: 'created_at' },
  students: { order: 'full_name' },
  student_enrollments: { order: 'enrolled_on' },
  parents: { order: 'full_name' },
  student_parents: { order: 'student_id' },
  admissions: { order: 'created_at' },
  faculties: { order: 'name' },
  departments: { order: 'name' },
  programmes: { order: 'name' },
  semesters: { order: 'name' },
  courses: { order: 'name' },
  lecturers: { order: 'full_name' },
  university_students: { order: 'full_name' },
};

function requireTable(table) {
  if (!TABLES[table]) throw new Error('Unknown Phase 4 table: ' + table);
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
  return TABLES[table];
}

/* Hard gate for EVERY school_id that is about to reach a Supabase `uuid`
   column. A placeholder ("*", "all", "school_001", "", null, undefined) is
   rejected here — never sent to PostgREST — so the "invalid input syntax
   for type uuid" crash can never happen and no query is ever run without a
   real school scope. Callers that legitimately have "no school yet" (Super
   Admin before picking a school) must check first and simply not call. */
function requireSchoolUuid(schoolId) {
  if (!isUuid(schoolId)) {
    const e = new Error('Dooro dugsi sax ah ka hor inta aadan xogtiisa maamulin.');
    e.code = 'invalid_school_id';
    throw e;
  }
  return schoolId.trim();
}

/* Every active enrollment created by the client must have a real class and
   academic year. The database migration added in this pass independently
   enforces the same invariant, so a forged/direct RPC call cannot create an
   active enrollment with either value missing. */
export function p4ValidateEnrollmentSelection({ classId, academicYearId, streamId = null } = {}) {
  const cls = String(classId || '').trim();
  const year = String(academicYearId || '').trim();
  const stream = String(streamId || '').trim();
  if (!cls) return 'Fadlan dooro fasalka.';
  if (!isUuid(cls)) return 'Fadlan dooro fasalka saxda ah.';
  if (!year) return 'Fadlan dooro sannad-dugsiyeedka.';
  if (!isUuid(year)) return 'Fadlan dooro sannad-dugsiyeed sax ah.';
  if (stream && !isUuid(stream)) return 'Fadlan dooro qaybta fasalka saxda ah.';
  return null;
}

function requireEnrollmentSelection(selection) {
  const message = p4ValidateEnrollmentSelection(selection);
  if (message) {
    const e = new Error(message);
    e.code = 'invalid_enrollment_selection';
    throw e;
  }
  return {
    classId: String(selection.classId).trim(),
    academicYearId: String(selection.academicYearId).trim(),
    streamId: selection.streamId ? String(selection.streamId).trim() : null,
  };
}

/* Postgres error → short Somali message the form can show inline. */
export function p4FriendlyError(error) {
  const msg = (error && (error.message || String(error))) || '';
  const code = error && error.code;
  if (code === 'not_configured') return msg;
  if (code === 'invalid_school_id') return 'Dooro dugsi sax ah ka hor inta aadan xogtiisa maamulin.';
  if (code === 'invalid_enrollment_selection') return msg || 'Fadlan dooro fasalka iyo sannad-dugsiyeedka saxda ah.';
  if (code === '22P02' || /invalid input syntax for type uuid/i.test(msg)) {
    return 'Aqoonsi dugsi/diiwaan sax ah ayaa loo baahan yahay. Dooro dugsiga aad rabto inaad maamusho.';
  }
  if (code === '23505' || /duplicate key/i.test(msg)) {
    return 'Diiwaan isku mid ah ayaa horey u jiray (magac/koodh/lambar ku celis ah). Beddel qiimaha.';
  }
  if (code === '23514' || /check constraint|violates check/i.test(msg)) {
    return 'Xogtu ma aha mid sax ah (hubi taariikhaha iyo qiimaha la ogol yahay).';
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return 'Ma lihid oggolaansho aad diiwaankan ku sameyso.';
  }
  if (/active enrollment requires a class/i.test(msg)) return 'Fadlan dooro fasalka.';
  if (/active enrollment requires an academic year/i.test(msg)) return 'Fadlan dooro sannad-dugsiyeedka.';
  if (/already linked/i.test(msg)) {
    return 'Waalidkan horey ayuu ugu xirnaa ardaygan.';
  }
  if (/stream does not belong to the selected class/i.test(msg)) return 'Qaybta fasalku kama tirsana fasalka aad dooratay.';
  if (/subject does not belong to the selected class/i.test(msg)) return 'Maaddadu kama tirsana fasalka aad dooratay.';
  if (/class does not belong to the selected academic year/i.test(msg)) return 'Fasalku kama tirsana sannad-dugsiyeedka aad dooratay.';
  if (/term does not belong to the selected academic year/i.test(msg)) return 'Term-ku kama tirsana sannad-dugsiyeedka aad dooratay.';
  if (/belongs to another/i.test(msg) || /another school/i.test(msg)) {
    return 'Diiwaanka aad dooratay wuxuu ka tirsan yahay dugsi/jaamacad kale.';
  }
  if (/only a school admin/i.test(msg)) {
    return 'Kaliya Maamulaha Dugsiga ayaa fal-kan samayn kara.';
  }
  return msg || 'Waa la fashilmay. Isku day mar kale.';
}

export async function p4List(table, schoolId, { activeOnly = false, limit = 500 } = {}) {
  const meta = requireTable(table);
  const school = requireSchoolUuid(schoolId);
  let q = supabase.from(table).select('*').eq('school_id', school)
    .order(meta.order, { ascending: true }).limit(limit);
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* the canonical, active-only enrollment collection for a school — the
   source of truth for every student count (dashboard, class card, class
   detail roster, School Management). Never students.class_id directly:
   that column is only a denormalized "current class" display cache. */
export async function p4ActiveEnrollments(schoolId) {
  requireTable('student_enrollments');
  const school = requireSchoolUuid(schoolId);
  const { data, error } = await supabase.from('student_enrollments')
    .select('*').eq('school_id', school).eq('status', 'active').limit(2000);
  if (error) throw error;
  return data || [];
}

/* distinguishes "class does not exist" from "class exists in my school but
   I'm not authorized to open it" — a single safe boolean, never class data,
   and never confirms/denies existence outside the caller's own school. */
export async function p4ClassExistsInMySchool(classId) {
  if (!isSupabaseConfigured() || !supabase || !isUuid(classId)) return false;
  const { data, error } = await supabase.rpc('class_exists_in_my_school', { p_class: classId });
  if (error) throw error;
  return data === true;
}

export async function p4Create(table, row) {
  requireTable(table);
  if (!row || !row.school_id) throw new Error('school_id waa qasab (required).');
  requireSchoolUuid(row.school_id);
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  notifyCanonicalChange(table); // every subscribed screen re-reads the SAME canonical rows
  return data;
}

export async function p4Update(table, id, patch) {
  requireTable(table);
  // school_id/institution ownership can never be moved from the client
  const { school_id, id: _id, created_at, ...safe } = patch || {};
  const { data, error } = await supabase.from(table).update(safe).eq('id', id).select().single();
  if (error) throw error;
  notifyCanonicalChange(table);
  return data;
}

/* Zero-count dashboard tiles for an empty institution. Uses head-count
   queries (no row data transferred). A genuine empty institution returns
   zeroes; network/RLS/schema failures throw so the UI never disguises an
   unavailable count as a truthful-looking zero. */
export async function p4Counts(schoolId, tables) {
  const out = {};
  // no real school selected yet (e.g. Super Admin before picking one) → all
  // zero, and crucially NO query is run with a placeholder school_id.
  if (!isUuid(schoolId)) { tables.forEach((t) => { out[t] = 0; }); return out; }
  await Promise.all(tables.map(async (t) => {
    requireTable(t);
    const { count, error } = await supabase.from(t)
      .select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
    if (error) throw error;
    out[t] = count || 0;
  }));
  return out;
}

/* The school's ACTIVE academic year (status='active', latest start first).
   null when none has been created yet — callers save with a null year and
   the class remains valid; the admin can attach the year later. */
export async function p4ActiveAcademicYear(schoolId) {
  requireTable('academic_years');
  const school = requireSchoolUuid(schoolId);
  const { data, error } = await supabase.from('academic_years')
    .select('*').eq('school_id', school).eq('status', 'active')
    .order('starts_on', { ascending: false, nullsFirst: false }).limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

/* Canonical class creation — the ONE record format BOTH creation paths
   (Maamulka Dugsiga and the Fasallada main-menu screen) produce:
     • verifies the caller is a School Admin of this school (RLS re-checks)
     • uses profile.school_id, the active academic year and the selected
       school level (matched to an existing school_sections row)
     • blocks inappropriate duplicates (same name, case-insensitive) with
       a friendly message before the DB unique constraint fires
     • the stable class id is the DB-generated uuid
   Every subscribed screen reloads via notifyCanonicalChange('classes'). */
export async function p4CreateClassCanonical({ profile, roleKey, name, capacity, levelType, schoolId: schoolIdOverride }) {
  // School Admin: their own school. Super Admin: the school they picked
  // (passed explicitly). Never a placeholder — the guard below rejects "*".
  const schoolId = schoolIdOverride || (profile ? profile.school_id : null);
  if (!isUuid(schoolId) || (roleKey !== 'schooladmin' && roleKey !== 'superadmin')) {
    const e = new Error('Kaliya Maamulaha Dugsiga ayaa abuuri kara fasal.');
    e.code = 'guardian_access_denied';
    throw e;
  }
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Magaca fasalka waa qasab (required).');

  // Do not convert network/RLS/schema failures into a fake "no active year"
  // or "no sections" state. A failed dependency load must abort creation and
  // reach the form's visible error handling instead of creating a partial class.
  const [existing, year, sections] = await Promise.all([
    p4List('classes', schoolId),
    p4ActiveAcademicYear(schoolId),
    p4List('school_sections', schoolId, { activeOnly: true }),
  ]);
  if (existing.some((r) => (r.name || '').trim().toLowerCase() === clean.toLowerCase())) {
    const e = new Error('Fasal magacan wata ayaa horey u jiray. Beddel magaca.');
    e.code = '23505';
    throw e;
  }
  const section = levelType ? sections.find((s) => s.level_type === levelType) || null : null;
  const capNum = Number(capacity);
  return p4Create('classes', {
    school_id: schoolId,
    name: clean,
    capacity: Number.isFinite(capNum) && capNum > 0 ? capNum : 0,
    school_section_id: section ? section.id : null,
    academic_year_id: year ? year.id : null,
    display_order: existing.length + 1,
  });
}

/* Atomic admission — student + enrollment + admission + (optional) parent +
   guardian link in ONE database transaction (admit_student_atomic RPC).
   Any failure rolls the whole operation back: no partial student, ever. */
export async function p4AdmitStudentAtomic(schoolId, {
  applicantName, gender = null, dateOfBirth = null, admissionNumber = null,
  classId = null, streamId = null, academicYearId = null,
  admissionId = null, studentId = null,
  parentId = null, guardianName = null, guardianPhone = null,
  guardianEmail = null, relationship = null, isPrimary = true,
} = {}) {
  requireTable('admissions');
  const school = requireSchoolUuid(schoolId);
  const selection = requireEnrollmentSelection({ classId, academicYearId, streamId });
  const { data, error } = await supabase.rpc('admit_student_atomic', {
    p_school: school,
    p_applicant_name: applicantName,
    p_gender: gender || null,
    p_date_of_birth: dateOfBirth || null,
    p_admission_number: admissionNumber || null,
    p_class_id: selection.classId,
    p_stream_id: selection.streamId,
    p_academic_year_id: selection.academicYearId,
    p_admission_id: admissionId || null,
    p_student_id: studentId || null,
    p_parent_id: parentId || null,
    p_guardian_name: guardianName || null,
    p_guardian_phone: guardianPhone || null,
    p_guardian_email: guardianEmail || null,
    p_relationship: relationship || null,
    p_is_primary: isPrimary !== false,
  });
  if (error) throw error;
  // one atomic write touched all of these canonical tables
  ['students', 'admissions', 'parents', 'student_parents', 'student_enrollments', 'classes'].forEach(notifyCanonicalChange);
  return data;
}

/* Canonical "add / edit a student" — the students module MUST NOT insert a
   bare students row (a student with no active enrollment is invisible to
   every count and roster in the app). It routes through the SAME atomic RPC
   Admissions uses, so a student and an active student_enrollments row are
   created together (or not at all), and a class/year change preserves the
   previous enrollment as history. Returns { student_id, enrollment_id, … }. */
export async function p4SaveStudentWithEnrollment(schoolId, {
  fullName, gender = null, dateOfBirth = null, admissionNumber = null,
  classId = null, streamId = null, academicYearId = null, studentId = null,
} = {}) {
  const school = requireSchoolUuid(schoolId);
  const selection = requireEnrollmentSelection({ classId, academicYearId, streamId });
  const { data, error } = await supabase.rpc('save_student_with_enrollment_atomic', {
    p_school: school,
    p_student_id: studentId || null,
    p_full_name: fullName,
    p_gender: gender || null,
    p_date_of_birth: dateOfBirth || null,
    p_admission_number: admissionNumber || null,
    p_class_id: selection.classId,
    p_stream_id: selection.streamId,
    p_academic_year_id: selection.academicYearId,
  });
  if (error) throw error;
  ['students', 'student_enrollments', 'classes'].forEach(notifyCanonicalChange);
  return data;
}

/* Client-side validation shared by the CRUD forms (the DB re-validates all
   of this anyway — these exist for friendly, immediate messages). */
export function p4Validate(fields, values) {
  for (const f of fields) {
    const v = (values[f.key] == null ? '' : String(values[f.key])).trim();
    if (f.required && !v) return `${f.label} waa qasab (required).`;
    if (f.date && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${f.label}: qaabka taariikhdu waa YYYY-MM-DD.`;
    if (f.number && v && isNaN(Number(v))) return `${f.label} waa inuu noqdaa lambar.`;
    if (f.phone && f.required && v.replace(/[^0-9+]/g, '').length < 7) return `${f.label}: lambarka telefoonku waa inuu sax ahaadaa.`;
  }
  const s = fields.find((f) => f.key === 'starts_on');
  const e = fields.find((f) => f.key === 'ends_on');
  if (s && e && values.starts_on && values.ends_on && values.ends_on < values.starts_on) {
    return 'Taariikhda dhammaadku waa inay ka dambaysaa tan bilowga.';
  }
  return null;
}
