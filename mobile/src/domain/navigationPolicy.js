/* Pure navigation policy shared by the React UI and Node behavior tests. */
const MANAGEMENT_ITEM = Object.freeze({
  key: 'management',
  icon: 'building',
  label: 'Maamulka Dugsiga',
  route: 'Management',
});

const MANAGEMENT_ROLES = Object.freeze(['schooladmin']);
const SCHOOL_DATA_MANAGER_ROLES = Object.freeze(['schooladmin', 'superadmin']);

/* LIVE navigation boundary.
   Phase 1–4 keys plus the Phase 5 modules that are now fully implemented and
   Supabase-backed (§15: a menu item is revealed only after its workflow is
   real). Demo mode keeps the original prototype navigation unchanged, so
   anything omitted here is simply not offered to an authenticated Live user.
   Role scope mirrors RLS: teachers get their assignment-scoped modules,
   student/parent get their read-scoped modules, accountant gets finance. */
const PHASE5_COMMON = ['jadwal', 'attendance', 'assignments', 'exams', 'results', 'notifications'];
const LIVE_NAV_KEYS = Object.freeze({
  superadmin: Object.freeze(['dashboard', 'schoolonboarding', 'students', 'teachers', 'classes', 'lessons', 'messages', 'management', 'provisioning', ...PHASE5_COMMON, 'finance', 'incidents', 'reports', 'settings']),
  schooladmin: Object.freeze(['dashboard', 'students', 'teachers', 'classes', 'lessons', 'management', 'provisioning', 'messages', ...PHASE5_COMMON, 'finance', 'incidents', 'reports', 'settings']),
  teacher: Object.freeze(['dashboard', 'classes', 'lessons', 'messages', 'jadwal', 'attendance', 'assignments', 'exams', 'results', 'incidents', 'reports', 'notifications', 'settings']),
  accountant: Object.freeze(['dashboard', 'finance', 'reports', 'notifications', 'settings']),
  parent: Object.freeze(['dashboard', 'jadwal', 'attendance', 'assignments', 'exams', 'results', 'finance', 'incidents', 'notifications', 'settings']),
  student: Object.freeze(['dashboard', 'messages', 'jadwal', 'attendance', 'assignments', 'exams', 'results', 'finance', 'notifications', 'settings']),
});

const LIVE_ROUTE_KEYS = Object.freeze({
  Dashboard: 'dashboard',
  SchoolOnboarding: 'schoolonboarding',
  Schools: 'schoolonboarding',
  Management: 'management',
  Ardayda: 'students',
  ArdaydaStack: 'students',
  Fasallada: 'classes',
  FasalladaStack: 'classes',
  ClassDetail: 'classes',
  Teachers: 'teachers',
  Lessons: 'lessons',
  Messages: 'messages',
  MessagesStack: 'messages',
  Settings: 'settings',
  // ---- Phase 5 ----
  Jadwal: 'jadwal',
  Attendance: 'attendance',
  AttendanceStack: 'attendance',
  Assignments: 'assignments',
  Exams: 'exams',
  Results: 'results',
  Finance: 'finance',
  FinanceStack: 'finance',
  Incidents: 'incidents',
  Reports: 'reports',
  Notifications: 'notifications',
  Provisioning: 'provisioning',
  Transcripts: 'transcripts',
});

function canAccessManagement(roleKey) {
  return MANAGEMENT_ROLES.includes(roleKey);
}

function canManageSchoolData(roleKey) {
  return SCHOOL_DATA_MANAGER_ROLES.includes(roleKey);
}

function liveNavKeys(roleKey, baseKeys) {
  const allowed = new Set(LIVE_NAV_KEYS[roleKey] || ['dashboard', 'settings']);
  return (Array.isArray(baseKeys) ? baseKeys : []).filter((key) => allowed.has(key));
}

function canRoleNavigate(roleKey, key, isLive = false) {
  if (key === MANAGEMENT_ITEM.key && !canAccessManagement(roleKey)) return false;
  if (!isLive) return true;
  return (LIVE_NAV_KEYS[roleKey] || []).includes(key);
}

function canAccessLiveRoute(roleKey, route) {
  const normalized = normalizeSchoolRoute(route);
  const key = LIVE_ROUTE_KEYS[route] || LIVE_ROUTE_KEYS[normalized];
  if (!key) return false;
  if (key === MANAGEMENT_ITEM.key) return canManageSchoolData(roleKey);
  return canRoleNavigate(roleKey, key, true);
}

function withManagementNavigation(roleKey, baseKeys) {
  const keys = Array.isArray(baseKeys) ? baseKeys.filter((key) => key !== MANAGEMENT_ITEM.key) : [];
  if (!canAccessManagement(roleKey)) return keys;
  const settingsIndex = keys.indexOf('settings');
  if (settingsIndex === -1) return [...keys, MANAGEMENT_ITEM.key];
  return [...keys.slice(0, settingsIndex), MANAGEMENT_ITEM.key, ...keys.slice(settingsIndex)];
}

function activateNavigationItem({ roleKey, key, navMeta, navigate, isLive = false }) {
  if (!canRoleNavigate(roleKey, key, isLive) || !navMeta || !navMeta[key] || typeof navigate !== 'function') return null;
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
  LIVE_NAV_KEYS,
  LIVE_ROUTE_KEYS,
  canAccessManagement,
  canManageSchoolData,
  liveNavKeys,
  canRoleNavigate,
  canAccessLiveRoute,
  withManagementNavigation,
  activateNavigationItem,
  normalizeSchoolRoute,
  resolveSchoolScreen,
};
