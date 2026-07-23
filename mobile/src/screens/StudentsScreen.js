import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import StudentRow from '../components/StudentRow';
import StudentProfileModal from '../components/StudentProfileModal';
import { getClassDisplayName } from '../data/identity';
import { useAppData } from '../context/AppDataContext';
import { filterStudentsForProfile } from '../utils/dataSelectors';

export default function StudentsScreen() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { data: appData } = useAppData();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  // role + school isolation from the ONE central store: every student, then
  // filtered to what this profile may see (a school_001 user never sees 002).
  const data = useMemo(
    () => filterStudentsForProfile(profile, appData.students).map((s) => ({ ...s, className: getClassDisplayName(s.class_id) })),
    [profile, appData.students]
  );
  const list = data.filter((s) => (s.name || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Ardayda" subtitle={`${data.length} arday guud`} />
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Raadi arday…"
            placeholderTextColor={c.muted2}
            style={[styles.searchInput, { color: c.ink }]}
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(item, i) => item.student_internal_id || String(i)}
          renderItem={({ item, index }) => (
            <StudentRow student={item} index={index} onPress={setSelected} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
      <StudentProfileModal
        visible={!!selected}
        student={selected}
        className={selected?.className}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
});
