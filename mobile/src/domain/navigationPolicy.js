/* Pure navigation policy shared by the React UI and Node behavior tests. */
const MANAGEMENT_ITEM = Object.freeze({
  key: 'management',
  icon: 'building',
  label: 'Maamulka Dugsiga',
  route: 'Management',
});

const MANAGEMENT_ROLES = Object.freeze(['schooladmin']);
// Screen-level access is broader than the nav-menu item: a Super Admin never
// gets the "Maamulka Dugsiga" MENU entry (their nav is platform-scoped), but
// once they have PICKED a school they may open the very same management
// screens to run it. Kept separate from canAccessManagement so the nav menu
// stays school-admin-only while the screen itself admits a super_admin.
const SCHOOL_DATA_MANAGER_ROLES = Object.freeze(['schooladmin', 'superadmin']);

function canAccessManagement(roleKey) {
  return MANAGEMENT_ROLES.includes(roleKey);
}

// may this role operate a school's management screens at all (given they have
// resolved a real active school)? Super Admin included; used by the screens,
// never by the nav-menu builder.
function canManageSchoolData(roleKey) {
  return SCHOOL_DATA_MANAGER_ROLES.includes(roleKey);
}

function canRoleNavigate(roleKey, key) {
  return key !== MANAGEMENT_ITEM.key || canAccessManagement(roleKey);
}

function withManagementNavigation(roleKey, baseKeys) {
  const keys = Array.isArray(baseKeys) ? baseKeys.filter((key) => key !== MANAGEMENT_ITEM.key) : [];
  if (!canAccessManagement(roleKey)) return keys;
  const settingsIndex = keys.indexOf('settings');
  if (settingsIndex === -1) return [...keys, MANAGEMENT_ITEM.key];
  return [...keys.slice(0, settingsIndex), MANAGEMENT_ITEM.key, ...keys.slice(settingsIndex)];
}

function activateNavigationItem({ roleKey, key, navMeta, navigate }) {
  if (!canRoleNavigate(roleKey, key) || !navMeta || !navMeta[key] || typeof navigate !== 'function') return null;
  const route = navMeta[key][2];
  navigate(route);
  return route;
}

function normalizeSchoolRoute(route) {
  return typeof route === 'string' ? route.replace(/Stack$/, '') : '';
}

function resolveSchoolScreen(route, registry, fallback) {
  const key = normalizeSchoolRoute(route);
  return registry && registry[key] ? registry[key] : fallback;
}

module.exports = {
  MANAGEMENT_ITEM,
  MANAGEMENT_ROLES,
  SCHOOL_DATA_MANAGER_ROLES,
  canAccessManagement,
  canManageSchoolData,
  canRoleNavigate,
  withManagementNavigation,
  activateNavigationItem,
  normalizeSchoolRoute,
  resolveSchoolScreen,
};
