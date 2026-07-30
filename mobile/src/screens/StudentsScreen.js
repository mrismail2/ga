import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, TextInput, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import StudentRow from '../components/StudentRow';
import StudentProfileModal from '../components/StudentProfileModal';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../components/SchoolSelector';
import { getClassDisplayName } from '../data/identity';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { filterStudentsForProfile } from '../utils/dataSelectors';
import useCanonicalRows from '../hooks/useCanonicalRows';
import useActiveSchoolId from '../hooks/useActiveSchoolId';

/* Ardayda.

   DEMO mode: the Phase 1/2 central AsyncStorage store, unchanged.

   LIVE mode: ONLY the canonical `students` rows of the authenticated
   school — the SAME rows Maamulka Dugsiga and Admissions write. A student
   admitted through Admissions appears here immediately (canonical change
   bus) and persists after refresh. Attendance has no live source yet so
   it shows '—', never a fake number. */
export default function StudentsScreen() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { data: appData } = useAppData();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  // LIVE: canonical students + classes (for the class display name).
  // schoolId is the RESOLVED active school (own school for School Admin, the
  // picked school for Super Admin) — never the raw profile.school_id.
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const live = useCanonicalRows('students', schoolId, { enabled: isLive, watch: ['admissions'] });
  const liveClasses = useCanonicalRows('classes', schoolId, { enabled: isLive });
  const liveEnrollments = useCanonicalRows('student_enrollments', schoolId, { enabled: isLive, watch: ['students', 'admissions'] });

  // role + school isolation from the ONE central store: every student, then
  // filtered to what this profile may see (a school_001 user never sees 002).
  const data = useMemo(() => {
    if (isLive) {
      const classNames = {};
      liveClasses.rows.forEach((cl) => { classNames[cl.id] = cl.name; });
      const activeByStudent = new Map(
        liveEnrollments.rows.filter((e) => e.status === 'active').map((e) => [e.student_id, e]),
      );
      return live.rows
        .filter((student) => activeByStudent.has(student.id))
        .map((student) => {
          const enrollment = activeByStudent.get(student.id);
          return {
            ...student,
            class_id: enrollment.class_id,
            stream_id: enrollment.stream_id,
            academic_year_id: enrollment.academic_year_id,
            student_internal_id: student.id,
            name: student.full_name,
            att: null,
            className: (enrollment.class_id && classNames[enrollment.class_id]) || '—',
          };
        });
    }
    return filterStudentsForProfile(profile, appData.students).map((s) => ({ ...s, className: getClassDisplayName(s.class_id) }));
  }, [isLive, live.rows, liveClasses.rows, liveEnrollments.rows, profile, appData.students]);
  const list = data.filter((s) => (s.name || '').toLowerCase().includes(q.toLowerCase()));

  // Super Admin: no school picked yet → the instruction/selection state,
  // never a query with a placeholder school_id.
  if (isLive && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Ardayda" subtitle={`${data.length} arday guud`} />
        <SuperAdminSchoolBar />
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
        {isLive && (live.loading || liveClasses.loading || liveEnrollments.loading) ? (
          <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
        ) : isLive && (live.error || liveClasses.error || liveEnrollments.error) ? (
          <View style={styles.state}>
            <Text style={{ color: c.rose, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{live.error || liveClasses.error || liveEnrollments.error}</Text>
            <TouchableOpacity onPress={() => { live.reload(); liveClasses.reload(); liveEnrollments.reload(); }}><Text style={{ color: c.blue, fontWeight: '800', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : null}
        <FlatList
          data={list}
          keyExtractor={(item, i) => item.student_internal_id || String(i)}
          ListEmptyComponent={isLive ? (
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 30 }}>
              Weli arday lama diiwaangelin. Ka diiwaangeli Admissions (Maamulka Dugsiga).
            </Text>
          ) : null}
          renderItem={({ item, index }) => (
            <StudentRow student={item} index={index} onPress={setSelected} liveMode={isLive} />
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
        liveMode={isLive}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  state: { alignItems: 'center', paddingVertical: 14 },
});
