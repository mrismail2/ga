/* ============================================================
   Kobciye — DB role  ↔  frontend role-key mapping (Phase 3)

   The database is the single source of truth for a user's role. Its enum
   values carry underscores (super_admin, school_admin …); the frontend's
   ROLES map / navigation use compact keys (superadmin, schooladmin …).
   Routing in live mode uses THIS mapping applied to the profile's DB role —
   never a UI role picker.
   ============================================================ */

// exact DB enum values (must match user_role in migration 0001)
export const DB_ROLES = [
  'super_admin', 'school_admin', 'teacher', 'accountant', 'parent', 'student', 'pending',
];

const DB_TO_KEY = {
  super_admin: 'superadmin',
  school_admin: 'schooladmin',
  teacher: 'teacher',
  accountant: 'accountant',
  parent: 'parent',
  student: 'student',
  // 'pending' has no dashboard — it is handled by a dedicated holding screen
  pending: 'pending',
};

/* Map a database role to the frontend ROLES key. Returns 'pending' for the
   pending role and null for anything unrecognised (never guess a privileged
   key from an unknown value). */
export function roleKeyForDbRole(dbRole) {
  return Object.prototype.hasOwnProperty.call(DB_TO_KEY, dbRole) ? DB_TO_KEY[dbRole] : null;
}

export function isDashboardRole(dbRole) {
  const k = roleKeyForDbRole(dbRole);
  return Boolean(k) && k !== 'pending';
}
