/* ============================================================
   Kobciye — UUID guard

   ONE place that decides whether a value is a real Postgres uuid. Used by
   the data layer and the active-school resolver so a placeholder identifier
   ("*", "all", "", null, undefined, a demo "school_001") can NEVER reach a
   Supabase `uuid` column. Sending "*" to `.eq('school_id', …)` is exactly
   the `invalid input syntax for type uuid: "*"` crash this guards against.

   CommonJS (like src/domain/*) so the Node behaviour tests can execute the
   REAL shipped guard — Metro/Babel interop lets the app keep importing it
   with ordinary `import { isUuid } from '../utils/uuid'` syntax.
   ============================================================ */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* true only for a syntactically valid uuid string. Everything else —
   "*", "all", "", "school_001", null, undefined, numbers — is false. */
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/* the value when it is a real uuid, otherwise null. Handy for
   `.eq('school_id', asUuidOrNull(schoolId))`-style narrowing where a
   non-uuid must become "no school" rather than a crash. */
function asUuidOrNull(value) {
  return isUuid(value) ? value.trim() : null;
}

module.exports = { isUuid, asUuidOrNull, UUID_RE };
