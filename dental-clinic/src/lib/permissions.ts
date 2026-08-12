import type { UserRole } from '@/types/database';

/**
 * Mirror of has_perm() in 0002_functions.sql.
 *
 * This copy exists only to hide menus and disable buttons. The database is the
 * authority — every policy and RPC re-checks the same rules server-side, so a
 * user who bypasses the UI still gets nothing.
 */
export type Permission =
  | 'patients.read' | 'patients.write'
  | 'clinical.read' | 'clinical.write'
  | 'appointments.read' | 'appointments.write'
  | 'finance.read' | 'finance.write'
  | 'pharmacy.read' | 'pharmacy.write'
  | 'reports.read'
  | 'staff.manage' | 'settings.manage' | 'audit.read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'patients.read', 'patients.write', 'clinical.read', 'clinical.write',
    'appointments.read', 'appointments.write', 'finance.read', 'finance.write',
    'pharmacy.read', 'pharmacy.write', 'reports.read',
    'staff.manage', 'settings.manage', 'audit.read',
  ],
  dentist: [
    'patients.read', 'patients.write', 'clinical.read', 'clinical.write',
    'appointments.read', 'pharmacy.read',
  ],
  receptionist: [
    'patients.read', 'patients.write', 'clinical.read',
    'appointments.read', 'appointments.write',
    'finance.read', 'finance.write', 'reports.read',
  ],
  pharmacist: [
    'patients.read', 'pharmacy.read', 'pharmacy.write', 'reports.read',
  ],
};

export function can(
  role: UserRole | null | undefined,
  permission: Permission,
  overrides: string[] = [],
): boolean {
  if (!role) return false;
  if (overrides.includes(permission)) return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/',
  dentist: '/',
  receptionist: '/',
  pharmacist: '/pharmacy/prescriptions',
};
