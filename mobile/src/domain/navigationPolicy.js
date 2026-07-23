/* Pure navigation policy shared by the React UI and Node behavior tests. */
const MANAGEMENT_ITEM = Object.freeze({
  key: 'management',
  icon: 'building',
  label: 'Maamulka Dugsiga',
  route: 'Management',
});

const MANAGEMENT_ROLES = Object.freeze(['schooladmin']);

function canAccessManagement(roleKey) {
  return MANAGEMENT_ROLES.includes(roleKey);
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
  canAccessManagement,
  canRoleNavigate,
  withManagementNavigation,
  activateNavigationItem,
  normalizeSchoolRoute,
  resolveSchoolScreen,
};
