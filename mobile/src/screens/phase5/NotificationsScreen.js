/* Ogeysiisyo — real, persisted Supabase notifications for the signed-in user.
   Every user sees only their OWN notifications (RLS); a parent sees only
   linked-child notifications. Read state persists in the database. No fake
   rows, no device-local storage. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import Icon from '../../components/Icon';
import { listNotifications, markNotificationRead } from '../../services/phase5';

const EVENT_LABEL = {
  'attendance.absence': 'Xaadiris',
  'attendance.correction': 'Xaadiris (sax)',
  'assignment.published': 'Shaqo-guri',
  'exam.published': 'Imtixaan',
  'result.published': 'Natiijo',
  'invoice.issued': 'Biil',
  'payment.recorded': 'Lacag',
  'incident.followup': 'Kiis',
};

export default function NotificationsScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { data, loading, error, reload, setData } = useAsyncData(() => listNotifications(), [], { enabled: isLive });
  const [busy, setBusy] = useState(null);

  const rows = data || [];
  const markRead = async (row) => {
    if (row.read_at || busy) return;
    setBusy(row.id);
    try {
      await markNotificationRead(row.id);
      setData((prev) => (prev || []).map((r) => (r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r)));
    } catch (e) { /* keep unread; a reload will re-sync */ }
    finally { setBusy(null); }
  };

  return (
    <Phase5Screen
      title="Ogeysiisyo"
      subtitle={`${rows.filter((r) => !r.read_at).length} cusub`}
      icon="bell"
      requireSchool={false}
      loading={loading}
      error={error}
      empty={!loading && !error && rows.length === 0}
      emptyText="Weli ogeysiis kuuma imaan."
      onRetry={reload}
    >
      {rows.map((r) => (
        <TouchableOpacity key={r.id} activeOpacity={0.85} onPress={() => markRead(r)}
          style={[styles.card, { backgroundColor: c.surface, borderColor: r.read_at ? c.line : c.blue }]}>
          <View style={[styles.dot, { backgroundColor: r.read_at ? c.line : c.blue }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.top}>
              <Text style={[styles.tag, { color: c.blue, backgroundColor: c.blueSoft }]}>{EVENT_LABEL[r.event_type] || 'Ogeysiis'}</Text>
              {r.superseded_at ? <Text style={[styles.tag, { color: c.muted, backgroundColor: c.line }]}>La saxay</Text> : null}
            </View>
            <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{r.title}</Text>
            <Text style={[styles.body, { color: c.muted }]}>{r.body}</Text>
            <Text style={[styles.time, { color: c.muted2 }]}>{String(r.created_at).slice(0, 16).replace('T', ' ')}</Text>
          </View>
          {!r.read_at ? <Icon name="check" size={16} color={c.muted2} /> : null}
        </TouchableOpacity>
      ))}
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10, alignItems: 'flex-start' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  top: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tag: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, overflow: 'hidden' },
  title: { fontSize: 14.5, fontWeight: '800' },
  body: { fontSize: 12.5, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, fontWeight: '600', marginTop: 5 },
});
