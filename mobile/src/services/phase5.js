/* ============================================================
   Kobciye — Phase 5 data services

   Thin, allow-listed access to the Phase 5 tables and RPCs. LIVE data only:
   every call goes straight to Supabase under the caller's own JWT, so RLS is
   the real authority — nothing here reads or writes AsyncStorage, and no
   service-role key is ever involved (only the public client from
   services/supabase.js). Every school-scoped call validates the school_id is
   a real uuid first (utils/uuid), so a placeholder ("*"/null) can never reach
   a Supabase uuid column — the same invariant Phase 4 established.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';
import { isUuid } from '../utils/uuid';
import { notifyCanonicalChange } from './canonicalStore';

function requireClient() {
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
}
function requireSchool(schoolId) {
  if (!isUuid(schoolId)) {
    const e = new Error('Dooro dugsi sax ah ka hor inta aadan xogtiisa maamulin.');
    e.code = 'invalid_school_id';
    throw e;
  }
  return schoolId;
}

/* Postgres / RPC error → a short Somali message a form can show inline. */
export function p5FriendlyError(error) {
  const msg = (error && (error.message || String(error))) || '';
  const code = error && error.code;
  if (code === 'not_configured' || code === 'invalid_school_id') return msg;
  if (code === '22P02' || /invalid input syntax for type uuid/i.test(msg)) {
    return 'Aqoonsi sax ah ayaa loo baahan yahay. Dooro dugsiga aad rabto inaad maamusho.';
  }
  if (code === '23505' || /duplicate key|already exists|unique/i.test(msg)) {
    return 'Diiwaan isku mid ah ayaa horey u jiray. Beddel qiimaha.';
  }
  if (/row-level security|not authorized|only a school admin|only an assigned|not assigned/i.test(msg)) {
    return 'Ma lihid oggolaansho aad falkan samayso.';
  }
  if (/another school/i.test(msg)) return 'Diiwaanka aad dooratay wuxuu ka tirsan yahay dugsi kale.';
  if (/negative|exceed|greater than zero/i.test(msg)) return msg;
  if (/overlap/i.test(msg)) return 'Waqtigan ayaa is-dulmaraya mid kale. Dooro waqti kale.';
  return msg || 'Waa la fashilmay. Isku day mar kale.';
}

/* generic school-scoped list with an optional extra filter map + ordering */
async function listBy(table, schoolId, { order = 'created_at', ascending = false, match = null, limit = 500 } = {}) {
  requireClient();
  requireSchool(schoolId);
  let q = supabase.from(table).select('*').eq('school_id', schoolId);
  if (match) for (const [k, v] of Object.entries(match)) if (v != null) q = q.eq(k, v);
  const { data, error } = await q.order(order, { ascending }).limit(limit);
  if (error) throw error;
  return data || [];
}

async function insertRow(table, row) {
  requireClient();
  requireSchool(row && row.school_id);
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  notifyCanonicalChange(table);
  return data;
}
async function updateRow(table, id, patch) {
  requireClient();
  const { school_id, id: _id, created_at, ...safe } = patch || {};
  const { data, error } = await supabase.from(table).update(safe).eq('id', id).select().single();
  if (error) throw error;
  notifyCanonicalChange(table);
  return data;
}
async function rpc(name, params) {
  requireClient();
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

/* ---------------- account provisioning ---------------- */
export async function listAccountInvitations(schoolId, match) { return listBy('account_invitations', schoolId, { match }); }
// the Auth-admin work happens server-side in the provision-account Edge Function
export async function provisionAccount(payload) {
  requireClient();
  const { data, error } = await supabase.functions.invoke('provision-account', { body: payload });
  if (error) throw error;
  return data;
}
export async function revokeAccountInvitation(invitationId) {
  return provisionAccount({ action: 'revoke', invitation_id: invitationId });
}

/* ---------------- timetable ---------------- */
export async function listTimetablePeriods(schoolId) { return listBy('timetable_periods', schoolId, { order: 'sort_order', ascending: true }); }
export async function createTimetablePeriod(row) { return insertRow('timetable_periods', row); }
export async function listSchoolDays(schoolId) { return listBy('school_days', schoolId, { order: 'day_of_week', ascending: true }); }
export async function upsertSchoolDay(row) { return insertRow('school_days', row); }
export async function listTimetableEntries(schoolId, match) { return listBy('timetable_entries', schoolId, { order: 'day_of_week', ascending: true, match }); }
export async function createTimetableEntry(row) { return insertRow('timetable_entries', row); }
export async function updateTimetableEntry(id, patch) { return updateRow('timetable_entries', id, patch); }

/* ---------------- attendance ---------------- */
export async function getAttendanceSettings(schoolId) {
  requireClient(); requireSchool(schoolId);
  const { data, error } = await supabase.from('attendance_settings').select('*').eq('school_id', schoolId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveAttendanceSettings(row) {
  requireClient(); requireSchool(row && row.school_id);
  const { data, error } = await supabase.from('attendance_settings').upsert(row, { onConflict: 'school_id' }).select().single();
  if (error) throw error;
  return data;
}
export async function listAttendanceSessions(schoolId, match) { return listBy('attendance_sessions', schoolId, { order: 'session_date', match }); }
export async function listAttendanceRecords(schoolId, match) { return listBy('attendance_records', schoolId, { match }); }
/* the ONE atomic save (student + status + notifications). records: [{student_id,status,reason}] */
export async function saveAttendanceSession(schoolId, { classId, sessionDate, records, streamId = null, subjectId = null, periodId = null, timetableEntryId = null, academicYearId = null, termId = null, note = null, submit = true }) {
  requireSchool(schoolId);
  return rpc('save_attendance_session_atomic', {
    p_school: schoolId, p_class: classId, p_session_date: sessionDate, p_records: records,
    p_stream: streamId, p_subject: subjectId, p_period: periodId, p_timetable_entry: timetableEntryId,
    p_academic_year: academicYearId, p_term: termId, p_note: note, p_submit: submit,
  });
}
export async function attendanceSummary(schoolId, { classId = null, studentId = null, from = null, to = null } = {}) {
  requireSchool(schoolId);
  return rpc('attendance_summary', { p_school: schoolId, p_class: classId, p_student: studentId, p_from: from, p_to: to });
}

/* ---------------- notifications ---------------- */
export async function listNotifications(limit = 100) {
  requireClient();
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}
export async function unreadNotificationCount() {
  requireClient();
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count || 0;
}
export async function markNotificationRead(id) { return rpc('mark_notification_read', { p_notification: id }); }

/* ---------------- assignments ---------------- */
export async function listAssignments(schoolId, match) { return listBy('assignments', schoolId, { match }); }
export async function createAssignment(row) { return insertRow('assignments', row); }
export async function updateAssignment(id, patch) { return updateRow('assignments', id, patch); }
export async function listSubmissions(schoolId, match) { return listBy('assignment_submissions', schoolId, { order: 'submitted_at', match }); }
export async function createSubmission(row) { return insertRow('assignment_submissions', row); }
export async function gradeSubmission(id, patch) { return updateRow('assignment_submissions', id, patch); }

/* ---------------- exams + results ---------------- */
export async function listExams(schoolId, match) { return listBy('exams', schoolId, { match }); }
export async function createExam(row) { return insertRow('exams', row); }
export async function listExamSchedules(schoolId, match) { return listBy('exam_schedules', schoolId, { order: 'exam_date', ascending: true, match }); }
export async function createExamSchedule(row) { return insertRow('exam_schedules', row); }
export async function listResults(schoolId, match) { return listBy('results', schoolId, { match }); }
export async function enterResult(schoolId, { examId, studentId, score, maxScore = null, component = null, attendanceStatus = 'present' }) {
  requireSchool(schoolId);
  return rpc('enter_result', { p_school: schoolId, p_exam: examId, p_student: studentId, p_score: score, p_max_score: maxScore, p_component: component, p_attendance_status: attendanceStatus });
}
export async function submitResults(schoolId, examId) { requireSchool(schoolId); return rpc('submit_results', { p_school: schoolId, p_exam: examId }); }
export async function approveResults(schoolId, examId) { requireSchool(schoolId); return rpc('approve_results', { p_school: schoolId, p_exam: examId }); }
export async function publishResults(schoolId, examId) { requireSchool(schoolId); return rpc('publish_results', { p_school: schoolId, p_exam: examId }); }

/* ---------------- finance ---------------- */
export async function listFeeStructures(schoolId) { return listBy('fee_structures', schoolId); }
export async function createFeeStructure(row) { return insertRow('fee_structures', row); }
export async function listFeeItems(schoolId, match) { return listBy('fee_items', schoolId, { match }); }
export async function createFeeItem(row) { return insertRow('fee_items', row); }
export async function listInvoices(schoolId, match) { return listBy('student_invoices', schoolId, { match }); }
export async function listPayments(schoolId, match) { return listBy('payments', schoolId, { match }); }
export async function generateInvoice(schoolId, { studentId, feeStructureId, dueDate = null }) {
  requireSchool(schoolId);
  return rpc('generate_invoice', { p_school: schoolId, p_student: studentId, p_fee_structure: feeStructureId, p_due_date: dueDate });
}
export async function recordPayment(schoolId, { invoiceId, amount, method = null, reference = null, receiptNo = null, paidOn = null }) {
  requireSchool(schoolId);
  return rpc('record_payment', { p_school: schoolId, p_invoice: invoiceId, p_amount: amount, p_method: method, p_reference: reference, p_receipt_no: receiptNo, p_paid_on: paidOn });
}
export async function reversePayment(schoolId, paymentId, reason = null) {
  requireSchool(schoolId);
  return rpc('reverse_payment', { p_school: schoolId, p_payment: paymentId, p_reason: reason });
}

/* ---------------- discipline / cases ---------------- */
export async function listIncidents(schoolId, match) { return listBy('incidents', schoolId, { match }); }
export async function createIncident(row) { return insertRow('incidents', row); }
export async function updateIncident(id, patch) { return updateRow('incidents', id, patch); }
export async function listIncidentActions(schoolId, match) { return listBy('incident_actions', schoolId, { order: 'action_date', match }); }
export async function createIncidentAction(row) { return insertRow('incident_actions', row); }
export async function listIncidentNotes(schoolId, match) { return listBy('incident_notes', schoolId, { match }); }
export async function createIncidentNote(row) { return insertRow('incident_notes', row); }

/* ---------------- reports ---------------- */
export async function reportEnrollmentSummary(schoolId, academicYearId = null) { requireSchool(schoolId); return rpc('report_enrollment_summary', { p_school: schoolId, p_academic_year: academicYearId }); }
export async function reportFeeBalanceSummary(schoolId, academicYearId = null) { requireSchool(schoolId); return rpc('report_fee_balance_summary', { p_school: schoolId, p_academic_year: academicYearId }); }
export async function reportTeacherAssignments(schoolId) { requireSchool(schoolId); return rpc('report_teacher_assignments', { p_school: schoolId }); }
export async function reportResultsSummary(schoolId, termId = null) { requireSchool(schoolId); return rpc('report_results_summary', { p_school: schoolId, p_term: termId }); }

/* ---------------- university results + transcripts ---------------- */
export async function listCourseEnrollments(schoolId, match) { return listBy('course_enrollments', schoolId, { match }); }
export async function createCourseEnrollment(row) { return insertRow('course_enrollments', row); }
export async function listCourseResults(schoolId, match) { return listBy('course_results', schoolId, { match }); }
export async function upsertCourseResult(row) { return insertRow('course_results', row); }
export async function listTranscripts(schoolId, match) { return listBy('transcripts', schoolId, { match }); }
export async function issueTranscript(schoolId, { studentId, academicYearId = null, semesterId = null }) {
  requireSchool(schoolId);
  return rpc('issue_transcript', { p_school: schoolId, p_student: studentId, p_academic_year: academicYearId, p_semester: semesterId });
}
