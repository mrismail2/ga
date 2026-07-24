/* ============================================================
   Kobciye — live-mode canonical rows hook

   One hook every main-menu screen uses to read a Phase 4 table from the
   SAME canonical repository Maamulka Dugsiga uses (services/phase4.js).
   Reloads automatically whenever ANY screen persists a change through
   that repository (canonicalStore change bus), so records created in
   Maamulka Dugsiga appear in the menu screens immediately — and records
   created from a menu screen appear in Maamulka Dugsiga. Refresh-proof
   by construction: every load re-reads Supabase.

   Demo mode is untouched: with enabled=false the hook stays inert and
   the screen keeps its Phase 1/2 demo behaviour.
   ============================================================ */
import { useState, useEffect, useCallback } from 'react';
import { p4List, p4FriendlyError } from '../services/phase4';
import { onCanonicalChange } from '../services/canonicalStore';
import { isUuid } from '../utils/uuid';

export default function useCanonicalRows(table, schoolId, { enabled = true, watch = null } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // A non-uuid schoolId (Super Admin before picking a school, "*", null…)
  // means "no school scope yet" — never a query with a placeholder id.
  const active = enabled && isUuid(schoolId);

  const reload = useCallback(async () => {
    if (!active) { setRows([]); setLoading(false); return; }
    setError(null);
    try { setRows(await p4List(table, schoolId)); }
    catch (e) { setError(p4FriendlyError(e)); }
    finally { setLoading(false); }
  }, [active, schoolId, table]);

  useEffect(() => { setLoading(active); reload(); }, [reload, active]);

  // reload when this table (or any watched related table) changes anywhere
  useEffect(() => {
    if (!active) return undefined;
    const interesting = new Set([table, ...(watch || [])]);
    return onCanonicalChange((changed) => { if (interesting.has(changed)) reload(); });
  }, [active, table, reload, watch && watch.join(',')]);

  return { rows, loading, error, reload };
}
