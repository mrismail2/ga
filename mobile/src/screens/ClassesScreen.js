import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { radius, shadow } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import AddClassModal from '../components/AddClassModal';
import { CLASSES, SCHOOL2_CLASSES } from '../data/mock';
import { filterClassesForProfile, canPerformAction } from '../data/access';

/* every class across schools — the filter narrows to what the role may see */
const ALL_CLASSES = [...CLASSES, ...SCHOOL2_CLASSES];

function ClassCard({ cls, onPress }) {
  const { c } = useTheme();
  const [name, grade, teacher, students, cap, color, att] = cls;
  const fill = Math.round((students / cap) * 100);
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}
      onPress={() => onPress(cls)}
      activeOpacity={0.85}
    >
      <View style={[styles.emblem, { backgroundColor: color }]}>
        <Text style={styles.emblemTxt}>{name.replace(/[^0-9]/g, '') || '★'}</Text>
      </View>
      <Text style={[styles.cName, { color: c.ink }]}>{name}</Text>
      <Text style={[styles.cMeta, { color: c.muted }]} numberOfLines={1}>{teacher}</Text>
      <View style={styles.kpis}>
        <View>
          <Text style={[styles.kpiVal, { color: c.ink }]}>{students}</Text>
          <Text style={[styles.kpiLbl, { color: c.muted }]}>Arday</Text>
        </View>
        <View>
          <Text style={[styles.kpiVal, { color: c.ink }]}>{fill}%</Text>
          <Text style={[styles.kpiLbl, { color: c.muted }]}>Buuxa</Text>
        </View>
        <View>
          <Text style={[styles.kpiVal, { color: c.green }]}>{att}%</Text>
          <Text style={[styles.kpiLbl, { color: c.muted }]}>Xaadir</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassesScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const [q, setQ] = useState('');
  // role + school isolation: teacher sees only assigned classes, admins only
  // their school, Super Admin all. Filter the actual data, not just the UI.
  const [classes, setClasses] = useState(() => filterClassesForProfile(profile, ALL_CLASSES));
  const [showAdd, setShowAdd] = useState(false);
  // only Super Admin / School Admin may create a class
  const canCreate = canPerformAction(profile, 'classes.create');
  const list = classes.filter((cl) => cl[0].toLowerCase().includes(q.toLowerCase()));

  const addClass = (cls) => setClasses([cls, ...classes]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Fasallada" subtitle={`${classes.length} fasal`} />
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Raadi fasal…"
            placeholderTextColor={c.muted2}
            style={[styles.searchInput, { color: c.ink }]}
          />
        </View>
        <FlatList
          data={list}
          keyExtractor={(item) => item[0]}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 90 }}
          renderItem={({ item }) => (
            <ClassCard cls={item} onPress={(cls) => navigation.navigate('ClassDetail', { cls })} />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Add Class is hidden for Teacher / Accountant / Parent / Student */}
      {canCreate ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}

      {canCreate ? <AddClassModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={addClass} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: 14 },
  emblem: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emblemTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cName: { fontSize: 16, fontWeight: '800' },
  cMeta: { fontSize: 12, marginTop: 2 },
  kpis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  kpiVal: { fontSize: 15, fontWeight: '800' },
  kpiLbl: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
});
