/* ============================================================
   Kobciye — AppDataContext (the single store, in React)

   Loads the canonical store once (seeding/migrating on first launch) and
   exposes it to every screen with a reload() so mutations (add student,
   change status, save marks) reflect immediately. Screens read appData.*
   and pass it through dataSelectors — never raw arrays.
   ============================================================ */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initializeAppData, loadAppData } from '../services/appDataRepository';
import { emptyAppData } from '../utils/dataMigration';
import { useAuth } from './AuthContext';

const AppDataContext = createContext({ data: emptyAppData(), ready: false, reload: async () => {} });

export function AppDataProvider({ children }) {
  const { isLive } = useAuth();
  const [data, setData] = useState(emptyAppData());
  const [ready, setReady] = useState(false);

  // In LIVE mode we never load the AsyncStorage demo seed — an authenticated
  // real user must see real (initially empty) data, not Dugsiga Hidaayada. Per-
  // module live Supabase reads are wired incrementally (dataProvider); until a
  // module is live it resolves to these empty arrays → genuine zero/empty
  // states, never demo records.
  const reload = useCallback(async () => {
    if (isLive) { const empty = emptyAppData(); setData(empty); return empty; }
    const fresh = (await loadAppData()) || (await initializeAppData());
    setData(fresh);
    return fresh;
  }, [isLive]);

  useEffect(() => {
    let alive = true;
    if (isLive) {
      setData(emptyAppData());
      setReady(true);
      return () => { alive = false; };
    }
    initializeAppData().then((d) => { if (alive) { setData(d); setReady(true); } });
    return () => { alive = false; };
  }, [isLive]);

  return (
    <AppDataContext.Provider value={{ data, ready, reload }}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => useContext(AppDataContext);
