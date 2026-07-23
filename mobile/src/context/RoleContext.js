/* Current-role provider. Switching role changes the dashboard, the visible
   tabs and the data scope. For the Teacher, the School-Admin-granted
   permissions (persisted in AsyncStorage) are merged into the profile and
   used to filter the teacher's navigation — so toggling a permission updates
   the teacher's UI immediately and survives an app restart. */
import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROLES } from '../data/roles';
import { setCurrentProfile } from '../data/access';
import { getTeacherPermissions, saveTeacherPermissions, DEFAULT_TEACHER_PERMISSIONS } from '../services/permissionStorage';

const KEY = 'kobciye_role';
export const TEACHER_ID = 'teacher';

/* nav item -> permission required for the Teacher to see it. Items not listed
   are always visible (dashboard, classes, lessons, settings). */
const NAV_PERMISSION = {
  attendance: 'attendance_view',
  exams: 'results_view',
  incidents: 'incidents_view',
  messages: 'messages_send',
  reports: 'class_reports_view',
};

function teacherNav(perms) {
  return ROLES.teacher.nav.filter((k) => {
    const need = NAV_PERMISSION[k];
    return !need || perms[need] === true;
  });
}

const RoleContext = createContext({
  role: 'schooladmin', profile: ROLES.schooladmin, setRole: () => {},
  teacherPerms: DEFAULT_TEACHER_PERMISSIONS, setTeacherPermission: () => {},
  setLiveIdentity: () => {},
});

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState('schooladmin');
  const [teacherPerms, setTeacherPerms] = useState(DEFAULT_TEACHER_PERMISSIONS);
  // Phase 3: in live (real Supabase) mode this holds the real user's identity
  // (name, real school_id, school label). null in demo/preview mode. When set,
  // it overrides the static preview identity so an authenticated user never
  // shows the Dugsiga Hidaayada demo name/school.
  const [liveIdentity, setLiveIdentityState] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && ROLES[v]) setRoleState(v); });
    getTeacherPermissions(TEACHER_ID).then(setTeacherPerms);
  }, []);

  const setRole = (r) => {
    if (!ROLES[r]) return;
    setRoleState(r);
    // only the demo/preview role is persisted; the live role is re-derived
    // from the DB profile on every launch, so it is not persisted here.
    AsyncStorage.setItem(KEY, r).catch(() => {});
  };

  // set (pass identity object) or clear (pass null) the live identity override
  const setLiveIdentity = useCallback((identity) => setLiveIdentityState(identity || null), []);

  // School Admin toggles one teacher permission — persist + update live state
  const setTeacherPermission = (permKey, enabled) => {
    setTeacherPerms((prev) => {
      const next = { ...prev, [permKey]: !!enabled };
      saveTeacherPermissions(TEACHER_ID, next).catch(() => {});
      return next;
    });
  };

  // the active profile; the Teacher gets merged permissions + filtered nav.
  // In live mode the real identity (name / school_id / school label) is merged
  // over the preview base so nav/labels stay intact but data scope is real.
  const profile = useMemo(() => {
    const base = ROLES[role];
    let p = base;
    if (role === 'teacher') {
      p = { ...base, permissions: teacherPerms, nav: teacherNav(teacherPerms) };
    }
    if (liveIdentity) {
      p = {
        ...p,
        live: true,
        name: liveIdentity.name || p.name,
        sub: liveIdentity.sub || p.sub,
        school_id: liveIdentity.school_id != null ? liveIdentity.school_id : p.school_id,
        profile_id: liveIdentity.profile_id || p.profile_id,
      };
    }
    return p;
  }, [role, teacherPerms, liveIdentity]);

  // register the active profile so non-React modules (access.js) can read it
  useEffect(() => { setCurrentProfile(profile); }, [profile]);

  return (
    <RoleContext.Provider value={{ role, profile, setRole, teacherPerms, setTeacherPermission, setLiveIdentity }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
