/* ============================================================
   Kobciye — Canonical School Identity (Phase 1/2 foundation)

   ONE school identity system used by every module. The only relationship
   key is `school_id`. `slug` is display/URL text only — never a relation key.

   Structure (per school):
   {
     school_id: "school_001",
     slug: "hidaayada",
     name: "Dugsiga Hidaayada",
     student_id_prefix: "HID",
     next_student_sequence: 143,
     plan: "small" | "large",   // billing tier
   }

   Frontend prototype — no backend. Prefix/sequence live in schoolIdStorage.
   ============================================================ */

export const SCHOOL_REGISTRY = [
  {
    school_id: 'school_001', slug: 'hidaayada', name: 'Dugsiga Hidaayada',
    code: 'KOB-SCH-001', type: 'Primary School', city: 'Gabiley',
    student_id_prefix: 'HID', next_student_sequence: 143,
    plan: 'small', status: 'active',
  },
  {
    school_id: 'school_002', slug: 'nuur', name: 'Dugsiga Nuur',
    code: 'KOB-SCH-002', type: 'Secondary School', city: 'Hargeysa',
    student_id_prefix: 'NUR', next_student_sequence: 51,
    plan: 'large', status: 'active',
  },
  {
    school_id: 'school_003', slug: 'iftiin', name: 'Dugsiga Iftiin',
    code: 'KOB-SCH-003', type: 'Primary School', city: 'Burco',
    student_id_prefix: 'IFT', next_student_sequence: 12,
    plan: 'small', status: 'trial',
  },
];

/* ---- canonical helpers (spec-named) ---- */

/* the ONLY way to resolve a school by its relationship key */
export function getSchoolById(schoolId) {
  return SCHOOL_REGISTRY.find((s) => s.school_id === schoolId) || null;
}

/* slug is display/URL text only — resolve it to the canonical record */
export function getSchoolBySlug(slug) {
  return SCHOOL_REGISTRY.find((s) => s.slug === slug) || null;
}

/* the school_id the active profile is acting on. Super Admin (school_id '*')
   previews school_001 for single-school screens; pass an explicit override
   when a Super Admin has picked a branch. */
export function getCurrentSchoolId(profile, override) {
  if (override) return override;
  if (!profile) return 'school_001';
  if (profile.school_id === '*' || !profile.school_id) return 'school_001';
  return profile.school_id;
}

/* resolve to the full school record for the active profile */
export function getCurrentSchool(profile, override) {
  return getSchoolById(getCurrentSchoolId(profile, override)) || SCHOOL_REGISTRY[0];
}

/* display name for any school_id (never use slug for display lookups) */
export function getSchoolName(schoolId) {
  const s = getSchoolById(schoolId);
  return s ? s.name : schoolId;
}
