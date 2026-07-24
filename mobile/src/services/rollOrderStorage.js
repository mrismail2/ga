/* ============================================================
   Kobciye — Roll-number (lambarka xaadiriska) order per class

   Each class keeps an explicit roll order so a number freed by a
   student who LEFT (wuu baxay) can be taken by another student.
   Example: #1 Axmed leaves → Cumar (#20) is moved to #1.

   Stored per school + class (never the display name):
     { order: [student_internal_id, …],   // desired roll sequence
       left:  [student_internal_id, …] }   // students who left (hidden)

   NO backend — local, device-only preview persistence.
   ============================================================ */
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (schoolId, classId) => `kobciye_roll_order:${schoolId}:${classId}`;

export async function getRollOrder(schoolId, classId) {
  try {
    const raw = await AsyncStorage.getItem(keyFor(schoolId, classId));
    const v = raw ? JSON.parse(raw) : null;
    return {
      order: Array.isArray(v && v.order) ? v.order : [],
      left: Array.isArray(v && v.left) ? v.left : [],
    };
  } catch (e) {
    return { order: [], left: [] };
  }
}

export async function saveRollOrder(schoolId, classId, data) {
  try {
    await AsyncStorage.setItem(keyFor(schoolId, classId), JSON.stringify({
      order: Array.isArray(data && data.order) ? data.order : [],
      left: Array.isArray(data && data.left) ? data.left : [],
    }));
    return true;
  } catch (e) {
    return false;
  }
}

/* apply a saved roll order to a freshly-built roster:
   - drop students who left
   - sort the rest by their position in `order`
   - any student not in `order` keeps the natural order, appended after */
export function applyRollOrder(roster, rollOrder) {
  const order = (rollOrder && rollOrder.order) || [];
  const left = new Set((rollOrder && rollOrder.left) || []);
  const pos = new Map(order.map((id, i) => [id, i]));
  return roster
    .filter((s) => !left.has(s.student_internal_id))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const pa = pos.has(a.s.student_internal_id) ? pos.get(a.s.student_internal_id) : order.length + a.i;
      const pb = pos.has(b.s.student_internal_id) ? pos.get(b.s.student_internal_id) : order.length + b.i;
      return pa - pb;
    })
    .map((x) => x.s);
}
