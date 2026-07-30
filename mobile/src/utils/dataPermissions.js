/* ============================================================
   Kobciye — Data permissions (the action/module gate for screens)

   Single permission surface. Screens import canViewModule / canPerformAction
   from here; the canonical rules live in data/access.js.
   ============================================================ */
export {
  canViewModule,
  canPerformAction,
  hasPermission,
  canAccessClassDetail,
  getClassDetailModeForProfile,
  getAllowedClassTabs,
  canViewPayment,
  canEditPayment,
  getTeacherAllowedClasses,
  getTeacherAllowedSubjects,
} from '../data/access';
