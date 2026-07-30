/* ============================================================
   Kobciye — data provider seam (Phase 2)

   Screens keep importing their data functions from ONE place. Today
   every call is served by the local AsyncStorage repository
   (appDataRepository — the Phase 1 prototype store). In Phase 3,
   modules are migrated one by one to Supabase by adding the remote
   implementation here and flipping `backendFor(module)` — no screen
   rewrites.

     import { getStudentsBySchool } from '../services/dataProvider';

   Rules:
   - 'local'    → AsyncStorage store (works offline, no account needed)
   - 'supabase' → only honoured when a client is configured AND the
                  module has a remote implementation; otherwise the
                  call falls back to local so nothing ever breaks.
   ============================================================ */
import * as local from './appDataRepository';
import { isSupabaseConfigured } from './supabase';

/* Per-module switch. Phase 3 flips modules to 'supabase' one at a time
   (students first, then attendance, exams, finance, messages …). */
const BACKENDS = {
  students: 'local',
  exams: 'local',
  attendance: 'local',
  finance: 'local',
  terms: 'local',
  teachers: 'local',
  settings: 'local',
};

export function backendFor(module) {
  const want = BACKENDS[module] || 'local';
  return want === 'supabase' && isSupabaseConfigured() ? 'supabase' : 'local';
}

/* ---- Phase 2: everything re-exported from the local store ----
   (kept as a flat re-export so existing imports can move over with a
   one-line change and Phase 3 can intercept per function) */
export * from './appDataRepository';
