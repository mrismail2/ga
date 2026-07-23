import React, { useState } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, View, StyleSheet } from 'react-native';
import ListScreen from '../components/ListScreen';
import RowCard from '../components/RowCard';
import TeacherProfileModal from '../components/TeacherProfileModal';
import AddTeacherModal from '../components/AddTeacherModal';
import { TEACHERS } from '../data/datasets';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import { useTheme } from '../theme/ThemeContext';
import useCanonicalRows from '../hooks/useCanonicalRows';
import { p4Update, p4FriendlyError } from '../services/phase4';

/* Macallimiinta.

   DEMO mode: the Phase 1/2 static dataset, unchanged.

   LIVE mode: ONLY the canonical `teachers` rows of the authenticated
   school (services/phase4.js) — the demo TEACHERS array is never used. A
   brand-new school starts at zero with an honest empty state; a teacher
   created in Maamulka Dugsiga appears here immediately (canonical change
   bus) and persists after refresh. The + button opens the SAME canonical
   add form (Maamulka Dugsiga → Macallimiinta module); deactivating from
   the profile modal archives the canonical row, so Maamulka Dugsiga
   shows the same change. */
export default function TeachersScreen({ navigation }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { profile } = useRole();
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [teachers, setTeachers] = useState(TEACHERS);
  const [liveErr, setLiveErr] = useState(null);

  const schoolId = profile.school_id;
  const live = useCanonicalRows('teachers', schoolId, { enabled: isLive });
  const liveActive = live.rows.filter((t) => t.status !== 'archived');
  const isAdmin = roleKey === 'schooladmin' || roleKey === 'superadmin';

  const handleDeleteTeacher = (teacher) => {
    setTeachers(teachers.filter((t) => t !== teacher));
  };

  // LIVE deactivate: archive the canonical row — Maamulka Dugsiga reflects it
  const handleArchiveLive = async (row) => {
    setLiveErr(null);
    try { await p4Update('teachers', row.id, { status: 'archived' }); }
    catch (e) { setLiveErr(p4FriendlyError(e)); }
  };

  if (isLive) {
    return (
      <>
        <ListScreen
          navigation={navigation}
          title="Macalimiin"
          subtitle={`${liveActive.length} macalin`}
          data={liveActive}
          onAdd={isAdmin && schoolId ? () => navigation.navigate('Management', { moduleKey: 'teachers' }) : undefined}
          headerExtra={live.loading ? (
            <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
          ) : live.error || liveErr ? (
            <View style={styles.state}>
              <Text style={[styles.err, { color: c.rose }]}>{live.error || liveErr}</Text>
              <TouchableOpacity onPress={live.reload}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 6 }}>Isku day mar kale</Text></TouchableOpacity>
            </View>
          ) : liveActive.length === 0 ? (
            <View style={styles.state}>
              <Text style={[styles.empty, { color: c.muted }]}>Weli macalin lama diiwaangelin. Ka dar Maamulka Dugsiga.</Text>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <RowCard
              avatarName={item.full_name}
              avatarCode={item.id}
              title={item.full_name}
              subtitle={item.email || item.phone || '—'}
              meta="Firfircoon"
              onPress={() => setSelected(item)}
            />
          )}
        />
        <TeacherProfileModal
          visible={!!selected}
          teacher={selected ? [selected.full_name, '—', '—', '—', '#5B5BD6'] : null}
          live={selected}
          onClose={() => setSelected(null)}
          onDelete={isAdmin ? () => { if (selected) handleArchiveLive(selected); } : undefined}
        />
      </>
    );
  }

  return (
    <>
      <ListScreen
        navigation={navigation}
        title="Macalimiin"
        subtitle={`${teachers.length} macalin`}
        data={teachers}
        onAdd={() => setShowAdd(true)}
        renderItem={({ item }) => (
          <RowCard
            avatarName={item[0]}
            avatarCode={'TCH-' + item[0].replace(/\s/g, '').slice(0, 6).toUpperCase()}
            title={item[0]}
            subtitle={`${item[1]} · Fasal: ${item[2]}`}
            meta={`${item[3]} snd`}
            onPress={() => setSelected(item)}
          />
        )}
      />
      <TeacherProfileModal
        visible={!!selected}
        teacher={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDeleteTeacher}
      />
      <AddTeacherModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={(t) => setTeachers([t, ...teachers])} />
    </>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: 16 },
  err: { fontSize: 12.5, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});
