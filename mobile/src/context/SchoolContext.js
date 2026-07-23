/* Schools owned/managed by the active admin. An admin can run several
   branches (e.g. Hidaaya Primary + Hidaaya Secondary), switch between
   them, and add new ones. Persisted via AsyncStorage. */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const DEFAULT = [
  { id: 'hidaayada', code: 'KOB-SCH-0042', name: 'Dugsiga Hidaayada', type: 'Primary School', city: 'Gabiley', students: 267, status: 'active' },
];

const SchoolContext = createContext({
  schools: DEFAULT, active: DEFAULT[0], setActive: () => {}, addSchool: () => {},
});
const KEY = 'kobciye_my_schools';

export function SchoolProvider({ children }) {
  const { isLive, profile, roleKey } = useAuth();
  const [schools, setSchools] = useState(DEFAULT);
  const [activeId, setActiveId] = useState(DEFAULT[0].id);

  useEffect(() => {
    // LIVE mode: the active school is the user's REAL school from their DB
    // profile — never the Dugsiga Hidaayada demo branch. A super_admin has no
    // single school (platform scope); a brand-new school_admin gets exactly
    // their own (empty) school. Demo AsyncStorage schools are not consulted.
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
        // super_admin (platform scope) or not-yet-assigned: no demo branch
        setSchools([]); setActiveId(null);
      }
      return;
    }
    // DEMO mode: the Phase 1/2 AsyncStorage prototype behaviour, unchanged.
    AsyncStorage.getItem(KEY).then((v) => {
      if (v) { try { const arr = JSON.parse(v); if (arr && arr.length) { setSchools(arr); setActiveId(arr[0].id); } } catch (e) {} }
    });
  }, [isLive, profile, roleKey]);

  const addSchool = useCallback((s) => {
    // demo-only helper; live school creation goes through the Edge Function
    setSchools((prev) => {
      const next = [...prev, s];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    setActiveId(s.id);
  }, []);

  const setActive = useCallback((id) => setActiveId(id), []);

  const active = schools.find((s) => s.id === activeId) || schools[0] || null;

  return (
    <SchoolContext.Provider value={{ schools, active, setActive, addSchool }}>
      {children}
    </SchoolContext.Provider>
  );
}

export const useSchools = () => useContext(SchoolContext);
