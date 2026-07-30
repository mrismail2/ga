/* ============================================================
   Kobciye — Phase 5 role-capability rules (pure, unit-tested)

   The single source of truth for "may this role see this Phase 5 control?".
   Kept pure and framework-free so it can be unit-tested directly (not only
   via a source scan) and reused by every Phase 5 view. RLS remains the real
   server-side authority; this is the UI gate that HIDES controls a role may
   not use, before render (§5).
   ============================================================ */
const ADMIN_ROLES = ['schooladmin', 'superadmin'];

/* who may CREATE in a module (default: admins only). */
function canCreateModule(roleKey, createRoles) {
  const allowed = Array.isArray(createRoles) && createRoles.length ? createRoles : ADMIN_ROLES;
  return allowed.includes(roleKey);
}

/* the row actions a role may see (each action may carry its own `roles`;
   default admins-only). Returns a NEW filtered array. */
function visibleRowActions(roleKey, actions) {
  if (!Array.isArray(actions)) return [];
  return actions.filter((a) => (Array.isArray(a.roles) && a.roles.length ? a.roles : ADMIN_ROLES).includes(roleKey));
}

/* may this role record a payment? (finance staff only) */
function canRecordPayment(roleKey) {
  return ['schooladmin', 'superadmin', 'accountant'].includes(roleKey);
}

/* may this role MARK attendance (vs. read-only view)? */
function canMarkAttendance(roleKey) {
  return ['schooladmin', 'superadmin', 'teacher'].includes(roleKey);
}

module.exports = { ADMIN_ROLES, canCreateModule, visibleRowActions, canRecordPayment, canMarkAttendance };
