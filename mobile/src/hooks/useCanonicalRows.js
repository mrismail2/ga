/* ============================================================
   Kobciye — live-mode canonical rows hook

   One hook every main-menu screen uses to read a Phase 4 table from the
   SAME canonical repository Maamulka Dugsiga uses (services/phase4.js).

   Important tenant-safety invariant: switching the active school clears the
   previous school's rows synchronously and invalidates in-flight requests.
   A late School A response can therefore never overwrite School B state or
   remain visible while School B is loading.
   ============================================================ */
import { useState, useEffect, useCallback, useRef } from 'react';
import { p4List, p4FriendlyError } from '../services/phase4';
import { onCanonicalChange } from '../services/canonicalStore';
import { isUuid } from '../utils/uuid';

export default function useCanonicalRows(table, schoolId, { enabled = true, watch = null } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const requestSeq = useRef(0);

  const active = enabled && isUuid(schoolId);

  const reload = useCallback(async ({ clear = false } = {}) => {
    const requestId = ++requestSeq.current;
    if (clear) setRows([]);
    if (!active) {
      if (requestSeq.current === requestId) {
        setRows([]);
        setError(null);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await p4List(table, schoolId);
      if (requestSeq.current === requestId) setRows(next);
    } catch (e) {
      if (requestSeq.current === requestId) {
        setRows([]);
        setError(p4FriendlyError(e));
      }
    } finally {
      if (requestSeq.current === requestId) setLoading(false);
    }
  }, [active, schoolId, table]);

  useEffect(() => {
    // Clear immediately on table/school change before any network response.
    reload({ clear: true });
    return () => { requestSeq.current += 1; };
  }, [reload]);

  useEffect(() => {
    if (!active) return undefined;
    const interesting = new Set([table, ...(watch || [])]);
    return onCanonicalChange((changed) => {
      if (interesting.has(changed)) reload();
    });
  }, [active, table, reload, watch && watch.join(',')]);

  return { rows, loading, error, reload };
}
