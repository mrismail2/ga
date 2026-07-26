import React from 'react';
import { useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import useStageTerminology from '../hooks/useStageTerminology';
import Icon from '../components/Icon';
import DesktopShell from '../components/DesktopShell';

import DashboardScreen from '../screens/DashboardScreen';
import StudentsScreen from '../screens/StudentsScreen';
import ClassesScreen from '../screens/ClassesScreen';
import ClassDetailScreen from '../screens/ClassDetailScreen';
import MoreScreen from '../screens/MoreScreen';
import TeachersScreen from '../screens/TeachersScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import FinanceScreen from '../screens/FinanceScreen';
import BillingScreen from '../screens/BillingScreen';
import ExamsScreen from '../screens/ExamsScreen';
import LessonsScreen from '../screens/LessonsScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AdvisorScreen from '../screens/AdvisorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import NoticesScreen from '../screens/NoticesScreen';
import SchoolsScreen from '../screens/SchoolsScreen';
import SchoolManagementScreen from '../screens/SchoolManagementScreen';
import SchoolOnboardingScreen from '../screens/SchoolOnboardingScreen';
import SimulatorScreen from '../screens/SimulatorScreen';
// ---- Phase 5 screens (real, Supabase-backed) ----
import { AttendanceRoute, ExamsRoute, FinanceRoute, IncidentsRoute, ReportsRoute } from '../screens/phase5/liveRoutes';
import TimetableScreen from '../screens/phase5/TimetableScreen';
import AssignmentsScreen from '../screens/phase5/AssignmentsScreen';
import ExamsResultsScreen from '../screens/phase5/ExamsResultsScreen';
import NotificationsScreen from '../screens/phase5/NotificationsScreen';
import ProvisioningScreen from '../screens/phase5/ProvisioningScreen';
const { canAccessLiveRoute } = require('../domain/navigationPolicy');

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_DEFS = {
  Dashboard: ['dashboard', 'Dashboard', DashboardScreen],
  Ardayda: ['students', 'Ardayda', StudentsScreen],
  Fasallada: ['classes', 'Fasallada', ClassesScreen],
  Attendance: ['attendance', 'Xaadiris', AttendanceRoute],
  Finance: ['finance', 'Lacag', FinanceRoute],
  Messages: ['messages', 'Fariimo', MessagesScreen],
  Dheeraad: ['more', 'Dheeraad', MoreScreen],
};

const ROLE_TABS_DEMO = {
  superadmin: ['Ardayda', 'Fasallada', 'Messages'],
  schooladmin: ['Ardayda', 'Fasallada', 'Messages'],
  teacher: ['Fasallada', 'Attendance', 'Messages'],
  accountant: ['Finance'],
  parent: ['Attendance', 'Finance'],
  student: ['Attendance', 'Messages'],
};

/* Live Phase 1–4 tabs only. Phase 5 tabs remain registered for the explicit
   demo prototype, but are not mounted or navigable for a real account. */
const ROLE_TABS_LIVE = {
  superadmin: ['Ardayda', 'Fasallada', 'Messages'],
  schooladmin: ['Ardayda', 'Fasallada', 'Attendance'],
  teacher: ['Fasallada', 'Attendance', 'Messages'],
  accountant: ['Finance'],
  parent: ['Attendance', 'Finance'],
  student: ['Attendance', 'Messages'],
};

function Tabs() {
  const { c } = useTheme();
  const { role } = useRole();
  const { isLive } = useAuth();
  const stageTerms = useStageTerminology();
  const catalog = isLive ? ROLE_TABS_LIVE : ROLE_TABS_DEMO;
  const middle = catalog[role] || catalog.schooladmin || [];
  const routes = ['Dashboard', ...middle, 'Dheeraad'];
  const labelFor = (r) => (r === 'Fasallada' ? stageTerms.classLabelPlural : TAB_DEFS[r][1]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.navy,
        tabBarInactiveTintColor: c.muted2,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color }) => <Icon name={TAB_DEFS[route.name][0]} size={22} color={color} />,
      })}
    >
      {routes.map((r) => (
        <Tab.Screen key={r} name={r} component={TAB_DEFS[r][2]} options={{ tabBarLabel: labelFor(r) }} />
      ))}
    </Tab.Navigator>
  );
}

const STACK_SCREENS = {
  ClassDetail: ClassDetailScreen,
  Management: SchoolManagementScreen,
  Teachers: TeachersScreen,
  Billing: BillingScreen,
  Exams: ExamsRoute,
  Lessons: LessonsScreen,
  Incidents: IncidentsRoute,
  Notices: NoticesScreen,
  Schools: SchoolsScreen,
  SchoolOnboarding: SchoolOnboardingScreen,
  Simulator: SimulatorScreen,
  Reports: ReportsRoute,
  Permissions: PermissionsScreen,
  Advisor: AdvisorScreen,
  Settings: SettingsScreen,
  // ---- Phase 5 routes ----
  Jadwal: TimetableScreen,
  Assignments: AssignmentsScreen,
  Results: ExamsResultsScreen,
  Notifications: NotificationsScreen,
  Provisioning: ProvisioningScreen,
  ArdaydaStack: StudentsScreen,
  FasalladaStack: ClassesScreen,
  AttendanceStack: AttendanceRoute,
  FinanceStack: FinanceRoute,
  MessagesStack: MessagesScreen,
};

export default function RootNavigator() {
  const { role } = useRole();
  const { isLive } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  if (isDesktop) return <DesktopShell key={`${role}:${isLive ? 'live' : 'demo'}`} />;

  const stackEntries = Object.entries(STACK_SCREENS).filter(([name]) => !isLive || canAccessLiveRoute(role, name));
  return (
    <Stack.Navigator key={`${role}:${isLive ? 'live' : 'demo'}`} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      {stackEntries.map(([name, Comp]) => (
        <Stack.Screen key={name} name={name} component={Comp} />
      ))}
    </Stack.Navigator>
  );
}
