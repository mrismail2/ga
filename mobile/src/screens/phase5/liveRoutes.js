/* Kobciye Phase 5 — real Supabase routes only.
   Demo Mode is retired; these routes are reachable only from an authenticated
   Live session. Attendance remains role-split between marking and read-only. */
import React from 'react';
import { useAuth } from '../../context/AuthContext';
const { canMarkAttendance } = require('../../domain/phase5Access');

import AttendanceLiveScreen from './AttendanceLiveScreen';
import MyAttendanceScreen from './MyAttendanceScreen';
import ExamsResultsScreen from './ExamsResultsScreen';
import FinanceLiveScreen from './FinanceLiveScreen';
import DisciplineScreen from './DisciplineScreen';
import ReportsLiveScreen from './ReportsLiveScreen';

export function AttendanceRoute(props) {
  const { roleKey } = useAuth();
  return canMarkAttendance(roleKey)
    ? <AttendanceLiveScreen {...props} />
    : <MyAttendanceScreen {...props} />;
}
export function ExamsRoute(props) { return <ExamsResultsScreen {...props} />; }
export function FinanceRoute(props) { return <FinanceLiveScreen {...props} />; }
export function IncidentsRoute(props) { return <DisciplineScreen {...props} />; }
export function ReportsRoute(props) { return <ReportsLiveScreen {...props} />; }
