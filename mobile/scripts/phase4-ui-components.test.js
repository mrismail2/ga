#!/usr/bin/env node
/* Behavior tests that execute the shipped React component functions with a
 * tiny deterministic renderer. This verifies real click handlers and route
 * wiring without needing a browser, emulator, or source-string assertions. */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-phase4-ui-components'));
let failures = 0;
const ok = (name, condition) => {
  console.log(condition ? 'PASS' : 'FAIL', name);
  if (!condition) failures += 1;
};

let stateSlots = [];
let stateIndex = 0;
let windowWidth = 400;
let currentProfile = null;
let currentAuth = null;

function resetHooks() { stateSlots = []; stateIndex = 0; }
function beginRender() { stateIndex = 0; }
function useState(initial) {
  const index = stateIndex++;
  if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? initial() : initial;
  const setValue = (next) => { stateSlots[index] = typeof next === 'function' ? next(stateSlots[index]) : next; };
  return [stateSlots[index], setValue];
}
function createElement(type, props, ...children) {
  const child = children.length === 0 ? undefined : (children.length === 1 ? children[0] : children);
  return { type, props: { ...(props || {}), ...(children.length ? { children: child } : {}) } };
}

const ReactMock = {
  createElement,
  useState,
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useRef: (value) => ({ current: value }),
};
const palette = new Proxy({}, { get: (_target, key) => String(key) });
const primitive = (name) => name;
const ReactNativeMock = {
  View: primitive('View'), Text: primitive('Text'), ScrollView: primitive('ScrollView'),
  TouchableOpacity: primitive('TouchableOpacity'), Pressable: primitive('Pressable'),
  Modal: primitive('Modal'), TextInput: primitive('TextInput'), Switch: primitive('Switch'),
  ActivityIndicator: primitive('ActivityIndicator'),
  StyleSheet: { create: (styles) => styles },
  useWindowDimensions: () => ({ width: windowWidth, height: 800 }),
};

function component(name) {
  const value = function MockComponent() {};
  Object.defineProperty(value, 'name', { value: name });
  return value;
}

const Card = component('Card');
const ScreenHeader = component('ScreenHeader');
const Avatar = component('Avatar');
const Badge = component('Badge');
const RoleSwitcher = component('RoleSwitcher');
const Icon = component('Icon');
const Logo = component('Logo');
const SectionTitle = component('SectionTitle');
const DesktopSidebarHost = component('DesktopSidebarHost');
const DesktopShellHost = component('DesktopShellHost');
const SchoolManagementScreen = component('SchoolManagementScreen');
const GenericScreen = component('GenericScreen');

const Stack = { Navigator: primitive('StackNavigator'), Screen: primitive('StackScreen') };
const Tabs = { Navigator: primitive('TabNavigator'), Screen: primitive('TabScreen') };
const emptyStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };

const originalLoad = Module._load;
Module._load = function loadUiDependency(request, parent, isMain) {
  if (request === 'react') return ReactMock;
  if (request === 'react-native') return ReactNativeMock;
  if (request === 'react-native-safe-area-context') return { SafeAreaView: primitive('SafeAreaView') };
  if (request === '@react-native-async-storage/async-storage') return { ...emptyStorage, default: emptyStorage };
  if (request === '@react-navigation/native-stack') return { createNativeStackNavigator: () => Stack };
  if (request === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => Tabs };
  if (request === '../theme/ThemeContext') return { useTheme: () => ({ c: palette }) };
  if (request === '../context/RoleContext') return { useRole: () => ({ profile: currentProfile, role: currentProfile.key }) };
  if (request === '../context/AuthContext') return { useAuth: () => currentAuth };
  if (request === '../hooks/useStageTerminology') {
    return { __esModule: true, default: () => ({ classLabelPlural: 'Fasallada' }) };
  }
  if (request === '../components/Card') return Card;
  if (request === '../components/ScreenHeader') return ScreenHeader;
  if (request === '../components/Avatar') return Avatar;
  if (request === '../components/Badge') return Badge;
  if (request === '../components/RoleSwitcher') return RoleSwitcher;
  if (request === '../components/Icon' || request === './Icon') return Icon;
  if (request === '../components/SectionTitle') return SectionTitle;
  if (request === './Avatar') return Avatar;
  if (request === './Logo') return Logo;
  if (request === './Sidebar') return DesktopSidebarHost;
  if (request === '../components/DesktopShell') return DesktopShellHost;
  if (request === '../services/settings') {
    return {
      getLiveSchoolPreferences: async () => ({}), updateLivePersonalProfile: async () => ({}),
      updateLiveSchoolProfile: async () => ({}), updateLiveStudentIdPrefix: async () => ({}),
      updateLiveAccountPassword: async () => ({}),
    };
  }
  if (/^\.\.\/screens\//.test(request)) {
    return request === '../screens/SchoolManagementScreen' ? SchoolManagementScreen : GenericScreen;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let MoreScreen;
let Sidebar;
let DesktopShell;
let RootNavigator;
let SettingsScreen;
let settingsService;
try {
  MoreScreen = require(path.join(compiledSrc, 'screens', 'MoreScreen.js')).default;
  Sidebar = require(path.join(compiledSrc, 'components', 'Sidebar.js')).default;
  DesktopShell = require(path.join(compiledSrc, 'components', 'DesktopShell.js')).default;
  RootNavigator = require(path.join(compiledSrc, 'navigation', 'RootNavigator.js')).default;
  SettingsScreen = require(path.join(compiledSrc, 'screens', 'SettingsScreen.js')).default;
} finally {
  Module._load = originalLoad;
}

Module._load = function loadSettingsDependency(request, parent, isMain) {
  if (request === './supabase') {
    return {
      supabase: {},
      getMyProfile: async () => { throw new Error('protected Settings fields must be rejected before profile loading'); },
      updateMyProfile: async () => { throw new Error('protected Settings fields must never reach a profile update'); },
      updatePassword: async () => {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
try {
  settingsService = require(path.join(compiledSrc, 'services', 'settings.js'));
} finally {
  Module._load = originalLoad;
}

function nodes(value, output = []) {
  if (value === null || value === undefined || typeof value === 'boolean') return output;
  if (Array.isArray(value)) { value.forEach((entry) => nodes(entry, output)); return output; }
  if (typeof value !== 'object') return output;
  if (value.type) output.push(value);
  if (value.props && Object.prototype.hasOwnProperty.call(value.props, 'children')) nodes(value.props.children, output);
  return output;
}
function textOf(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.props ? textOf(value.props.children) : '';
}
function pressableWithLabel(tree, label) {
  return nodes(tree).find((node) => node.type === 'TouchableOpacity' && textOf(node).includes(label));
}

const schoolAdmin = {
  key: 'schooladmin', name: 'Admin', labelSo: 'Maamulaha Dugsiga', sub: 'Dugsi',
  nav: ['dashboard', 'management', 'settings'],
};
const teacher = { key: 'teacher', name: 'Macalin', labelSo: 'Macalin', sub: 'Dugsi', nav: ['dashboard', 'settings'] };
currentAuth = { isLive: true, demoActive: false, roleKey: 'schooladmin', profile: { full_name: 'Admin' }, signOut: () => {}, refreshProfile: async () => {} };

currentProfile = schoolAdmin;
resetHooks();
let mobileRoute = null;
let tree = MoreScreen({ navigation: { navigate: (route) => { mobileRoute = route; } } });
let managementItem = pressableWithLabel(tree, 'Maamulka Dugsiga');
ok('actual MoreScreen renders Maamulka Dugsiga for School Admin', !!managementItem);
if (managementItem) managementItem.props.onPress();
ok('actual MoreScreen click navigates to Management', mobileRoute === 'Management');

currentProfile = teacher;
tree = MoreScreen({ navigation: { navigate: () => {} } });
ok('actual MoreScreen hides management from an unauthorized role', !pressableWithLabel(tree, 'Maamulka Dugsiga'));

currentProfile = schoolAdmin;
resetHooks();
beginRender();
let desktopTree = DesktopShell();
let sidebarHost = nodes(desktopTree).find((node) => node.type === DesktopSidebarHost);
ok('actual DesktopShell renders its Sidebar with a navigation callback', !!sidebarHost && typeof sidebarHost.props.onNavigate === 'function');
tree = Sidebar({ active: 'Dashboard', onNavigate: sidebarHost && sidebarHost.props.onNavigate });
managementItem = pressableWithLabel(tree, 'Maamulka Dugsiga');
ok('actual Sidebar renders Maamulka Dugsiga for School Admin', !!managementItem);
if (managementItem) managementItem.props.onPress();
beginRender();
desktopTree = DesktopShell();
ok('actual Sidebar click makes DesktopShell render SchoolManagementScreen', nodes(desktopTree).some((node) => node.type === SchoolManagementScreen));

resetHooks();
windowWidth = 400;
tree = RootNavigator();
const managementRoute = nodes(tree).find((node) => node.type === 'StackScreen' && node.props.name === 'Management');
ok('actual RootNavigator maps Management to SchoolManagementScreen', !!managementRoute && managementRoute.props.component === SchoolManagementScreen);

resetHooks();
currentProfile = schoolAdmin;
let settingsNavigation = null;
tree = SettingsScreen({ navigation: { navigate: (route, params) => { settingsNavigation = { route, params }; }, goBack: () => {} } });
const schoolGroup = nodes(tree).find((node) => node.props && node.props.title === 'Dugsiga' && Array.isArray(node.props.items));
const academicItem = schoolGroup && schoolGroup.props.items.find((item) => item.label === 'Academic Years & Terms');
ok('actual SettingsScreen exposes the live Academic Years & Terms destination', !!academicItem);
if (academicItem) academicItem.action();
ok('actual Settings click opens the Phase 4 Management modules', !!settingsNavigation
  && settingsNavigation.route === 'Management'
  && settingsNavigation.params.moduleKey === 'academic_years'
  && settingsNavigation.params.moduleKeys.join(',') === 'academic_years,terms'
  && settingsNavigation.params.source === 'settings');

async function rejectsProtectedField(call) {
  try {
    await call();
    return false;
  } catch (error) {
    return error && error.code === 'settings_protected_field';
  }
}

async function finish() {
  for (const field of ['institution_type', 'school_stage', 'school_id', 'role']) {
    const personalRejected = await rejectsProtectedField(() => settingsService.updateLivePersonalProfile({
      full_name: 'Admin Updated', [field]: 'tampered',
    }));
    ok(`personal Settings service rejects protected ${field}`, personalRejected);

    const schoolRejected = await rejectsProtectedField(() => settingsService.updateLiveSchoolProfile({
      name: 'Kobciye School', [field]: 'tampered',
    }));
    ok(`school Settings service rejects protected ${field}`, schoolRejected);
  }

  if (failures) {
    console.error(`phase4 UI component behavior FAILED with ${failures} issue(s)`);
    process.exit(1);
  }
  console.log('phase4 UI component behavior PASSED');
}

finish().catch((error) => {
  console.error('phase4 UI component behavior FAILED unexpectedly', error && error.message ? error.message : error);
  process.exit(1);
});
