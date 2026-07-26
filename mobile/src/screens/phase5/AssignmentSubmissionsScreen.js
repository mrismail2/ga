/* Gudbinta shaqo-guriga — assignment submissions + grading (§8).

   Two role experiences over the SAME screen, both real Supabase:
   • Student  → submits their own work (content) through create_submission,
     and sees the grade/feedback once a teacher marks it. Never grades.
   • Teacher/Admin → sees every submission for the assignment and grades each
     one (score ≤ max_score, optional feedback) through grade_submission.
   RLS is the authority: a student can only insert their own submission and a
   teacher can only grade an assignment they own. No demo data, no
   device-local storage; each Save is duplicate-click protected. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listSubmissions, createSubmission, gradeSubmission, p5FriendlyError } from '../../services/phase5';
const { canMarkAttendance } = require('../../domain/phase5Access');

export default function AssignmentSubmissionsScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const assignment = (route && route.params && route.params.assignment) || null;
  const isGrader = canMarkAttendance(roleKey); // teacher/admin grade; others submit

  const [subs, setSubs] = useState([]);
  const [studentNames, setStudentNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [grades, setGrades] = useState({}); // submission_id -> {score, feedback}
  const [rowMsg, setRowMsg] = useState({});
  // student submit state
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [submitOk, setSubmitOk] = useState('');

  const maxScore = assignment && assignment.max_score != null ? Number(assignment.max_score) : null;

  const load = useCallback(async () => {
    if (!isLive || !schoolId || !assignment) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const list = await listSubmissions(schoolId, { assignment_id: assignment.id });
      setSubs(list);
      const init = {};
      list.forEach((s) => { init[s.id] = { score: s.score != null ? String(s.score) : '', feedback: s.feedback || '' }; });
      setGrades(init);
      if (isGrader) {
        const students = await p4List('students', schoolId);
        const names = {}; students.forEach((st) => { names[st.id] = st.full_name; });
        setStudentNames(names);
      }
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, assignment, isGrader]);
  useEffect(() => { load(); }, [load]);

  const submitWork = async () => {
    if (submitting) return;
    setSubmitErr(null); setSubmitOk('');
    if (!content.trim()) { setSubmitErr('Qor shaqadaada ka hor gudbinta.'); return; }
    setSubmitting(true);
    try {
      await createSubmission({ school_id: schoolId, assignment_id: assignment.id, content: content.trim() });
      setSubmitOk('Shaqada waa la gudbiyay.');
      setContent('');
      await load();
    } catch (e) { setSubmitErr(p5FriendlyError(e)); }
    finally { setSubmitting(false); }
  };

  const gradeOne = async (sub) => {
    if (busyId) return;
    const g = grades[sub.id] || { score: '', feedback: '' };
    setRowMsg((m) => ({ ...m, [sub.id]: null }));
    const raw = (g.score || '').trim();
    if (raw === '') { setRowMsg((m) => ({ ...m, [sub.id]: 'Geli dhibcaha.' })); return; }
    const val = Number(raw);
    if (isNaN(val) || val < 0) { setRowMsg((m) => ({ ...m, [sub.id]: 'Dhibcaha waa inuu lambar togan noqdaa.' })); return; }
    if (maxScore != null && val > maxScore) { setRowMsg((m) => ({ ...m, [sub.id]: `Ugu badan ${maxScore}.` })); return; }
    setBusyId(sub.id);
    try {
      await gradeSubmission(sub.id, { score: val, feedback: (g.feedback || '').trim() || null, status: 'graded' });
      setRowMsg((m) => ({ ...m, [sub.id]: 'La qiimeeyay ✓' }));
      await load();
    } catch (e) { setRowMsg((m) => ({ ...m, [sub.id]: p5FriendlyError(e) })); }
    finally { setBusyId(null); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }
  const back = () => { if (navigation && navigation.goBack) navigation.goBack(); };
  const myMax = maxScore != null ? ` · buuxa ${maxScore}` : '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.headRow}>
          <TouchableOpacity onPress={back} style={[styles.backBtn, { borderColor: c.line }]}>
            <Icon name="back" size={16} color={c.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScreenHeader title={isGrader ? 'Qiimaynta shaqada' : 'Gudbi shaqada'} subtitle={assignment ? assignment.title : 'Shaqo-guri'} />
          </View>
        </View>

        {!assignment ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.boxSub, { color: c.muted }]}>Shaqo-guri lama dooran.</Text>
          </View>
        ) : loading ? (
          <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
        ) : loadErr ? (
          <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
            <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
            <TouchableOpacity onPress={load}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : isGrader ? (
          /* ---- teacher/admin: grade each submission ---- */
          subs.length === 0 ? (
            <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="note" size={24} color={c.muted2} />
              <Text style={[styles.boxSub, { color: c.muted }]}>Weli arday shaqada ma gudbin.</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.hint, { color: c.muted }]}>{subs.length} gudbin{myMax}</Text>
              {subs.map((s) => {
                const g = grades[s.id] || { score: '', feedback: '' };
                const busy = busyId === s.id;
                return (
                  <View key={s.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{studentNames[s.student_id] || 'Arday'}</Text>
                    {s.content ? <Text style={[styles.subContent, { color: c.muted }]}>{s.content}</Text> : null}
                    <View style={styles.gradeRow}>
                      <TextInput value={g.score} onChangeText={(t) => setGrades((m) => ({ ...m, [s.id]: { ...g, score: t } }))}
                        placeholder="dhibco" placeholderTextColor={c.muted2} keyboardType="numeric"
                        style={[styles.scoreInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                      <TextInput value={g.feedback} onChangeText={(t) => setGrades((m) => ({ ...m, [s.id]: { ...g, feedback: t } }))}
                        placeholder="faallo (ikhtiyaari)" placeholderTextColor={c.muted2}
                        style={[styles.fbInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                      <TouchableOpacity onPress={() => gradeOne(s)} disabled={busy}
                        style={[styles.saveBtn, { backgroundColor: c.blue, opacity: busy ? 0.6 : 1 }]}>
                        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Qiimee</Text>}
                      </TouchableOpacity>
                    </View>
                    {rowMsg[s.id] ? <Text style={[styles.rowMsg, { color: c.muted }]}>{rowMsg[s.id]}</Text> : null}
                  </View>
                );
              })}
            </>
          )
        ) : (
          /* ---- student: submit own work + see grade ---- */
          <>
            {subs.length > 0 ? (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.lbl, { color: c.muted }]}>GUDBINTAADA</Text>
                {subs.map((s) => (
                  <View key={s.id} style={{ marginTop: 6 }}>
                    {s.content ? <Text style={[styles.subContent, { color: c.ink }]}>{s.content}</Text> : null}
                    <Text style={[styles.gradeTxt, { color: s.score != null ? c.green : c.muted }]}>
                      {s.score != null ? `Natiijo: ${s.score}${maxScore != null ? '/' + maxScore : ''}` : 'Weli lama qiimeyn'}
                    </Text>
                    {s.feedback ? <Text style={[styles.subContent, { color: c.muted }]}>Faallo: {s.feedback}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[styles.lbl, { color: c.muted }]}>QOR SHAQADAADA</Text>
              <TextInput value={content} onChangeText={setContent} placeholder="Halkan ku qor jawaabtaada…" placeholderTextColor={c.muted2}
                multiline style={[styles.textArea, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
              {submitErr ? <Text style={[styles.err, { color: c.rose }]}>{submitErr}</Text> : null}
              {submitOk ? <Text style={[styles.okTxt, { color: c.green }]}>{submitOk}</Text> : null}
              <TouchableOpacity onPress={submitWork} disabled={submitting} activeOpacity={0.9}
                style={[styles.submitBtn, { backgroundColor: c.blue, opacity: submitting ? 0.7 : 1 }]}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Gudbi shaqada</Text>}
              </TouchableOpacity>
            </View>
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
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  stuName: { fontSize: 14, fontWeight: '800' },
  subContent: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 19 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  scoreInput: { width: 66, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, textAlign: 'center' },
  fbInput: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 13 },
  saveBtn: { height: 42, minWidth: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  saveTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rowMsg: { fontSize: 11.5, fontWeight: '700', marginTop: 6 },
  gradeTxt: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  textArea: { minHeight: 96, borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 14, textAlignVertical: 'top', marginTop: 4 },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  okTxt: { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
