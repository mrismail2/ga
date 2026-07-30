/* ============================================================
   Kobciye — Dashboard VIEW MODE (Primary / Secondary / University)

   A client-side view switcher the School Admin uses on the dashboard to move
   between the three institution UIs. It drives which dashboard body + wording
   is shown and enforces isolation: each mode only ever shows its OWN terms
   (School Mode = Fasallada/Formamka; University Mode = Kulliyado/Koorsooyin),
   mirroring SCHOOL_ONLY_TERMS / UNIVERSITY_ONLY_TERMS in
   config/navigationByInstitutionType.js.

   This is a UI-only concept — it is demo-persisted (AsyncStorage) and
   live-safe (in-memory in LIVE mode) so NO Supabase schema/logic is touched.
   ============================================================ */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

/* kind: 'school' → shares the school wording set (Fasal/Form);
   'university' → the university wording set (Kulliyad/Koorso). */
export const VIEW_MODES = [
  { key: 'primary', label: 'Primary', icon: 'classes', kind: 'school', heroType: 'Primary School', classLabelPlural: 'Fasallada' },
  { key: 'secondary', label: 'Secondary', icon: 'exams', kind: 'school', heroType: 'Secondary School', classLabelPlural: 'Formamka' },
  { key: 'university', label: 'University', icon: 'building', kind: 'university', heroType: 'University', classLabelPlural: 'Koorsooyinka' },
];

export const findMode = (k) => VIEW_MODES.find((m) => m.key === k) || VIEW_MODES[0];

const ViewModeContext = createContext({
  mode: 'primary', meta: VIEW_MODES[0], enabled: ['primary'], available: [], names: {},
  nameFor: () => '', setMode: () => {}, addMode: () => {},
});
const KEY = 'kobciye_view_mode';

export function ViewModeProvider({ children }) {
  const { isLive } = useAuth();
  // The dashboard starts with ONE mode; the admin adds more via the "+" button,
  // giving each added mode its own name (e.g. the university's name).
  const [enabled, setEnabled] = useState(['primary']);
  const [mode, setModeState] = useState('primary');
  const [names, setNames] = useState({}); // { [modeKey]: customName }

  useEffect(() => {
    if (isLive) return; // live-safe: don't restore a demo toggle over the real backend
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      try {
        const s = JSON.parse(v);
        const en = Array.isArray(s.enabled) ? s.enabled.filter((k) => VIEW_MODES.some((m) => m.key === k)) : [];
        if (en.length) { setEnabled(en); setModeState(en.includes(s.mode) ? s.mode : en[0]); }
        if (s.names && typeof s.names === 'object') setNames(s.names);
      } catch (e) {}
    }).catch(() => {});
  }, [isLive]);

  const persist = useCallback((en, m, nm) => {
    if (!isLive) AsyncStorage.setItem(KEY, JSON.stringify({ enabled: en, mode: m, names: nm })).catch(() => {});
  }, [isLive]);

  // switch the active mode (only among the ones already added)
  const setMode = useCallback((k) => {
    if (!enabled.includes(k)) return;
    setModeState(k);
    persist(enabled, k, names);
  }, [enabled, names, persist]);

  // add a mode via "+", store its name, then make it the active one
  const addMode = useCallback((k, name) => {
    if (!VIEW_MODES.some((m) => m.key === k)) return;
    const next = enabled.includes(k) ? enabled : [...enabled, k];
    const clean = (name || '').trim();
    const nm = clean ? { ...names, [k]: clean } : names;
    setEnabled(next);
    setNames(nm);
    setModeState(k);
    persist(next, k, nm);
  }, [enabled, names, persist]);

  // the display label for a mode: its custom name if set, else the type label
  const nameFor = useCallback((k) => names[k] || findMode(k).label, [names]);

  const available = VIEW_MODES.filter((m) => !enabled.includes(m.key));

  return (
    <ViewModeContext.Provider value={{ mode, meta: findMode(mode), enabled, available, names, nameFor, setMode, addMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export const useViewMode = () => useContext(ViewModeContext);
