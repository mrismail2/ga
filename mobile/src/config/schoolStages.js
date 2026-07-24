/* ============================================================
   Kobciye — Phase 3 foundation: School Stage (Primary/Middle vs Secondary)

   Only meaningful when institution_type === 'school' (see
   supabase/migrations/20260705000001_institution_type.sql). Primary/Middle
   and Secondary schools share ONE SchoolAppShell/navigation — the only
   allowed difference between them is labels/terminology, and that
   difference must come from here, not from scattered
   `if (school_stage === 'secondary')` checks across screens.
   ============================================================ */

const stagePolicy = require('../domain/schoolStagePolicy');
export const SCHOOL_STAGES = stagePolicy.SCHOOL_STAGES;

export const SCHOOL_STAGE_LABELS = {
  [SCHOOL_STAGES.PRIMARY_MIDDLE]: 'Dugsi Hoose/Dhexe',
  [SCHOOL_STAGES.SECONDARY]: 'Dugsi Sare',
};

/* Super Admin → Register New School: "Heerka Dugsiga" field options,
   shown only when Nooca Hay'adda === Dugsi. */
export const SCHOOL_STAGE_OPTIONS = [
  { value: SCHOOL_STAGES.PRIMARY_MIDDLE, label: SCHOOL_STAGE_LABELS[SCHOOL_STAGES.PRIMARY_MIDDLE] },
  { value: SCHOOL_STAGES.SECONDARY, label: SCHOOL_STAGE_LABELS[SCHOOL_STAGES.SECONDARY] },
];

export function isValidSchoolStage(v) {
  return v === SCHOOL_STAGES.PRIMARY_MIDDLE || v === SCHOOL_STAGES.SECONDARY;
}

/* Terminology that differs by stage — the ONLY allowed difference between
   Primary/Middle and Secondary school UIs (they share one SchoolAppShell).
   Screens read labels from here (terminologyForStage below) instead of
   hardcoding "Fasal" vs "Form", so Primary/Middle never shows Form/stream
   wording and Secondary never shows Primary-only wording. */
export const SCHOOL_STAGE_TERMINOLOGY = stagePolicy.SCHOOL_STAGE_TERMINOLOGY;

/* The stage-aware label set for a school. Accepts null/undefined/unknown
   (demo mode, a pre-classification school, a super_admin with no school row)
   and falls back to the neutral Primary/Middle terms — never Secondary-only
   wording by accident. */
export const terminologyForStage = stagePolicy.terminologyForStage;
export const applySchoolStageToModule = stagePolicy.applySchoolStageToModule;

/* Wording that must never leak into the OTHER stage's UI (test-enforced,
   mirroring SCHOOL_ONLY_TERMS / UNIVERSITY_ONLY_TERMS in
   navigationByInstitutionType.js). */
export const SECONDARY_ONLY_TERMS = ['Formamka'];
export const PRIMARY_ONLY_TERMS = ['Fasallada'];

/* ============================================================
   Phase 4 forward-compatibility: school SECTIONS.

   school_stage is the school's INITIAL/default stage — it is not a locked
   product mode. One institution may later run several sections at once
   (e.g. Hoose/Dhexe today, open a Secondary section next year). Phase 4's
   section management should build on these constants + a per-school
   enabled-sections list (a NEW corrective migration when that ships) —
   NOT on new hardcoded strings. Nothing reads enabledSections yet.
   ============================================================ */
export const SCHOOL_SECTIONS = {
  PRIMARY: 'primary',
  MIDDLE: 'middle',
  SECONDARY: 'secondary',
};

export const SCHOOL_SECTION_LABELS = {
  [SCHOOL_SECTIONS.PRIMARY]: 'Dugsi Hoose',
  [SCHOOL_SECTIONS.MIDDLE]: 'Dugsi Dhexe',
  [SCHOOL_SECTIONS.SECONDARY]: 'Dugsi Sare',
};

/* The sections a school starts with, derived from its initial stage. Phase 4
   may let a school enable more; until then this is the whole list. */
export function defaultSectionsForStage(stage) {
  if (stage === SCHOOL_STAGES.SECONDARY) return [SCHOOL_SECTIONS.SECONDARY];
  return [SCHOOL_SECTIONS.PRIMARY, SCHOOL_SECTIONS.MIDDLE];
}
