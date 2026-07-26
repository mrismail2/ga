/* Natiijo-gelinta imtixaan — per-student result entry roster (§9).
   Reached from the exams list ("Natiijo geli") by a Teacher (for their
   assigned exam) or an Admin. Loads the ACTIVE-enrollment roster for the
   exam's class and enters one score per student through enter_result, the
   same SECURITY DEFINER RPC the workflow uses — so RLS remains the authority
   and a teacher can only write results for a pair they are assigned to.
   No demo data, no device-local storage; scores are saved one student at a
   time and each Save is duplicate-click protected. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { ErrorNote } from '../../components/Phase5Scaffold';
import { p4List, p4ActiveEnrollments } from '../../services/phase4';
import { listResults, enterResult, p5FriendlyError } from '../../services/phase5';
const { canMarkAttendance } = require('../../domain/phase5Access');

export default function ResultEntryScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const exam = (route && route.params && route.params.exam) || null;

  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [scores, setScores] = useState({}); // student_id -> string
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState({}); // student_id -> saved score
  const [rowErr, setRowErr] = useState({}); // student_id -> message

  const fullMarks = exam && exam.full_marks != null ? Number(exam.full_marks) : 100;

  const load = useCallback(async () => {
    if (!isLive || !schoolId || !exam) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const [students, enrollments, existing] = await Promise.all([
        p4List('students', schoolId),
        p4ActiveEnrollments(schoolId),
        listResults(schoolId, { exam_id: exam.id }),
      ]);
      const inClass = new Set(
        enrollments.filter((e) => e.class_id === exam.class_id).map((e) => e.student_id),
      );
      const list = students.filter((s) => inClass.has(s.id));
      setRoster(list);
      const priorScores = {}; const priorSaved = {};
      existing.forEach((r) => {
        if (r.score != null) { priorScores[r.student_id] = String(r.score); priorSaved[r.student_id] = r.score; }
      });
      setScores(priorScores);
      setSavedIds(priorSaved);
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, exam]);
  useEffect(() => { load(); }, [load]);

  const saveOne = async (student) => {
    if (savingId) return;
    const raw = (scores[student.id] || '').trim();
    setRowErr((m) => ({ ...m, [student.id]: null }));
    if (raw === '') { setRowErr((m) => ({ ...m, [student.id]: 'Geli dhibcaha.' })); return; }
    const val = Number(raw);
    if (isNaN(val)) { setRowErr((m) => ({ ...m, [student.id]: 'Dhibcaha waa inuu lambar noqdaa.' })); return; }
    if (val < 0 || val > fullMarks) { setRowErr((m) => ({ ...m, [student.id]: `Dhibcaha waa inuu u dhexeeyaa 0 – ${fullMarks}.` })); return; }
    setSavingId(student.id);
    try {
      await enterResult(schoolId, { examId: exam.id, studentId: student.id, score: val, maxScore: fullMarks });
      setSavedIds((m) => ({ ...m, [student.id]: val }));
    } catch (e) { setRowErr((m) => ({ ...m, [student.id]: p5FriendlyError(e) })); }
    finally { setSavingId(null); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  const back = () => { if (navigation && navigation.goBack) navigation.goBack(); };

  // Result entry is a marking action → Teacher/Admin only. A read role that
  // somehow reaches here (deep link) gets nothing to write.
  if (isLive && !canMarkAttendance(roleKey)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Natiijo-gelin" subtitle="Ma lihid oggolaansho" />
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.boxSub, { color: c.muted }]}>Kaliya macallinka/maamulka ayaa natiijo gelin kara.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.headRow}>
          <TouchableOpacity onPress={back} style={[styles.backBtn, { borderColor: c.line }]}>
            <Icon name="back" size={16} color={c.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScreenHeader title="Natiijo-gelin" subtitle={exam ? exam.title : 'Imtixaan'} />
          </View>
        </View>

        {!exam ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.boxSub, { color: c.muted }]}>Imtixaan lama dooran.</Text>
          </View>
        ) : loading ? (
          <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
        ) : loadErr ? (
          <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
            <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
            <TouchableOpacity onPress={load}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : roster.length === 0 ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="exams" size={26} color={c.muted2} />
            <Text style={[styles.boxSub, { color: c.muted }]}>Fasalkan weli arday firfircoon kuma jiro.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.hint, { color: c.muted }]}>Buuxa: {fullMarks} dhibcood · {roster.length} arday</Text>
            {roster.map((s) => {
              const saved = savedIds[s.id];
              const busy = savingId === s.id;
              return (
                <View key={s.id} style={[styles.stuRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{s.full_name}</Text>
                    {saved != null ? <Text style={[styles.savedTxt, { color: c.green }]}>La kaydiyay: {saved}</Text> : null}
                    {rowErr[s.id] ? <Text style={[styles.errTxt, { color: c.rose }]}>{rowErr[s.id]}</Text> : null}
                  </View>
                  <TextInput value={scores[s.id] || ''} onChangeText={(t) => setScores((m) => ({ ...m, [s.id]: t }))}
                    placeholder="0" placeholderTextColor={c.muted2} keyboardType="numeric"
                    style={[styles.scoreInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TouchableOpacity onPress={() => saveOne(s)} disabled={busy}
                    style={[styles.saveBtn, { backgroundColor: c.blue, opacity: busy ? 0.6 : 1 }]}>
                    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Kaydi</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
            <ErrorNote text={null} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', paddingVertical: 40 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 12 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  hint: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  stuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8 },
  stuName: { fontSize: 13.5, fontWeight: '700' },
  savedTxt: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  errTxt: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  scoreInput: { width: 70, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, textAlign: 'center' },
  saveBtn: { height: 42, minWidth: 62, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  saveTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
