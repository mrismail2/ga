/* ============================================================
   Kobciye — active school context

   The single source of truth for "which real school am I acting on?" —
   the value every school-specific screen scopes its Supabase queries with.

   LIVE mode:
     • School Admin (and any non-super role that owns a school): the active
       school is their OWN school, straight from the DB profile. There is no
       selector and no way to widen it — tenant isolation is preserved.
     • Super Admin (platform scope, no single school): loads the REAL list of
       schools from Supabase (services/supabase.listSchools, RLS-approved) and
       lets them pick ONE via "Dooro Dugsi". The picked school's uuid becomes
       activeSchoolId. Until one is picked, activeSchoolId is null and NO
       school-specific query runs — screens show the "Dooro dugsiga…" prompt.
       The selection is persisted so it survives a refresh.

   In every case activeSchoolId is either a real uuid or null — never "*",
   "all", "" or a demo id. That is the invariant that prevents the
   `invalid input syntax for type uuid: "*"` crash.

   DEMO mode: the Phase 1/2 AsyncStorage prototype behaviour, unchanged.
   ============================================================ */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { listSchools } from '../services/supabase';
import { isUuid } from '../utils/uuid';

const DEFAULT = [
  { id: 'hidaayada', code: 'KOB-SCH-0042', name: 'Dugsiga Hidaayada', type: 'Primary School', city: 'Gabiley', students: 267, status: 'active' },
];

const SchoolContext = createContext({
  schools: DEFAULT, active: DEFAULT[0], activeSchoolId: null,
  isSuperAdmin: false, needsSchoolSelection: false,
  schoolsLoading: false, schoolsError: null,
  setActive: () => {}, setActiveSchool: () => {}, reloadSchools: () => {}, addSchool: () => {},
});
const KEY = 'kobciye_my_schools';
const SUPER_SEL_KEY = 'kobciye_superadmin_active_school';

export function SchoolProvider({ children }) {
  const { isLive, profile, roleKey } = useAuth();
  const isSuperAdmin = isLive && roleKey === 'superadmin';

  const [schools, setSchools] = useState(DEFAULT);
  const [activeId, setActiveId] = useState(DEFAULT[0].id);
  // Super Admin only: the real schools list + which one is selected
  const [superSchools, setSuperSchools] = useState([]);
  const [superActiveId, setSuperActiveId] = useState(null);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState(null);

  // ---- Super Admin: load the real school list from Supabase ----
  const reloadSchools = useCallback(async () => {
    if (!isSuperAdmin) return;
    setSchoolsLoading(true); setSchoolsError(null);
    try {
      const rows = await listSchools();
      const list = (rows || []).map((s) => ({
        id: s.id, code: s.slug, name: s.name,
        type: s.plan === 'large' ? 'Large School' : 'School',
        city: s.location || '', students: null, status: s.status || 'active', live: true,
      }));
      setSuperSchools(list);
    } catch (e) {
      setSchoolsError((e && e.message) || 'Lama soo dejin karin liiska dugsiyada.');
    } finally {
      setSchoolsLoading(false);
    }
  }, [isSuperAdmin]);

  // restore a persisted Super Admin selection once, then load the list
  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    let alive = true;
    AsyncStorage.getItem(SUPER_SEL_KEY).then((v) => {
      if (alive && isUuid(v)) setSuperActiveId(v);
    }).catch(() => {});
    reloadSchools();
    return () => { alive = false; };
  }, [isSuperAdmin, reloadSchools]);

  // ---- School Admin / demo: resolve the single active school ----
  useEffect(() => {
    if (isSuperAdmin) return; // handled above
    if (isLive) {
      if (profile && profile.school) {
        const s = profile.school;
        const one = {
          id: s.id, code: s.slug, name: s.name,
          type: s.plan === 'large' ? 'Large School' : 'School',
          city: s.location || '', students: null, status: s.status || 'active', live: true,
        };
        setSchools([one]); setActiveId(s.id);
      } else {
        // not-yet-assigned live user: no demo branch
        setSchools([]); setActiveId(null);
      }
      return;
    }
    // DEMO mode: the Phase 1/2 AsyncStorage prototype behaviour, unchanged.
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) { try { const arr = JSON.parse(v); if (arr && arr.length) { setSchools(arr); setActiveId(arr[0].id); } } catch (e) {} }
    });
  }, [isSuperAdmin, isLive, profile, roleKey]);

  const addSchool = useCallback((s) => {
    // demo-only helper; live school creation goes through the Edge Function
    setSchools((prev) => {
      const next = [...prev, s];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setActiveId(s.id);
  }, []);

  // Super Admin picks / switches the school they manage (a real uuid only).
  const setActiveSchool = useCallback((id) => {
    if (!isUuid(id)) {
      setSuperActiveId(null);
      AsyncStorage.removeItem(SUPER_SEL_KEY).catch(() => {});
      return;
    }
    setSuperActiveId(id);
    AsyncStorage.setItem(SUPER_SEL_KEY, id).catch(() => {});
  }, []);

  // demo/school-admin "active branch" switch (unchanged for those roles)
  const setActive = useCallback((id) => {
    if (isSuperAdmin) { setActiveSchool(id); return; }
    setActiveId(id);
  }, [isSuperAdmin, setActiveSchool]);

  const value = useMemo(() => {
    if (isSuperAdmin) {
      // only a selection that is a real, currently-visible school counts
      const validSel = isUuid(superActiveId) && superSchools.some((s) => s.id === superActiveId)
        ? superActiveId : null;
      const active = validSel ? superSchools.find((s) => s.id === validSel) : null;
      return {
        schools: superSchools,
        active,
        activeSchoolId: validSel,
        isSuperAdmin: true,
        needsSchoolSelection: !validSel,
        schoolsLoading, schoolsError,
        setActive: setActiveSchool, setActiveSchool, reloadSchools, addSchool,
      };
    }
    const active = schools.find((s) => s.id === activeId) || schools[0] || null;
    // school-admin/demo: activeSchoolId is a real uuid only in LIVE mode
    const activeSchoolId = isLive && active && isUuid(active.id) ? active.id : null;
    return {
      schools, active, activeSchoolId,
      isSuperAdmin: false,
      needsSchoolSelection: false,
      schoolsLoading: false, schoolsError: null,
      setActive, setActiveSchool, reloadSchools, addSchool,
    };
  }, [isSuperAdmin, superSchools, superActiveId, schoolsLoading, schoolsError,
      schools, activeId, isLive, setActive, setActiveSchool, reloadSchools, addSchool]);

  return (
    <SchoolContext.Provider value={value}>
      {children}
    </SchoolContext.Provider>
  );
}

export const useSchools = () => useContext(SchoolContext);
