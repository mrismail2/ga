import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';

import DashboardScreen from '../screens/DashboardScreen';
import StudentsScreen from '../screens/StudentsScreen';
import ClassesScreen from '../screens/ClassesScreen';
import ClassDetailScreen from '../screens/ClassDetailScreen';
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
import { AttendanceRoute, ExamsRoute, FinanceRoute, IncidentsRoute, ReportsRoute } from '../screens/phase5/liveRoutes';
import TimetableScreen from '../screens/phase5/TimetableScreen';
import AssignmentsScreen from '../screens/phase5/AssignmentsScreen';
import ExamsResultsScreen from '../screens/phase5/ExamsResultsScreen';
import NotificationsScreen from '../screens/phase5/NotificationsScreen';
import ProvisioningScreen from '../screens/phase5/ProvisioningScreen';
const { normalizeSchoolRoute, resolveSchoolScreen, canAccessLiveRoute } = require('../domain/navigationPolicy');

/* route → screen component (same screens the mobile app uses) */
const SCREENS = {
  Dashboard: DashboardScreen,
  Schools: SchoolsScreen,
  Management: SchoolManagementScreen,
  SchoolOnboarding: SchoolOnboardingScreen,
  Simulator: SimulatorScreen,
  Ardayda: StudentsScreen,
  Fasallada: ClassesScreen,
  ClassDetail: ClassDetailScreen,
  Teachers: TeachersScreen,
  Attendance: AttendanceRoute,
  Finance: FinanceRoute,
  Billing: BillingScreen,
  Exams: ExamsRoute,
  Lessons: LessonsScreen,
  Incidents: IncidentsRoute,
  Notices: NoticesScreen,
  Reports: ReportsRoute,
  Permissions: PermissionsScreen,
  Messages: MessagesScreen,
  Advisor: AdvisorScreen,
  Settings: SettingsScreen,
  // ---- Phase 5 ----
  Jadwal: TimetableScreen,
  Assignments: AssignmentsScreen,
  Results: ExamsResultsScreen,
  Notifications: NotificationsScreen,
  Provisioning: ProvisioningScreen,
};

/* Desktop layout: fixed sidebar + a content pane that swaps screens.
   We give each screen a lightweight `navigation` + `route` shim so the
   exact same screen components work without React Navigation here. */
export default function DesktopShell() {
  const { c } = useTheme();
  const { role } = useRole();
  const { isLive } = useAuth();
  const [stack, setStack] = useState([{ route: 'Dashboard', params: {} }]);
  const current = stack[stack.length - 1];

  const navigate = useCallback((route, params = {}) => {
    // strip the *Stack aliases used by the mobile More menu
    const clean = normalizeSchoolRoute(route);
    if (SCREENS[clean] && (!isLive || canAccessLiveRoute(role, clean))) setStack((s) => [...s, { route: clean, params }]);
  }, [isLive, role]);

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  // sidebar click resets to that top-level view
  const selectView = useCallback((route) => {
    const clean = normalizeSchoolRoute(route);
    if (SCREENS[clean] && (!isLive || canAccessLiveRoute(role, clean))) setStack([{ route: clean, params: {} }]);
  }, [isLive, role]);

  const allowedCurrent = !isLive || canAccessLiveRoute(role, current.route);
  const Screen = allowedCurrent ? resolveSchoolScreen(current.route, SCREENS, DashboardScreen) : DashboardScreen;
  const navShim = { navigate, goBack, push: navigate };
  const routeShim = { params: current.params, name: current.route };

  return (
    <View style={[styles.shell, { backgroundColor: c.bg }]}>
      <Sidebar active={current.route} onNavigate={selectView} />
      <View style={styles.content}>
        <Screen navigation={navShim} route={routeShim} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, maxWidth: 1100, alignSelf: 'stretch' },
});
