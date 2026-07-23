/* ============================================================
   Kobciye — live vs demo mode flag (Phase 3)

   The ONE switch that keeps real Supabase data and the local AsyncStorage
   demo store from ever mixing. It is a module-level flag (not React state) so
   non-React modules — the data provider, the AsyncStorage repository guards —
   can consult it synchronously.

   • isLiveSupabaseMode() === true  → the user is an authenticated real
     Supabase user. Screens must show real data (empty states / zero counts
     for a new school), never the Dugsiga Hidaayada demo seed.
   • false → local demo/preview mode (the Phase 1/2 AsyncStorage prototype).

   AuthContext is the single writer of this flag (setLiveSupabaseMode); every
   other module only reads it.
   ============================================================ */
let _live = false;
const listeners = new Set();

export function isLiveSupabaseMode() {
  return _live;
}

export function setLiveSupabaseMode(on) {
  const next = Boolean(on);
  if (next === _live) return;
  _live = next;
  listeners.forEach((fn) => { try { fn(_live); } catch (e) { /* noop */ } });
}

export function onLiveModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
