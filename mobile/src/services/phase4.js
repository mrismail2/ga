/* ============================================================
   Kobciye — Phase 4 core-management data services

   Thin, allow-listed CRUD over the Phase 4 tables. LIVE data only: every
   call goes straight to Supabase under the caller's own JWT, so RLS is the
   real authority — nothing here reads or writes AsyncStorage, and no
   secret/service key is ever involved (only the public client from
   services/supabase.js). school_id scoping is enforced server-side by RLS;
   we still always pass it explicitly so a bug can only ever *narrow* a
   query, never widen it.
   ============================================================ */
import { supabase, isSupabaseConfigured } from './supabase';

/* Allow-list: table -> default ordering. p4* functions refuse any table
   not in this map, so a screen bug can never touch other tables. */
const TABLES = {
  academic_years: { order: 'name' },
  terms: { order: 'name' },
  school_sections: { order: 'name' },
  classes: { order: 'display_order' },
  class_streams: { order: 'name' },
  subjects: { order: 'name' },
  teachers: { order: 'full_name' },
  staff: { order: 'full_name' },
  teacher_assignments: { order: 'created_at' },
  students: { order: 'full_name' },
  parents: { order: 'full_name' },
  student_parents: { order: 'student_id' },
  admissions: { order: 'created_at' },
  faculties: { order: 'name' },
  departments: { order: 'name' },
  programmes: { order: 'name' },
  semesters: { order: 'name' },
  courses: { order: 'name' },
  lecturers: { order: 'full_name' },
  university_students: { order: 'full_name' },
};

function requireTable(table) {
  if (!TABLES[table]) throw new Error('Unknown Phase 4 table: ' + table);
  if (!isSupabaseConfigured() || !supabase) {
    const e = new Error('Backend-ka Supabase lama habayn (eeg mobile/.env.example).');
    e.code = 'not_configured';
    throw e;
  }
  return TABLES[table];
}

/* Postgres error → short Somali message the form can show inline. */
export function p4FriendlyError(error) {
  const msg = (error && (error.message || String(error))) || '';
  const code = error && error.code;
  if (code === 'not_configured') return msg;
  if (code === '23505' || /duplicate key/i.test(msg)) {
    return 'Diiwaan isku mid ah ayaa horey u jiray (magac/koodh/lambar ku celis ah). Beddel qiimaha.';
  }
  if (code === '23514' || /check constraint|violates check/i.test(msg)) {
    return 'Xogtu ma aha mid sax ah (hubi taariikhaha iyo qiimaha la ogol yahay).';
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return 'Ma lihid oggolaansho aad diiwaankan ku sameyso.';
  }
  if (/belongs to another/i.test(msg)) {
    return 'Diiwaanka aad dooratay wuxuu ka tirsan yahay dugsi/jaamacad kale.';
  }
  return msg || 'Waa la fashilmay. Isku day mar kale.';
}

export async function p4List(table, schoolId, { activeOnly = false, limit = 500 } = {}) {
  const meta = requireTable(table);
  let q = supabase.from(table).select('*').eq('school_id', schoolId)
    .order(meta.order, { ascending: true }).limit(limit);
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function p4Create(table, row) {
  requireTable(table);
  if (!row || !row.school_id) throw new Error('school_id waa qasab (required).');
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function p4Update(table, id, patch) {
  requireTable(table);
  // school_id/institution ownership can never be moved from the client
  const { school_id, id: _id, created_at, ...safe } = patch || {};
  const { data, error } = await supabase.from(table).update(safe).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/* Zero-count dashboard tiles for an empty institution. Uses head-count
   queries (no row data transferred). Missing/blocked tables count as 0. */
export async function p4Counts(schoolId, tables) {
  const out = {};
  await Promise.all(tables.map(async (t) => {
    try {
      requireTable(t);
      const { count, error } = await supabase.from(t)
        .select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
      out[t] = error ? 0 : (count || 0);
    } catch (e) { out[t] = 0; }
  }));
  return out;
}

/* Client-side validation shared by the CRUD forms (the DB re-validates all
   of this anyway — these exist for friendly, immediate messages). */
export function p4Validate(fields, values) {
  for (const f of fields) {
    const v = (values[f.key] == null ? '' : String(values[f.key])).trim();
    if (f.required && !v) return `${f.label} waa qasab (required).`;
    if (f.date && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${f.label}: qaabka taariikhdu waa YYYY-MM-DD.`;
    if (f.number && v && isNaN(Number(v))) return `${f.label} waa inuu noqdaa lambar.`;
    if (f.phone && f.required && v.replace(/[^0-9+]/g, '').length < 7) return `${f.label}: lambarka telefoonku waa inuu sax ahaadaa.`;
  }
  const s = fields.find((f) => f.key === 'starts_on');
  const e = fields.find((f) => f.key === 'ends_on');
  if (s && e && values.starts_on && values.ends_on && values.ends_on < values.starts_on) {
    return 'Taariikhda dhammaadku waa inay ka dambaysaa tan bilowga.';
  }
  return null;
}
