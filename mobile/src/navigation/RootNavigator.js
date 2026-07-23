import React from 'react';
import { useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* tab catalog: route → [iconName, label, component] */
const TAB_DEFS = {
  Dashboard: ['dashboard', 'Dashboard', DashboardScreen],
  Ardayda: ['students', 'Ardayda', StudentsScreen],
  Fasallada: ['classes', 'Fasallada', ClassesScreen],
  Attendance: ['attendance', 'Xaadiris', AttendanceScreen],
  Finance: ['finance', 'Lacag', FinanceScreen],
  Messages: ['messages', 'Fariimo', MessagesScreen],
  Dheeraad: ['more', 'Dheeraad', MoreScreen],
};

/* which middle tabs each role gets (Dashboard + … + Dheeraad always added) */
const ROLE_TABS = {
  superadmin: ['Ardayda', 'Fasallada', 'Messages'],
  schooladmin: ['Ardayda', 'Fasallada', 'Messages'],
  teacher: ['Fasallada', 'Attendance', 'Messages'],
  accountant: ['Finance'],
  parent: ['Attendance', 'Finance'], // a parent has no direct teacher–student chat
  student: ['Attendance', 'Messages'],
};

function Tabs() {
  const { c } = useTheme();
  const { role } = useRole();
  // stage-aware wording: the classes tab is "Fasallada" for a Primary/Middle
  // school and "Formamka" for a Secondary school (config/schoolStages.js).
  const stageTerms = useStageTerminology();
  const middle = ROLE_TABS[role] || ROLE_TABS.schooladmin;
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

/* secondary screens reached from "Dheeraad" (never bottom tabs) */
const STACK_SCREENS = {
  ClassDetail: ClassDetailScreen,
  Management: SchoolManagementScreen,
  Teachers: TeachersScreen,
  Billing: BillingScreen,
  Exams: ExamsScreen,
  Lessons: LessonsScreen,
  Incidents: IncidentsScreen,
  Notices: NoticesScreen,
  Schools: SchoolsScreen,
  SchoolOnboarding: SchoolOnboardingScreen,
  Simulator: SimulatorScreen,
  Reports: ReportsScreen,
  Permissions: PermissionsScreen,
  Advisor: AdvisorScreen,
  Settings: SettingsScreen,
  // also reachable from More for roles where they aren't tabs:
  ArdaydaStack: StudentsScreen,
  FasalladaStack: ClassesScreen,
  AttendanceStack: AttendanceScreen,
  FinanceStack: FinanceScreen,
  MessagesStack: MessagesScreen,
};

export default function RootNavigator() {
  const { role } = useRole();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Desktop / wide screens (computer): sidebar layout like the web app.
  if (isDesktop) return <DesktopShell key={role} />;

  // Phones / narrow screens: bottom-tab navigation.
  return (
    <Stack.Navigator
      // remount tabs when role changes so the tab set updates
      key={role}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Tabs" component={Tabs} />
      {Object.entries(STACK_SCREENS).map(([name, Comp]) => (
        <Stack.Screen key={name} name={name} component={Comp} />
      ))}
    </Stack.Navigator>
  );
}
