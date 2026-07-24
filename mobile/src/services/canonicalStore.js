/* ============================================================
   Kobciye — canonical change bus (Phase 1–4 synchronization)

   Maamulka Dugsiga and the main-menu screens (Fasallada, Macallimiinta,
   Ardayda, Maadooyinka, dashboard counts) are TWO interfaces over the
   SAME canonical Supabase tables — never separate runtime stores. After
   any successful create / update / deactivate through the canonical
   repository (services/phase4.js and the admission RPC), the mutation
   notifies this bus and every subscribed screen reloads the SAME
   canonical rows. Nothing is copied between screens; persistence and
   cross-screen visibility both come from re-reading Supabase.

   The bus resets when live mode ends (sign out) so no private cached
   callback survives into the next session.
   ============================================================ */
import { onLiveModeChange } from './liveMode';

const listeners = new Set();

/* subscribe to canonical-data changes; returns unsubscribe */
export function onCanonicalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* called by the canonical repository after every successful mutation */
export function notifyCanonicalChange(table) {
  listeners.forEach((fn) => { try { fn(table); } catch (e) { /* one bad listener never blocks the rest */ } });
}

/* leaving live mode (sign out) — drop every subscription so no screen
   callback (or data captured in one) outlives the session */
onLiveModeChange((live) => { if (!live) listeners.clear(); });
