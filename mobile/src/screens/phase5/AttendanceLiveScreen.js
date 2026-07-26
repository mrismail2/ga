/* Xaadiris (Live) — real Supabase attendance.
   Teacher/admin picks a class + date, the ACTIVE-enrollment roster loads,
   each student is marked present/absent/late/excused, and the whole session
   saves atomically through save_attendance_session_atomic (which also creates
   the automatic parent absence notifications). No demo data, no device-local storage. */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { SaveButton, SuccessNote, ErrorNote } from '../../components/Phase5Scaffold';
import { p4List, p4ActiveEnrollments } from '../../services/phase4';
import { saveAttendanceSession, p5FriendlyError } from '../../services/phase5';

const STATUSES = [
  { key: 'present', label: 'Jooga', tone: '#16A34A' },
  { key: 'absent', label: 'Maqan', tone: '#E5484D' },
  { key: 'late', label: 'Daahay', tone: '#CFAD5E' },
  { key: 'excused', label: 'Erid', tone: '#2F6BF0' },
];

export default function AttendanceLiveScreen() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [classes, setClasses] = useState([]);
  const [classLoading, setClassLoading] = useState(true);
  const [classErr, setClassErr] = useState(null);
  const [activeClass, setActiveClass] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [marks, setMarks] = useState({}); // student_id -> status
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [success, setSuccess] = useState('');

  const loadClasses = useCallback(async () => {
    if (!isLive || !schoolId) { setClassLoading(false); return; }
    setClassLoading(true); setClassErr(null);
    try { setClasses(await p4List('classes', schoolId)); }
    catch (e) { setClassErr(p5FriendlyError(e)); }
    finally { setClassLoading(false); }
  }, [isLive, schoolId]);
  React.useEffect(() => { loadClasses(); }, [loadClasses]);

  const loadRoster = useCallback(async (cls) => {
    setActiveClass(cls); setRoster([]); setMarks({}); setSuccess(''); setSaveErr(null);
    if (!cls) return;
    setRosterLoading(true);
    try {
      const [students, enrollments] = await Promise.all([
        p4List('students', schoolId),
        p4ActiveEnrollments(schoolId),
      ]);
      const inClass = new Set(enrollments.filter((e) => e.class_id === cls.id).map((e) => e.student_id));
      const list = students.filter((s) => inClass.has(s.id));
      setRoster(list);
      const init = {}; list.forEach((s) => { init[s.id] = 'present'; });
      setMarks(init);
    } catch (e) { setSaveErr(p5FriendlyError(e)); }
    finally { setRosterLoading(false); }
  }, [schoolId]);

  const setMark = (sid, status) => setMarks((m) => ({ ...m, [sid]: status }));

  const save = async () => {
    if (saving || !activeClass || roster.length === 0) return;
    setSaving(true); setSaveErr(null); setSuccess('');
    try {
      const records = roster.map((s) => ({ student_id: s.id, status: marks[s.id] || 'present' }));
      const res = await saveAttendanceSession(schoolId, {
        classId: activeClass.id, sessionDate: date, records,
        academicYearId: activeClass.academic_year_id || null,
      });
      const absent = records.filter((r) => r.status === 'absent').length;
      setSuccess(`Xaadiriska waa la kaydiyay. Maqan: ${absent}. Ogeysiisyo waalid: ${res.notifications_created || 0}.`);
    } catch (e) { setSaveErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    roster.forEach((s) => { counts[marks[s.id] || 'present'] += 1; });
    return counts;
  }, [roster, marks]);

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Xaadiris" subtitle={activeClass ? activeClass.name : 'Dooro fasal'} />
        <SuperAdminSchoolBar />

        {!activeClass ? (
          classLoading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
          : classErr ? (
            <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
              <Text style={[styles.boxSub, { color: c.rose }]}>{classErr}</Text>
              <TouchableOpacity onPress={loadClasses}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
            </View>
          ) : classes.length === 0 ? (
            <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="attendance" size={26} color={c.muted2} />
              <Text style={[styles.boxSub, { color: c.muted }]}>Weli fasal lama abuurin.</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.lbl, { color: c.muted }]}>DOORO FASALKA</Text>
              {classes.map((cl) => (
                <TouchableOpacity key={cl.id} onPress={() => loadRoster(cl)} activeOpacity={0.85}
                  style={[styles.classRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.className, { color: c.ink }]}>{cl.name}</Text>
                  <Icon name="back" size={16} color={c.muted2} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
              ))}
            </>
          )
        ) : (
          <>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => loadRoster(null)} style={[styles.backBtn, { borderColor: c.line }]}>
                <Icon name="back" size={16} color={c.ink} />
              </TouchableOpacity>
              <View style={[styles.dateBox, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="clock" size={15} color={c.muted} />
                <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted2}
                  style={[styles.dateInput, { color: c.ink }]} />
              </View>
            </View>

            {rosterLoading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
            : roster.length === 0 ? (
              <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.boxSub, { color: c.muted }]}>Fasalkan weli arday firfircoon kuma jiro.</Text>
              </View>
            ) : (
              <>
                <View style={styles.chips}>
                  {STATUSES.map((s) => (
                    <View key={s.key} style={[styles.chip, { borderColor: c.line }]}>
                      <View style={[styles.chipDot, { backgroundColor: s.tone }]} />
                      <Text style={[styles.chipTxt, { color: c.ink }]}>{s.label}: {summary[s.key]}</Text>
                    </View>
                  ))}
                </View>
                {roster.map((s) => (
                  <View key={s.id} style={[styles.stuRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{s.full_name}</Text>
                    <View style={styles.seg}>
                      {STATUSES.map((st) => {
                        const on = (marks[s.id] || 'present') === st.key;
                        return (
                          <TouchableOpacity key={st.key} onPress={() => setMark(s.id, st.key)}
                            style={[styles.segBtn, { backgroundColor: on ? st.tone : 'transparent', borderColor: on ? st.tone : c.line }]}>
                            <Text style={[styles.segTxt, { color: on ? '#fff' : c.muted }]}>{st.label[0]}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <ErrorNote text={saveErr} />
                <SuccessNote text={success} />
                <SaveButton onPress={save} saving={saving} label="Kaydi Xaadiriska" />
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  state: { alignItems: 'center', paddingVertical: 40 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 12 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  lbl: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8, marginTop: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9 },
  className: { fontSize: 15, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  dateInput: { flex: 1, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipTxt: { fontSize: 11.5, fontWeight: '700' },
  stuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8 },
  stuName: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  seg: { flexDirection: 'row', gap: 5 },
  segBtn: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segTxt: { fontSize: 13, fontWeight: '800' },
});
