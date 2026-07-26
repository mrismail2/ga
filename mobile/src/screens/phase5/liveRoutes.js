/* ============================================================
   Kobciye — Phase 5 mode-aware route components

   The shared routes (Attendance, Exams, Finance, Incidents, Reports) render
   the REAL Supabase-backed Phase 5 screen in Live Mode and keep the existing
   Phase 1/2 demo screen in demo/preview mode. This is how Phase 5 is
   "revealed" without disturbing the approved demo UI or the route names the
   navigators already use.
   ============================================================ */
import React from 'react';
import { useAuth } from '../../context/AuthContext';

import AttendanceDemo from '../AttendanceScreen';
import ExamsDemo from '../ExamsScreen';
import FinanceDemo from '../FinanceScreen';
import IncidentsDemo from '../IncidentsScreen';
import ReportsDemo from '../ReportsScreen';

import AttendanceLiveScreen from './AttendanceLiveScreen';
import ExamsResultsScreen from './ExamsResultsScreen';
import FinanceLiveScreen from './FinanceLiveScreen';
import DisciplineScreen from './DisciplineScreen';
import ReportsLiveScreen from './ReportsLiveScreen';

function modeAware(LiveComp, DemoComp) {
  return function ModeAwareRoute(props) {
    const { isLive } = useAuth();
    const C = isLive ? LiveComp : DemoComp;
    return <C {...props} />;
  };
}

export const AttendanceRoute = modeAware(AttendanceLiveScreen, AttendanceDemo);
export const ExamsRoute = modeAware(ExamsResultsScreen, ExamsDemo);
export const FinanceRoute = modeAware(FinanceLiveScreen, FinanceDemo);
export const IncidentsRoute = modeAware(DisciplineScreen, IncidentsDemo);
export const ReportsRoute = modeAware(ReportsLiveScreen, ReportsDemo);
