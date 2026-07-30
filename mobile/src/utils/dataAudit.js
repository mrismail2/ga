/* ============================================================
   Kobciye — Data audit (structural integrity of the canonical store)

   Pure validation used both at runtime and by scripts/audit-foundation.js:
     • each class has school_id + a globally-unique class_id
     • each student has student_internal_id, student_id, school_id, class_id
     • active records reference valid school / class / student ids
     • no duplicate student_id within one school
     • no duplicate class_id globally
   Returns { ok, errors }.
   ============================================================ */

export function validateAppData(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return { ok: false, errors: ['app data missing'] };

  const classes = data.classes || [];
  const students = data.students || [];
  const schools = data.schools || [];

  // --- classes: school_id + globally-unique class_id ---
  const classIds = new Set();
  classes.forEach((c, i) => {
    if (!c.school_id) errors.push(`class[${i}] (${c.class_id || c.name}) missing school_id`);
    if (!c.class_id) errors.push(`class[${i}] (${c.name}) missing class_id`);
    else if (!/^school_[a-z0-9]+_class_/i.test(c.class_id)) errors.push(`class ${c.class_id} is not a globally-unique id`);
    if (c.class_id && classIds.has(c.class_id)) errors.push(`duplicate class_id ${c.class_id}`);
    if (c.class_id) classIds.add(c.class_id);
  });

  // --- students: required identity fields ---
  const perSchoolStudentIds = {};
  const internalIds = new Set();
  students.forEach((s, i) => {
    ['student_internal_id', 'student_id', 'school_id', 'class_id'].forEach((f) => {
      if (!s[f]) errors.push(`student[${i}] (${s.full_name || s.student_id || i}) missing ${f}`);
    });
    if (s.student_internal_id) {
      if (internalIds.has(s.student_internal_id)) errors.push(`duplicate student_internal_id ${s.student_internal_id}`);
      internalIds.add(s.student_internal_id);
    }
    // no duplicate student_id within one school
    if (s.student_id && s.school_id) {
      const key = s.school_id;
      perSchoolStudentIds[key] = perSchoolStudentIds[key] || new Set();
      if (perSchoolStudentIds[key].has(s.student_id)) errors.push(`duplicate student_id ${s.student_id} in ${s.school_id}`);
      perSchoolStudentIds[key].add(s.student_id);
    }
    // referential integrity: student.class_id must exist among classes (when classes seeded)
    if (s.class_id && classIds.size && !classIds.has(s.class_id)) {
      errors.push(`student ${s.student_id} references unknown class_id ${s.class_id}`);
    }
  });

  // --- active relational records reference valid ids ---
  const schoolIds = new Set(schools.map((s) => s.school_id));
  (data.results || []).forEach((r, i) => {
    if (r.student_internal_id && internalIds.size && !internalIds.has(r.student_internal_id)) {
      errors.push(`result[${i}] references unknown student_internal_id ${r.student_internal_id}`);
    }
    if (r.class_id && classIds.size && !classIds.has(r.class_id)) {
      errors.push(`result[${i}] references unknown class_id ${r.class_id}`);
    }
  });
  (data.exams || []).forEach((e, i) => {
    if (e.class_id && classIds.size && !classIds.has(e.class_id)) errors.push(`exam[${i}] references unknown class_id ${e.class_id}`);
    if (e.school_id && schoolIds.size && !schoolIds.has(e.school_id)) errors.push(`exam[${i}] references unknown school_id ${e.school_id}`);
  });

  return { ok: errors.length === 0, errors };
}
