import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import { radius, shadow } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import AddClassModal from '../components/AddClassModal';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../components/SchoolSelector';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { CLASSES, SCHOOL2_CLASSES } from '../data/mock';
import { filterClassesForProfile, canPerformAction } from '../data/access';
import useCanonicalRows from '../hooks/useCanonicalRows';

/* every class across schools — the filter narrows to what the role may see */
const ALL_CLASSES = [...CLASSES, ...SCHOOL2_CLASSES];

/* stable palette for live cards (cosmetic only — never stored) */
const LIVE_COLORS = ['#5B5BD6', '#16A34A', '#CFAD5E', '#2F6BF0', '#0891B2', '#7C3AED', '#E5484D', '#B45309'];

function ClassCard({ cls, onPress }) {
  const { c } = useTheme();
  const [name, grade, teacher, students, cap, color, att] = cls;
  const fill = cap > 0 ? Math.round((students / cap) * 100) : 0;
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
          <Text style={[styles.kpiVal, { color: c.green }]}>{att == null ? '—' : `${att}%`}</Text>
          <Text style={[styles.kpiLbl, { color: c.muted }]}>Xaadir</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* Fasallada.

   DEMO mode: the Phase 1/2 mock grid, unchanged.

   LIVE mode: the SAME canonical `classes` rows Maamulka Dugsiga manages
   (services/phase4.js) — a class created in either place appears in both
   immediately (canonical change bus) and persists after refresh, because
   both read the same Supabase table. The School Admin can create a class
   right here with the existing + button / AddClassModal; the modal saves
   through the canonical repository, so both creation paths produce ONE
   canonical record format. Student counts come from the canonical
   students rows; attendance has no live source yet so it shows '—',
   never a fake number. */
export default function ClassesScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive, roleKey } = useAuth();
  const [q, setQ] = useState('');
  // role + school isolation: teacher sees only assigned classes, admins only
  // their school, Super Admin all. Filter the actual data, not just the UI.
  const [classes, setClasses] = useState(() => filterClassesForProfile(profile, ALL_CLASSES));
  const [showAdd, setShowAdd] = useState(false);

  // LIVE: canonical classes + active enrollments (for real per-class counts —
  // the canonical active-enrollment collection, never students.class_id
  // directly). RLS keeps other schools out (and a Teacher to their assigned
  // classes only); the change bus re-reads after ANY canonical mutation.
  // schoolId is the RESOLVED active school (own school for School Admin, the
  // picked school for Super Admin) — never the raw, possibly-null/placeholder
  // profile.school_id — so this can never send "*" to a uuid filter.
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const live = useCanonicalRows('classes', schoolId, { enabled: isLive });
  const liveEnrollments = useCanonicalRows('student_enrollments', schoolId, { enabled: isLive, watch: ['admissions'] });

  const liveCards = useMemo(() => {
    if (!isLive) return [];
    const activeRows = live.rows.filter((r) => r.status !== 'archived');
    const activeEnrollments = liveEnrollments.rows.filter((e) => e.status === 'active');
    return activeRows.map((r, i) => {
      const count = activeEnrollments.filter((e) => e.class_id === r.id).length;
      // demo card layout + [7]=school_id, [8]=canonical class id
      return [r.name, r.code || '', r.code || 'Fasal', count, r.capacity || 0, LIVE_COLORS[i % LIVE_COLORS.length], null, r.school_id, r.id];
    });
  }, [isLive, live.rows, liveEnrollments.rows]);

  const source = isLive ? liveCards : classes;
  const list = source.filter((cl) => cl[0].toLowerCase().includes(q.toLowerCase()));

  // only Super Admin / School Admin may create a class; in LIVE mode the
  // authenticated DATABASE role decides, scoped to the RESOLVED active school
  // (School Admin's own, or the one a Super Admin picked).
  const canCreate = isLive
    ? ((roleKey === 'schooladmin' || roleKey === 'superadmin') && !!schoolId)
    : canPerformAction(profile, 'classes.create');

  const addClass = (cls) => setClasses([cls, ...classes]);

  // Super Admin: no school picked yet → the instruction/selection state,
  // never a query with a placeholder school_id.
  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Fasallada" subtitle={`${source.length} fasal`} />
        <SuperAdminSchoolBar />
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
        {isLive && live.loading ? (
          <View style={styles.liveState}><ActivityIndicator color={c.blue} /></View>
        ) : isLive && live.error ? (
          <View style={styles.liveState}>
            <Text style={[styles.liveErr, { color: c.rose }]}>{live.error}</Text>
            <TouchableOpacity onPress={live.reload}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => String(item[8] || item[0])}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 90 }}
            ListEmptyComponent={isLive ? (
              <Text style={[styles.empty, { color: c.muted }]}>Weli fasal lama abuurin. Riix + si aad ugu darto fasalka ugu horreeya.</Text>
            ) : null}
            renderItem={({ item }) => (
              <ClassCard cls={item} onPress={(cls) => navigation.navigate('ClassDetail',
                isLive ? { classId: cls[8] } : { cls })} />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Add Class is hidden for Teacher / Accountant / Parent / Student */}
      {canCreate ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}

      {canCreate ? <AddClassModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={addClass} onSaved={live.reload} schoolId={schoolId} /> : null}
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
  liveState: { alignItems: 'center', padding: 28 },
  liveErr: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 19 },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 30 },
});
