/* Ogeysiisyo — real persisted notifications. RLS limits every row to the
   signed-in recipient; read/unread state lives in Supabase, never locally. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import Icon from '../../components/Icon';
import { listNotifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount } from '../../services/phase5';

const EVENT_LABEL = {
  'attendance.absence': 'Maqnaansho', 'attendance.late': 'Soo daahid',
  'attendance.excused': 'Cudur-daar', 'attendance.correction': 'Xaadiris (sax)',
  'assignment.published': 'Shaqo-guri', 'exam.published': 'Imtixaan',
  'result.published': 'Natiijo', 'invoice.issued': 'Biil',
  'payment.recorded': 'Lacag', 'incident.followup': 'Kiis',
  'account.invitation': 'Akoon', 'account.activated': 'Akoon',
};

export default function NotificationsScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { data, loading, error, reload, setData } = useAsyncData(async () => {
    const [rows, unread] = await Promise.all([listNotifications(), unreadNotificationCount()]);
    return { rows, unread };
  }, [], { enabled: isLive });
  const [busy, setBusy] = useState(null);
  const [allBusy, setAllBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const rows = (data && data.rows) || [];
  const unread = data ? Number(data.unread || 0) : 0;
  const markRead = async (row) => {
    if (row.read_at || busy) return;
    setBusy(row.id); setActionError('');
    try {
      await markNotificationRead(row.id);
      setData((prev) => ({
        rows: ((prev && prev.rows) || []).map((r) => (r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r)),
        unread: Math.max(0, Number((prev && prev.unread) || 0) - 1),
      }));
    } catch (e) { setActionError('Ogeysiiska lama calaamadin. Isku day mar kale.'); }
    finally { setBusy(null); }
  };
  const markAll = async () => {
    if (allBusy || unread === 0) return;
    setAllBusy(true); setActionError('');
    try {
      await markAllNotificationsRead();
      const at = new Date().toISOString();
      setData((prev) => ({ rows: ((prev && prev.rows) || []).map((r) => ({ ...r, read_at: r.read_at || at })), unread: 0 }));
    } catch (e) { setActionError('Ogeysiisyada lama wada calaamadin.'); }
    finally { setAllBusy(false); }
  };

  return (
    <Phase5Screen title="Ogeysiisyo" subtitle={`${unread} cusub`} icon="bell"
      requireSchool={false} loading={loading} error={error}
      empty={!loading && !error && rows.length === 0} emptyText="Weli ogeysiis kuuma imaan." onRetry={reload}>
      {unread > 0 ? (
        <TouchableOpacity onPress={markAll} disabled={allBusy} style={[styles.allBtn, { borderColor: c.line, backgroundColor: c.surface }]}>
          {allBusy ? <ActivityIndicator size="small" color={c.blue} /> : <Icon name="check" size={15} color={c.blue} />}
          <Text style={[styles.allTxt, { color: c.blue }]}>Dhammaan akhri</Text>
        </TouchableOpacity>
      ) : null}
      {actionError ? <Text style={[styles.err, { color: c.rose }]}>{actionError}</Text> : null}
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
          {busy === r.id ? <ActivityIndicator size="small" color={c.blue} /> : !r.read_at ? <Icon name="check" size={16} color={c.muted2} /> : null}
        </TouchableOpacity>
      ))}
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  allBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-end', borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10 },
  allTxt: { fontSize: 12.5, fontWeight: '800' },
  err: { fontSize: 12.5, fontWeight: '700', marginBottom: 10 },
  card: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10, alignItems: 'flex-start' },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  top: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tag: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, overflow: 'hidden' },
  title: { fontSize: 14.5, fontWeight: '800' }, body: { fontSize: 12.5, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  time: { fontSize: 11, fontWeight: '600', marginTop: 5 },
});
