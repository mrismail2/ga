/* ============================================================
   Kobciye — Student-Based School Billing (Phase 1/2 foundation)

   The school's monthly Kobciye subscription is computed DIRECTLY from the
   central student registry (services/appDataRepository). Only students with
   status === "active" are billed. There is no separate billing roster.

   Pricing per active student / month:
     small school → $0.07
     large  school → $0.10

   When a student is added active → bill rises; when they become
   left/transferred/graduated/inactive → bill falls; reactivating → rises.
   Fee-exemption affects student FEES, not the school subscription count.

   No payment gateway / backend — local prototype only.
   ============================================================ */
import { SCHOOL_REGISTRY, getSchoolById as getSchoolRecord } from './schools';

/* statuses that are NOT billed (everything except "active") */
export const NON_BILLED_STATUSES = ['left', 'transferred', 'graduated', 'inactive', 'suspended_not_billed'];

export const STATUS_META = {
  active: { tone: 'green', label: 'Active', billed: 'Counted' },
  left: { tone: 'rose', label: 'Left', billed: 'Not Counted' },
  transferred: { tone: 'gold', label: 'Transferred', billed: 'Not Counted' },
  graduated: { tone: 'blue', label: 'Graduated', billed: 'Not Counted' },
  inactive: { tone: 'muted', label: 'Inactive', billed: 'Not Counted' },
  suspended_not_billed: { tone: 'muted', label: 'Suspended', billed: 'Not Counted' },
};

/* the billing schools derive from the ONE canonical school registry */
export const BILL_SCHOOLS = SCHOOL_REGISTRY.map((s) => ({
  id: s.school_id,
  school_id: s.school_id,
  name: s.name,
  plan: s.plan,
  billing_rate: s.plan === 'small' ? 0.07 : 0.10,
  subscription: s.status === 'trial' ? 'unpaid' : 'paid',
}));

export function getSchoolById(id) {
  return BILL_SCHOOLS.find((s) => s.id === id) || null;
}

export function getSchoolBillingRate(school) {
  if (!school) return 0.07;
  if (school.billing_rate) return school.billing_rate;
  return school.plan === 'large' ? 0.10 : 0.07;
}

export function formatCurrency(amount) {
  return '$' + Number(amount || 0).toFixed(2);
}

/* ---- registry-driven counts (pass the central registry students) ----
   Every billing screen loads students from the central store (appDataRepository) and feeds
   them here, so the bill always reflects the real active population. */
export function getActiveStudentsBySchool(students, schoolId) {
  return (students || []).filter((s) => s.school_id === schoolId && s.status === 'active');
}
export function getNonBilledStudentsBySchool(students, schoolId) {
  return (students || []).filter((s) => s.school_id === schoolId && NON_BILLED_STATUSES.indexOf(s.status) !== -1);
}
export function getStudentsBySchool(students, schoolId) {
  return (students || []).filter((s) => s.school_id === schoolId);
}

/* core calculation — active students × per-student rate */
export function calculateSchoolBilling(students, school) {
  const schoolId = school.id || school.school_id;
  const activeStudents = getActiveStudentsBySchool(students, schoolId).length;
  const rate = getSchoolBillingRate(school);
  const monthlyAmount = activeStudents * rate;
  return { activeStudents, rate, monthlyAmount };
}

/* resolve a full school record (canonical identity) for billing display */
export function resolveSchool(schoolId) {
  return getSchoolById(schoolId) || (getSchoolRecord(schoolId) ? {
    id: schoolId, school_id: schoolId, ...getSchoolRecord(schoolId),
    plan: getSchoolRecord(schoolId).plan,
    billing_rate: getSchoolRecord(schoolId).plan === 'small' ? 0.07 : 0.10,
  } : null);
}

/* role / school isolation for the billing screen */
export function schoolsForRole(role, schoolId) {
  if (role === 'superadmin') return BILL_SCHOOLS;
  if (role === 'schooladmin' || role === 'accountant') {
    return BILL_SCHOOLS.filter((s) => s.id === (schoolId || 'school_001'));
  }
  return [];
}
export function canSeeSchoolBilling(role) {
  return role === 'superadmin' || role === 'schooladmin' || role === 'accountant';
}
