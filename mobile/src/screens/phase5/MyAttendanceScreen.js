/* Xaadiris (read-only) — the Student's own attendance, or a Parent's linked
   children's attendance. RLS scopes attendance_records to self / linked child,
   so this screen can never show another student. Percentages are computed from
   the REAL records (never hardcoded). No marking or editing here. */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import { myAttendance } from '../../services/phase5';

const STATUS_LABEL = { present: 'Jooga', absent: 'Maqan', late: 'Daahay', excused: 'Erid' };
const STATUS_TONE = { present: '#16A34A', absent: '#E5484D', late: '#CFAD5E', excused: '#2F6BF0' };

export default function MyAttendanceScreen() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const { data, loading, error, reload } = useAsyncData(() => myAttendance(schoolId), [schoolId], { enabled: isLive && !!schoolId });
  const [child, setChild] = useState(null); // parent: selected student_id filter

  const rows = data || [];
  // parent may have multiple children — offer a child selector
  const childIds = useMemo(() => [...new Set(rows.map((r) => r.student_id))], [rows]);
  const isParent = roleKey === 'parent';
  const filtered = isParent && child ? rows.filter((r) => r.student_id === child) : rows;

  const summary = useMemo(() => {
    const s = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
    filtered.forEach((r) => { s[r.status] = (s[r.status] || 0) + 1; s.total += 1; });
    s.rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null;
    return s;
  }, [filtered]);

  return (
    <Phase5Screen title="Xaadiris" subtitle="Diiwaanka xaadiriska" icon="attendance"
      loading={loading} error={error} onRetry={reload}
      empty={!loading && !error && rows.length === 0}
      emptyText="Weli xaadiris lama diiwaangelin.">
      {isParent && childIds.length > 1 ? (
        <View style={styles.childRow}>
          <TouchableOpacity onPress={() => setChild(null)} style={[styles.childChip, { borderColor: !child ? c.blue : c.line, backgroundColor: !child ? c.blueSoft : c.surface }]}>
            <Text style={[styles.childTxt, { color: !child ? c.blue : c.muted }]}>Dhammaan</Text>
          </TouchableOpacity>
          {childIds.map((cid, i) => (
            <TouchableOpacity key={cid} onPress={() => setChild(cid)} style={[styles.childChip, { borderColor: child === cid ? c.blue : c.line, backgroundColor: child === cid ? c.blueSoft : c.surface }]}>
              <Text style={[styles.childTxt, { color: child === cid ? c.blue : c.muted }]}>Ilmo {i + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.sumMain}>
          <Text style={[styles.sumRate, { color: c.ink }]}>{summary.rate == null ? '—' : `${summary.rate}%`}</Text>
          <Text style={[styles.sumLbl, { color: c.muted }]}>Xaadir guud ({summary.total})</Text>
        </View>
        <View style={styles.sumChips}>
          {['present', 'absent', 'late', 'excused'].map((k) => (
            <View key={k} style={styles.sumChip}>
              <View style={[styles.dot, { backgroundColor: STATUS_TONE[k] }]} />
              <Text style={[styles.sumChipTxt, { color: c.muted }]}>{STATUS_LABEL[k]}: {summary[k]}</Text>
            </View>
          ))}
        </View>
      </View>

      {filtered.map((r) => (
        <View key={r.id} style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.date, { color: c.ink }]}>{r.session ? r.session.session_date : '—'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: (STATUS_TONE[r.status] || c.muted) + '22' }]}>
            <Text style={[styles.badgeTxt, { color: STATUS_TONE[r.status] || c.muted }]}>{STATUS_LABEL[r.status] || r.status}</Text>
          </View>
        </View>
      ))}
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  childChip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  childTxt: { fontSize: 12.5, fontWeight: '800' },
  summary: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  sumMain: { alignItems: 'center', marginBottom: 12 },
  sumRate: { fontSize: 30, fontWeight: '800' },
  sumLbl: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  sumChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  sumChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sumChipTxt: { fontSize: 11.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 8 },
  date: { fontSize: 14, fontWeight: '700' },
  badge: { borderRadius: 9, paddingVertical: 5, paddingHorizontal: 10 },
  badgeTxt: { fontSize: 12, fontWeight: '800' },
});
