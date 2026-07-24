/* ============================================================
   Kobciye — Student password change (FRONTEND PREVIEW ONLY)

   This is NOT secure authentication. It stores a UI-preview password per
   student in AsyncStorage so the "change password" flow can be tested.
   Real password hashing, reset tokens, session security and authentication
   must be handled by a secure backend in later phases.

   We never display passwords in the UI and never write them to mock data
   files — only to this AsyncStorage key.
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kobciye_student_auth_v1';
const DEFAULT_PASSWORD = 'kobciye123'; // preview default before any change

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) { return {}; }
}

/* validate a new password + confirmation (>= 8 chars, must match) */
export function validateNewPassword(password, confirmPassword) {
  const p = String(password || '');
  if (p.length < 8) return { ok: false, error: 'Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.' };
  if (p !== String(confirmPassword || '')) return { ok: false, error: 'Labada password isma laha.' };
  return { ok: true };
}

/* change ONLY this student's password (UI preview).
   A student may never change another student's password — callers pass
   their own student_internal_id from the active profile. */
export async function changeStudentPassword(studentInternalId, currentPassword, newPassword, confirmPassword) {
  if (!studentInternalId) throw new Error('Aqoonsi arday ma jiro.');
  const v = validateNewPassword(newPassword, confirmPassword);
  if (!v.ok) throw new Error(v.error);

  const all = await readAll();
  const stored = all[studentInternalId];          // undefined until first change
  const existing = stored != null ? stored : DEFAULT_PASSWORD;
  if (currentPassword != null && String(currentPassword) !== String(existing)) {
    throw new Error('Password-ka hadda waa khalad.');
  }
  all[studentInternalId] = String(newPassword);   // preview-only store
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
  return true;
}
