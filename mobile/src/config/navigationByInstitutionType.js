/* ============================================================
   Kobciye — Phase 3 foundation: navigation catalog by institution type

   School Mode's LIVE navigation is still owned by
   navigation/RootNavigator.js + context/RoleContext.js (unchanged by this
   task — Primary/Middle and Secondary already share that single navigator).
   SCHOOL_NAV_ITEMS below documents that same catalog in one place, in the
   shape Phase 4 screens can eventually read from directly.

   University Mode's navigation is real and live: navigation/UniversityAppShell.js
   renders UNIVERSITY_NAV_ITEMS. University users only ever see this list —
   never a School Mode item, and vice versa (test-enforced, see
   scripts/institution-mode.test.js).
   ============================================================ */
import { INSTITUTION_TYPES } from './institutionTypes';
import { terminologyForStage } from './schoolStages';

export const SCHOOL_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'classes', label: 'Fasallada', icon: 'classes' },
  { key: 'students', label: 'Ardayda', icon: 'students' },
  { key: 'teachers', label: 'Macallimiinta', icon: 'teachers' },
  { key: 'subjects', label: 'Maadooyinka', icon: 'lessons' },
  { key: 'attendance', label: 'Xaadiriska', icon: 'attendance' },
  { key: 'exams', label: 'Imtixaannada', icon: 'exams' },
  { key: 'results', label: 'Natiijooyinka', icon: 'exams' },
  { key: 'parents', label: 'Waalidiinta', icon: 'profile' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

export const UNIVERSITY_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'faculties', label: 'Kulliyadaha', icon: 'building' },
  { key: 'departments', label: 'Departments', icon: 'classes' },
  { key: 'programmes', label: 'Programmes', icon: 'note' },
  { key: 'academicYears', label: 'Academic Years', icon: 'clock' },
  { key: 'semesters', label: 'Semesters', icon: 'pin' },
  { key: 'courses', label: 'Courses', icon: 'lessons' },
  { key: 'lecturers', label: 'Lecturers', icon: 'teachers' },
  { key: 'students', label: 'Students', icon: 'students' },
  { key: 'cohorts', label: 'Cohorts / Levels', icon: 'billing' },
  { key: 'registration', label: 'Registration', icon: 'mail' },
  { key: 'results', label: 'Results', icon: 'exams' },
  { key: 'transcripts', label: 'Transcripts', icon: 'note' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

/* Bottom-bar primary tabs; the rest are reachable from a "More" list — same
   shared UX pattern RootNavigator already uses (Dashboard + a few + More). */
export const UNIVERSITY_PRIMARY_TAB_KEYS = ['dashboard', 'students', 'courses'];

export function navItemsFor(institutionType) {
  return institutionType === INSTITUTION_TYPES.UNIVERSITY ? UNIVERSITY_NAV_ITEMS : SCHOOL_NAV_ITEMS;
}

/* Stage-aware School Mode catalog: same items, same keys, same icons — ONLY
   the classes label changes with the school's stage (Fasallada for
   Primary/Middle, Formamka for Secondary). null/unknown stage falls back to
   the Primary/Middle wording (see terminologyForStage). */
export function schoolNavItemsFor(schoolStage) {
  const t = terminologyForStage(schoolStage);
  return SCHOOL_NAV_ITEMS.map((item) => (
    item.key === 'classes' ? { ...item, label: t.classLabelPlural } : item
  ));
}

/* Terms that must never leak into the other mode's UI (test-enforced). */
export const SCHOOL_ONLY_TERMS = ['Fasallada', 'Waalidiinta'];
export const UNIVERSITY_ONLY_TERMS = ['Kulliyadaha', 'Semesters', 'Transcripts'];
