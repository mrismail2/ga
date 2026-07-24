/* ============================================================
   Kobciye — Phase 3 foundation: School Mode vs University Mode

   Single source of truth for the institution_type concept (see
   supabase/migrations/20260705000001_institution_type.sql). Screens must
   read from here instead of hardcoding 'school'/'university' strings or
   Somali labels, so the whole app stays in sync if wording ever changes.
   ============================================================ */

export const INSTITUTION_TYPES = {
  SCHOOL: 'school',
  UNIVERSITY: 'university',
};

export const INSTITUTION_TYPE_LABELS = {
  [INSTITUTION_TYPES.SCHOOL]: 'Dugsi',
  [INSTITUTION_TYPES.UNIVERSITY]: 'Jaamacad',
};

/* Super Admin → Register New School: "Nooca Hay'adda" field options. */
export const INSTITUTION_TYPE_OPTIONS = [
  { value: INSTITUTION_TYPES.SCHOOL, label: INSTITUTION_TYPE_LABELS[INSTITUTION_TYPES.SCHOOL] },
  { value: INSTITUTION_TYPES.UNIVERSITY, label: INSTITUTION_TYPE_LABELS[INSTITUTION_TYPES.UNIVERSITY] },
];

export function isValidInstitutionType(v) {
  return v === INSTITUTION_TYPES.SCHOOL || v === INSTITUTION_TYPES.UNIVERSITY;
}

/* Shown if a future screen ever offers to change an existing school's
   institution_type/school_stage. There is no working conversion path yet —
   see the migration's guard trigger (schools_guard_institution_fields) and
   PHASE_3_COMPLETION_REPORT.md. Real conversion needs its own safe,
   audited data-migration tool (Phase 4/5+), not a bare column flip. */
export const CONVERSION_BLOCKED_MESSAGE =
  "Beddelidda nooca hay’adda waxay u baahan tahay hab gaar ah oo xogta si ammaan ah loogu wareejiyo.";
