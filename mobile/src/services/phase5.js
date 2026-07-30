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
  if (data && data.error) throw new Error(data.error);
  return data;
}
export async function revokeAccountInvitation(invitationId) {
  return provisionAccount({ action: 'revoke', invitation_id: invitationId });
}
export async function getSchoolLoginSettings(schoolId) {
  requireClient(); requireSchool(schoolId);
  const { data, error } = await supabase.from('schools').select('id, login_code').eq('id', schoolId).single();
  if (error) throw error;
  return data;
}
export async function setSchoolLoginCode(schoolId, code) {
  requireSchool(schoolId);
  return rpc('set_school_login_code', { p_school: schoolId, p_code: code });
}
export async function setParentLoginPhone(schoolId, parentId, phone, enabled = true) {
  requireSchool(schoolId);
  return rpc('set_parent_login_phone', { p_school: schoolId, p_parent: parentId, p_phone: phone, p_enabled: enabled });
}

/* ---------------- timetable ---------------- */
export async function listTimetablePeriods(schoolId) { return listBy('timetable_periods', schoolId, { order: 'sort_order', ascending: true }); }
export async function createTimetablePeriod(row) { return insertRow('timetable_periods', row); }
export async function updateTimetablePeriod(id, patch) { return updateRow('timetable_periods', id, patch); }
export async function listSchoolDays(schoolId) { return listBy('school_days', schoolId, { order: 'day_of_week', ascending: true }); }
export async function upsertSchoolDay(row) {
  requireClient(); requireSchool(row && row.school_id);
  const { data, error } = await supabase.from('school_days').upsert(row, { onConflict: 'school_id,day_of_week' }).select().single();
  if (error) throw error;
  notifyCanonicalChange('school_days');
  return data;
}
export async function updateSchoolDay(id, patch) { return updateRow('school_days', id, patch); }
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
export async function listAttendanceRecords(schoolId, match) {
  requireClient(); requireSchool(schoolId);
  let q = supabase.from('attendance_records')
    .select('id, session_id, student_id, status, reason, corrected_at, created_at, student:students(full_name)')
    .eq('school_id', schoolId);
  if (match) for (const [k, v] of Object.entries(match)) if (v != null) q = q.eq(k, v);
  const { data, error } = await q.order('created_at', { ascending: true }).limit(1000);
  if (error) throw error;
  return data || [];
}
export async function attendanceRosterForDate(schoolId, { classId, date, streamId = null }) {
  requireSchool(schoolId);
  return rpc('attendance_roster_for_date', { p_school: schoolId, p_class: classId, p_date: date, p_stream: streamId });
}
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
/* read-only attendance for the signed-in Student (own) or Parent (linked
   children) — RLS on attendance_records scopes the rows; the session join
   supplies the date/class/subject for display. No marking here. */
export async function myAttendance(schoolId) {
  requireClient(); requireSchool(schoolId);
  const { data, error } = await supabase.from('attendance_records')
    .select('id, status, student_id, corrected_at, student:students(full_name), session:attendance_sessions(session_date, class_id, subject_id, class:classes(name), subject:subjects(name))')
    .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(400);
  if (error) throw error;
  return data || [];
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
export async function markAllNotificationsRead() { return rpc('mark_all_notifications_read', {}); }

/* ---------------- assignments ---------------- */
export async function listAssignments(schoolId, match) { return listBy('assignments', schoolId, { match }); }
export async function createAssignment(row) { return insertRow('assignments', row); }
export async function updateAssignment(id, patch) { return updateRow('assignments', id, patch); }
export async function listAssignmentAttachments(schoolId, match) { return listBy('assignment_attachments', schoolId, { match }); }
export async function createAssignmentAttachment(row) { return insertRow('assignment_attachments', row); }
export async function listSubmissions(schoolId, match) { return listBy('assignment_submissions', schoolId, { order: 'submitted_at', match }); }
export async function listSubmissionAttachments(schoolId, match) { return listBy('submission_attachments', schoolId, { match }); }
export async function submitAssignmentWork(schoolId, { assignmentId, content = null, attachments = [] }) {
  requireSchool(schoolId);
  return rpc('submit_assignment_work', { p_school: schoolId, p_assignment: assignmentId, p_content: content, p_attachments: attachments });
}
export async function gradeAssignmentSubmission(schoolId, { submissionId, score = null, feedback = null, returnForRevision = false }) {
  requireSchool(schoolId);
  return rpc('grade_assignment_submission', { p_school: schoolId, p_submission: submissionId, p_score: score, p_feedback: feedback, p_return_for_revision: returnForRevision });
}
// Kept for internal/admin compatibility; Student UI must use the RPC above.
export async function createSubmission(row) { return insertRow('assignment_submissions', row); }
export async function gradeSubmission(id, patch) { return updateRow('assignment_submissions', id, patch); }

/* ---------------- exams + results ---------------- */
export async function listExams(schoolId, match) { return listBy('exams', schoolId, { match }); }
export async function createExam(row) { return insertRow('exams', row); }
export async function updateExam(id, patch) { return updateRow('exams', id, patch); }
export async function listExamSchedules(schoolId, match) { return listBy('exam_schedules', schoolId, { order: 'exam_date', ascending: true, match }); }
export async function createExamSchedule(row) { return insertRow('exam_schedules', row); }
export async function updateExamSchedule(id, patch) { return updateRow('exam_schedules', id, patch); }
export async function examRosterForSchedule(schoolId, scheduleId) { requireSchool(schoolId); return rpc('exam_roster_for_schedule', { p_school: schoolId, p_schedule: scheduleId }); }
export async function listResults(schoolId, match) { return listBy('results', schoolId, { match }); }
export async function enterResult(schoolId, { examId, studentId, score, maxScore = null, component = null, attendanceStatus = 'present' }) {
  requireSchool(schoolId);
  return rpc('enter_result', { p_school: schoolId, p_exam: examId, p_student: studentId, p_score: score, p_max_score: maxScore, p_component: component, p_attendance_status: attendanceStatus });
}
export async function enterScheduledResult(schoolId, { scheduleId, studentId, score, maxScore = null, component = null, attendanceStatus = 'present' }) {
  requireSchool(schoolId);
  return rpc('enter_scheduled_result', { p_school: schoolId, p_schedule: scheduleId, p_student: studentId, p_score: score, p_max_score: maxScore, p_component: component, p_attendance_status: attendanceStatus });
}
export async function submitResults(schoolId, examId) { requireSchool(schoolId); return rpc('submit_results', { p_school: schoolId, p_exam: examId }); }
export async function approveResults(schoolId, examId) { requireSchool(schoolId); return rpc('approve_results', { p_school: schoolId, p_exam: examId }); }
export async function publishResults(schoolId, examId) { requireSchool(schoolId); return rpc('publish_results', { p_school: schoolId, p_exam: examId }); }

/* ---------------- finance ---------------- */
export async function listFeeStructures(schoolId) { return listBy('fee_structures', schoolId); }
export async function createFeeStructure(row) { return insertRow('fee_structures', row); }
export async function updateFeeStructure(id, patch) { return updateRow('fee_structures', id, patch); }
export async function listFeeItems(schoolId, match) { return listBy('fee_items', schoolId, { match }); }
export async function createFeeItem(row) { return insertRow('fee_items', row); }
export async function updateFeeItem(id, patch) { return updateRow('fee_items', id, patch); }
export async function listInvoices(schoolId, match) { return listBy('student_invoices', schoolId, { match }); }
export async function listInvoiceItems(schoolId, match) { return listBy('invoice_items', schoolId, { match }); }
export async function listInvoiceAdjustments(schoolId, match) { return listBy('invoice_adjustments', schoolId, { match }); }
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
export async function applyInvoiceAdjustment(schoolId, { invoiceId, kind, amount, reason = null }) {
  requireSchool(schoolId);
  return rpc('apply_invoice_adjustment', { p_school: schoolId, p_invoice: invoiceId, p_kind: kind, p_amount: amount, p_reason: reason });
}

/* ---------------- discipline / cases ---------------- */
export async function listIncidents(schoolId, match) { return listBy('incidents', schoolId, { match }); }
export async function createIncident(row) { requireSchool(row.school_id); return rpc('create_student_incident', { p_school: row.school_id, p_student: row.student_id, p_class: row.class_id || null, p_incident_date: row.incident_date || null, p_category: row.category || null, p_title: row.title, p_detail: row.detail || null, p_severity: row.severity || 'dhexe', p_action: row.action || null, p_follow_up_on: row.follow_up_on || null, p_status: row.status || 'open' }); }
export async function updateIncident(id, patch) { return updateRow('incidents', id, patch); }
export async function listIncidentActions(schoolId, match) { return listBy('incident_actions', schoolId, { order: 'action_date', match }); }
export async function createIncidentAction(row) { requireSchool(row.school_id); return rpc('create_incident_action', { p_school: row.school_id, p_incident: row.incident_id, p_action: row.action, p_action_date: row.action_date || null }); }
export async function listIncidentNotes(schoolId, match) { return listBy('incident_notes', schoolId, { match }); }
export async function createIncidentNote(row) { requireSchool(row.school_id); return rpc('create_incident_note', { p_school: row.school_id, p_incident: row.incident_id, p_note: row.note, p_confidential: !!row.is_confidential }); }
export async function listIncidentHistory(schoolId, match) { return listBy('incident_history', schoolId, { order: 'changed_at', match }); }
export async function listIncidentAttachments(schoolId, match) { return listBy('incident_attachments', schoolId, { match }); }
export async function createIncidentAttachment(row) { requireSchool(row.school_id); return rpc('create_incident_attachment', { p_school: row.school_id, p_incident: row.incident_id, p_file_name: row.file_name, p_storage_path: row.storage_path, p_mime_type: row.mime_type || null, p_size_bytes: row.size_bytes == null ? null : row.size_bytes, p_confidential: !!row.is_confidential }); }

/* ---------------- reports ---------------- */
export async function reportEnrollmentSummary(schoolId, academicYearId = null) { requireSchool(schoolId); return rpc('report_enrollment_summary', { p_school: schoolId, p_academic_year: academicYearId }); }
export async function reportFeeBalanceSummary(schoolId, academicYearId = null) { requireSchool(schoolId); return rpc('report_fee_balance_summary', { p_school: schoolId, p_academic_year: academicYearId }); }
export async function reportTeacherAssignments(schoolId) { requireSchool(schoolId); return rpc('report_teacher_assignments', { p_school: schoolId }); }
export async function reportResultsSummary(schoolId, termId = null) { requireSchool(schoolId); return rpc('report_results_summary', { p_school: schoolId, p_term: termId }); }
export async function reportAttendanceOverview(schoolId, { classId = null, from = null, to = null } = {}) { requireSchool(schoolId); return rpc('report_attendance_overview', { p_school: schoolId, p_class: classId, p_from: from, p_to: to }); }
export async function reportTimetableOverview(schoolId, { academicYearId = null, termId = null } = {}) { requireSchool(schoolId); return rpc('report_timetable_overview', { p_school: schoolId, p_academic_year: academicYearId, p_term: termId }); }
export async function reportAssignmentOverview(schoolId, { classId = null, from = null, to = null } = {}) { requireSchool(schoolId); return rpc('report_assignment_overview', { p_school: schoolId, p_class: classId, p_from: from, p_to: to }); }
export async function reportPaymentOverview(schoolId, { from = null, to = null } = {}) { requireSchool(schoolId); return rpc('report_payment_overview', { p_school: schoolId, p_from: from, p_to: to }); }
export async function reportDisciplineOverview(schoolId, { from = null, to = null } = {}) { requireSchool(schoolId); return rpc('report_discipline_overview', { p_school: schoolId, p_from: from, p_to: to }); }

/* ---------------- university results + transcripts ---------------- */
export async function listCourseEnrollments(schoolId, match) { return listBy('course_enrollments', schoolId, { match }); }
export async function createCourseEnrollment(row) { return insertRow('course_enrollments', row); }
export async function listCourseResults(schoolId, match) { return listBy('course_results', schoolId, { match }); }
export async function upsertCourseResult(row) {
  requireSchool(row && row.school_id);
  return rpc('upsert_course_result', {
    p_school: row.school_id,
    p_enrollment: row.course_enrollment_id,
    p_score: row.score,
  });
}
export async function transitionCourseResult(schoolId, resultId, status) {
  requireSchool(schoolId);
  return rpc('transition_course_result', { p_school: schoolId, p_result: resultId, p_status: status });
}
export async function listTranscripts(schoolId, match) { return listBy('transcripts', schoolId, { match }); }
export async function issueTranscript(schoolId, { studentId, academicYearId = null, semesterId = null }) {
  requireSchool(schoolId);
  return rpc('issue_transcript', { p_school: schoolId, p_student: studentId, p_academic_year: academicYearId, p_semester: semesterId });
}
