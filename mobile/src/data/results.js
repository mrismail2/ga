/* ============================================================
   Kobciye — Results / Natiijooyinka helpers (frontend prototype)

   For every student we show ALL subjects registered for their class,
   then compute per-subject grade + pass/fail, plus overall total,
   average and final result. Mock data only; ready for a DB later.
   ============================================================ */

// subjects registered per grade band (class.subject_ids equivalent)
const SUBJECTS_BY_GRADE = {
  'Dugsi Hoose': ['Xisaab', 'Af-Soomaali', 'Ingiriis', 'Cilmiga Diinta'],
  'Dugsi Dhexe': ['Xisaab', 'Sayniska', 'Af-Soomaali', 'Ingiriis', 'Juqraafi'],
  'Dugsi Sare': ['Xisaab', 'Fiisigis', 'Kimistari', 'Bayoloji', 'Ingiriis', 'Taariikh'],
};

export function getClassSubjects(grade) {
  return SUBJECTS_BY_GRADE[grade] || SUBJECTS_BY_GRADE['Dugsi Dhexe'];
}

function gradeOf(pct) {
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

// deterministic mark per (student, subject) so results are stable
function markFor(code, subject, full) {
  const seed = (String(code) + subject).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return 40 + (seed % (full - 39));
}

/* calculateStudentResult — all registered subjects + totals + pass/fail */
export function calculateStudentResult(student, grade, passMark = 50, full = 100) {
  const subjects = getClassSubjects(grade);
  const rows = subjects.map((subject) => {
    const marks = markFor(student.student_internal_id, subject, full);
    const pct = Math.round((marks / full) * 100);
    return { subject, marks, full, pct, grade: gradeOf(pct), passed: marks >= passMark };
  });
  const total = rows.reduce((a, r) => a + r.marks, 0);
  const fullTotal = full * subjects.length;
  const average = Math.round((total / fullTotal) * 100);
  const passed = rows.every((r) => r.passed);
  return { rows, total, fullTotal, average, passed, passMark };
}

/* summarizeStudentExams — the REAL exams a teacher entered for this student,
   grouped by subject and showing BOTH terms separately plus the auto-combined
   average. Used by the student profile (admin/teacher view).
   results: appData.results · terms/subjects: appData.terms/appData.subjects */
export function summarizeStudentExams(results, terms, subjects, studentInternalId) {
  const termName = (tid) => ((terms || []).find((t) => t.term_id === tid) || {}).name || tid || 'Term';
  const termOrder = (tid) => ((terms || []).find((t) => t.term_id === tid) || {}).order || 99;
  const subjName = (sid) => ((subjects || []).find((s) => s.subject_id === sid) || {}).name || sid;
  const mine = (results || []).filter((r) => r.student_internal_id === studentInternalId);
  const bySubject = {};
  mine.forEach((r) => {
    const k = r.subject_id || r.subject_name || 'subj';
    (bySubject[k] = bySubject[k] || []).push(r);
  });
  return Object.keys(bySubject).map((sid) => {
    const rows = bySubject[sid].slice().sort((a, b) => termOrder(a.term_id) - termOrder(b.term_id));
    const termRows = rows.map((r) => {
      const full = r.full_marks || 100;
      const pct = r.percentage != null ? r.percentage : Math.round((r.score / full) * 100);
      return { term: termName(r.term_id), score: r.score, full, pct };
    });
    const combined = termRows.length ? Math.round(termRows.reduce((a, t) => a + t.pct, 0) / termRows.length) : null;
    return { subject: subjName(sid), terms: termRows, combined };
  });
}
