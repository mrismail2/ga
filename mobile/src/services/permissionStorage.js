/* ============================================================
   Kobciye — Teacher permission storage (frontend prototype)

   The School Admin grants/revokes a teacher's permissions in the
   Permissions screen. They persist to AsyncStorage so the choice
   survives an app restart, and flow into RoleContext so the teacher's
   UI/navigation updates immediately. No backend — UI preview only.

   Stored shape (object keyed by teacherId):
     { [teacherId]: { attendance_view: true, attendance_mark: false, … } }
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kobciye_teacher_permissions_v1';

/* canonical default grant for a teacher (mirrors the spec). results_publish,
   attendance_edit, incidents_edit and class_reports_export are OFF so the
   "School Admin permission required" locked state is visible. */
export const DEFAULT_TEACHER_PERMISSIONS = {
  attendance_view: true,
  attendance_mark: true,
  attendance_edit: false,
  results_view: true,
  results_create: true,
  results_update: true,
  results_publish: false,
  incidents_view: true,
  incidents_create: true,
  incidents_edit: false,
  messages_send: true,
  class_reports_view: true,
  class_reports_export: false,
};

export const PERMISSION_LABELS = {
  attendance_view: 'Eeg xaadirinta',
  attendance_mark: 'Calaamadi xaadirinta',
  attendance_edit: 'Wax ka bedel xaadirinta',
  results_view: 'Eeg natiijada',
  results_create: 'Samee natiijo',
  results_update: 'Wax ka bedel natiijada',
  results_publish: 'Daabac natiijada',
  incidents_view: 'Eeg kiisaska',
  incidents_create: 'Soo sheeg kiis',
  incidents_edit: 'Wax ka bedel kiisaska',
  messages_send: 'Dir fariimaha',
  class_reports_view: 'Eeg warbixinta fasalka',
  class_reports_export: 'Soo dejis warbixinta',
};

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}
async function writeAll(map) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(map || {})); return true; } catch (e) { return false; }
}

/* the whole { teacherId: permissions } map */
export async function loadTeacherPermissions() {
  return readAll();
}

/* replace one teacher's full permission set */
export async function saveTeacherPermissions(teacherId, permissions) {
  const all = await readAll();
  all[teacherId] = { ...DEFAULT_TEACHER_PERMISSIONS, ...permissions };
  await writeAll(all);
  return all[teacherId];
}

/* read one teacher's permissions (falls back to the default grant) */
export async function getTeacherPermissions(teacherId) {
  const all = await readAll();
  return { ...DEFAULT_TEACHER_PERMISSIONS, ...(all[teacherId] || {}) };
}

/* toggle a single permission and persist; returns the updated set */
export async function updateTeacherPermission(teacherId, permissionKey, enabled) {
  const cur = await getTeacherPermissions(teacherId);
  cur[permissionKey] = !!enabled;
  return saveTeacherPermissions(teacherId, cur);
}
