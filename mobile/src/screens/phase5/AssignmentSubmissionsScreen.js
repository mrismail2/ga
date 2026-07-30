/* Assignment submissions and grading — real Supabase workflow.
   Student submissions use the atomic submit_assignment_work RPC, which derives
   the signed-in student, enforces enrollment/resubmission policy and writes
   optional attachment metadata. Teacher/Admin grading uses the dedicated RPC.
   No local canonical data and no student-writable grading fields. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import {
  listSubmissions, listAssignmentAttachments, createAssignmentAttachment,
  listSubmissionAttachments, submitAssignmentWork, gradeAssignmentSubmission,
  p5FriendlyError,
} from '../../services/phase5';
const { canMarkAttendance } = require('../../domain/phase5Access');

export default function AssignmentSubmissionsScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const assignment = (route && route.params && route.params.assignment) || null;
  const isGrader = canMarkAttendance(roleKey);
  const isStudent = roleKey === 'student';

  const [subs, setSubs] = useState([]);
  const [studentNames, setStudentNames] = useState({});
  const [assignmentFiles, setAssignmentFiles] = useState([]);
  const [submissionFiles, setSubmissionFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [grades, setGrades] = useState({});
  const [rowMsg, setRowMsg] = useState({});

  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);
  const [submitOk, setSubmitOk] = useState('');

  const [assignmentFileName, setAssignmentFileName] = useState('');
  const [assignmentStoragePath, setAssignmentStoragePath] = useState('');
  const [assignmentMime, setAssignmentMime] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentMsg, setAttachmentMsg] = useState('');

  const maxScore = assignment && assignment.max_score != null ? Number(assignment.max_score) : null;

  const load = useCallback(async () => {
    if (!isLive || !schoolId || !assignment) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const [list, aFiles] = await Promise.all([
        listSubmissions(schoolId, { assignment_id: assignment.id }),
        listAssignmentAttachments(schoolId, { assignment_id: assignment.id }),
      ]);
      setSubs(list);
      setAssignmentFiles(aFiles);
      const init = {};
      list.forEach((s) => { init[s.id] = { score: s.score != null ? String(s.score) : '', feedback: s.feedback || '' }; });
      setGrades(init);
      if (isGrader) {
        const students = await p4List('students', schoolId);
        const names = {}; students.forEach((st) => { names[st.id] = st.full_name; });
        setStudentNames(names);
      }
      const filePairs = await Promise.all(list.map(async (s) => {
        try { return [s.id, await listSubmissionAttachments(schoolId, { submission_id: s.id })]; }
        catch (_e) { return [s.id, []]; }
      }));
      setSubmissionFiles(Object.fromEntries(filePairs));
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, assignment, isGrader]);
  useEffect(() => { load(); }, [load]);

  const addAssignmentAttachment = async () => {
    if (attachmentBusy) return;
    setAttachmentMsg('');
    if (!assignmentFileName.trim() || !assignmentStoragePath.trim()) {
      setAttachmentMsg('Magaca faylka iyo storage path waa qasab.'); return;
    }
    setAttachmentBusy(true);
    try {
      await createAssignmentAttachment({
        school_id: schoolId, assignment_id: assignment.id,
        file_name: assignmentFileName.trim(), storage_path: assignmentStoragePath.trim(),
        mime_type: mimeType.trim() || null,
      });
      setAssignmentFileName(''); setAssignmentStoragePath(''); setAssignmentMime('');
      setAttachmentMsg('Lifaaqa shaqada waa la kaydiyay.');
      await load();
    } catch (e) { setAttachmentMsg(p5FriendlyError(e)); }
    finally { setAttachmentBusy(false); }
  };

  const submitWork = async () => {
    if (submitting) return;
    setSubmitErr(null); setSubmitOk('');
    const attachmentProvided = fileName.trim() || storagePath.trim() || mimeType.trim();
    if (!content.trim() && !attachmentProvided) { setSubmitErr('Qor shaqada ama ku dar lifaaq.'); return; }
    if (attachmentProvided && (!fileName.trim() || !storagePath.trim())) {
      setSubmitErr('Lifaaqa: magaca faylka iyo storage path waa qasab.'); return;
    }
    setSubmitting(true);
    try {
      const attachments = attachmentProvided ? [{
        file_name: fileName.trim(), storage_path: storagePath.trim(), mime_type: mimeType.trim() || null,
      }] : [];
      await submitAssignmentWork(schoolId, { assignmentId: assignment.id, content: content.trim() || null, attachments });
      setSubmitOk(subs.length ? 'Dib-u-gudbinta waa la kaydiyay.' : 'Shaqada waa la gudbiyay.');
      setContent(''); setFileName(''); setStoragePath(''); setMimeType('');
      await load();
    } catch (e) { setSubmitErr(p5FriendlyError(e)); }
    finally { setSubmitting(false); }
  };

  const gradeOne = async (sub, returnForRevision = false) => {
    if (busyId) return;
    const g = grades[sub.id] || { score: '', feedback: '' };
    setRowMsg((m) => ({ ...m, [sub.id]: null }));
    const raw = (g.score || '').trim();
    let val = null;
    if (!returnForRevision) {
      if (raw === '') { setRowMsg((m) => ({ ...m, [sub.id]: 'Geli dhibcaha.' })); return; }
      val = Number(raw);
      if (Number.isNaN(val) || val < 0) { setRowMsg((m) => ({ ...m, [sub.id]: 'Dhibcaha waa inuu lambar togan noqdaa.' })); return; }
      if (maxScore != null && val > maxScore) { setRowMsg((m) => ({ ...m, [sub.id]: `Ugu badan ${maxScore}.` })); return; }
    }
    setBusyId(sub.id);
    try {
      await gradeAssignmentSubmission(schoolId, {
        submissionId: sub.id, score: val, feedback: (g.feedback || '').trim() || null,
        returnForRevision,
      });
      setRowMsg((m) => ({ ...m, [sub.id]: returnForRevision ? 'Dib-u-eegis ayaa loo celiyay ✓' : 'La qiimeeyay ✓' }));
      await load();
    } catch (e) { setRowMsg((m) => ({ ...m, [sub.id]: p5FriendlyError(e) })); }
    finally { setBusyId(null); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }
  const back = () => { if (navigation && navigation.goBack) navigation.goBack(); };
  const canSubmit = isStudent && (subs.length === 0 || assignment?.allow_resubmission);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headRow}>
          <TouchableOpacity onPress={back} style={[styles.backBtn, { borderColor: c.line }]}>
            <Icon name="back" size={16} color={c.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScreenHeader title={isGrader ? 'Qiimaynta shaqada' : 'Gudbi shaqada'} subtitle={assignment ? assignment.title : 'Shaqo-guri'} />
          </View>
        </View>

        {!assignment ? <StateBox c={c} text="Shaqo-guri lama dooran." />
          : loading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
          : loadErr ? <StateBox c={c} text={loadErr} error onRetry={load} />
          : <>
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.lbl, { color: c.muted }]}>LIFAAQYADA SHAQADA</Text>
                {assignmentFiles.length ? assignmentFiles.map((f) => (
                  <Text key={f.id} style={[styles.fileTxt, { color: c.ink }]}>• {f.file_name}{f.mime_type ? ` · ${f.mime_type}` : ''}</Text>
                )) : <Text style={[styles.subContent, { color: c.muted }]}>Lifaaq lama gelin.</Text>}
                {isGrader ? <>
                  <TextInput value={assignmentFileName} onChangeText={setAssignmentFileName} placeholder="Magaca faylka" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TextInput value={assignmentStoragePath} onChangeText={setAssignmentStoragePath} placeholder="Storage path" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TextInput value={assignmentMime} onChangeText={setAssignmentMime} placeholder="MIME type (ikhtiyaari)" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  {attachmentMsg ? <Text style={[styles.rowMsg, { color: c.muted }]}>{attachmentMsg}</Text> : null}
                  <TouchableOpacity onPress={addAssignmentAttachment} disabled={attachmentBusy}
                    style={[styles.secondaryBtn, { borderColor: c.blue, opacity: attachmentBusy ? 0.6 : 1 }]}>
                    {attachmentBusy ? <ActivityIndicator color={c.blue} size="small" /> : <Text style={[styles.secondaryTxt, { color: c.blue }]}>Ku dar lifaaq</Text>}
                  </TouchableOpacity>
                </> : null}
              </View>

              {isGrader ? (
                subs.length === 0 ? <StateBox c={c} text="Weli arday shaqada ma gudbin." /> : <>
                  <Text style={[styles.hint, { color: c.muted }]}>{subs.length} gudbin{maxScore != null ? ` · buuxa ${maxScore}` : ''}</Text>
                  {subs.map((s) => {
                    const g = grades[s.id] || { score: '', feedback: '' };
                    const busy = busyId === s.id;
                    return <View key={s.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                      <Text style={[styles.stuName, { color: c.ink }]}>{studentNames[s.student_id] || 'Arday'} · isku day {s.attempt}</Text>
                      {s.content ? <Text style={[styles.subContent, { color: c.muted }]}>{s.content}</Text> : null}
                      {(submissionFiles[s.id] || []).map((f) => <Text key={f.id} style={[styles.fileTxt, { color: c.blue }]}>📎 {f.file_name}</Text>)}
                      <View style={styles.gradeRow}>
                        <TextInput value={g.score} onChangeText={(t) => setGrades((m) => ({ ...m, [s.id]: { ...g, score: t } }))}
                          placeholder="dhibco" placeholderTextColor={c.muted2} keyboardType="numeric"
                          style={[styles.scoreInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                        <TextInput value={g.feedback} onChangeText={(t) => setGrades((m) => ({ ...m, [s.id]: { ...g, feedback: t } }))}
                          placeholder="faallo" placeholderTextColor={c.muted2}
                          style={[styles.fbInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                      </View>
                      <View style={styles.actionsRow}>
                        <TouchableOpacity onPress={() => gradeOne(s, false)} disabled={busy}
                          style={[styles.saveBtn, { backgroundColor: c.blue, opacity: busy ? 0.6 : 1 }]}>
                          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Qiimee</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => gradeOne(s, true)} disabled={busy}
                          style={[styles.secondaryBtn, { borderColor: c.orange || c.blue, opacity: busy ? 0.6 : 1 }]}>
                          <Text style={[styles.secondaryTxt, { color: c.orange || c.blue }]}>Dib u celi</Text>
                        </TouchableOpacity>
                      </View>
                      {rowMsg[s.id] ? <Text style={[styles.rowMsg, { color: c.muted }]}>{rowMsg[s.id]}</Text> : null}
                    </View>;
                  })}
                </>
              ) : <>
                {subs.length > 0 ? <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.lbl, { color: c.muted }]}>GUDBINNADAADA</Text>
                  {subs.map((s) => <View key={s.id} style={styles.attemptBox}>
                    <Text style={[styles.stuName, { color: c.ink }]}>Isku day {s.attempt} · {s.status}</Text>
                    {s.content ? <Text style={[styles.subContent, { color: c.ink }]}>{s.content}</Text> : null}
                    {(submissionFiles[s.id] || []).map((f) => <Text key={f.id} style={[styles.fileTxt, { color: c.blue }]}>📎 {f.file_name}</Text>)}
                    <Text style={[styles.gradeTxt, { color: s.score != null ? c.green : c.muted }]}>
                      {s.score != null ? `Natiijo: ${s.score}${maxScore != null ? '/' + maxScore : ''}` : s.status === 'returned' ? 'Dib-u-eegis ayaa lagaa rabaa' : 'Weli lama qiimeyn'}
                    </Text>
                    {s.feedback ? <Text style={[styles.subContent, { color: c.muted }]}>Faallo: {s.feedback}</Text> : null}
                  </View>)}
                </View> : null}
                {canSubmit ? <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.lbl, { color: c.muted }]}>{subs.length ? 'DIB-U-GUDBIN' : 'QOR SHAQADAADA'}</Text>
                  <TextInput value={content} onChangeText={setContent} placeholder="Halkan ku qor jawaabtaada…" placeholderTextColor={c.muted2}
                    multiline style={[styles.textArea, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TextInput value={fileName} onChangeText={setFileName} placeholder="Magaca lifaaqa (ikhtiyaari)" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TextInput value={storagePath} onChangeText={setStoragePath} placeholder="Storage path lifaaqa" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  <TextInput value={mimeType} onChangeText={setMimeType} placeholder="MIME type (ikhtiyaari)" placeholderTextColor={c.muted2}
                    style={[styles.lineInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  {submitErr ? <Text style={[styles.err, { color: c.rose }]}>{submitErr}</Text> : null}
                  {submitOk ? <Text style={[styles.okTxt, { color: c.green }]}>{submitOk}</Text> : null}
                  <TouchableOpacity onPress={submitWork} disabled={submitting}
                    style={[styles.submitBtn, { backgroundColor: c.blue, opacity: submitting ? 0.7 : 1 }]}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>{subs.length ? 'Dib u gudbi' : 'Gudbi shaqada'}</Text>}
                  </TouchableOpacity>
                </View> : isStudent && subs.length > 0 ? <StateBox c={c} text="Dib-u-gudbin looma oggola shaqadan." /> : null}
              </>}
            </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateBox({ c, text, error = false, onRetry }) {
  return <View style={[styles.box, { backgroundColor: error ? c.roseSoft : c.surface, borderColor: c.line }]}>
    <Text style={[styles.boxSub, { color: error ? c.rose : c.muted }]}>{text}</Text>
    {onRetry ? <TouchableOpacity onPress={onRetry}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity> : null}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', paddingVertical: 40 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 12 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 }, retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  hint: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  stuName: { fontSize: 14, fontWeight: '800' }, subContent: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 19 },
  fileTxt: { fontSize: 12.5, fontWeight: '700', marginTop: 5 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  scoreInput: { width: 78, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, textAlign: 'center' },
  fbInput: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 13 },
  lineInput: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, fontSize: 13, marginTop: 8 },
  saveBtn: { height: 42, minWidth: 84, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryBtn: { minHeight: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, marginTop: 8 },
  secondaryTxt: { fontSize: 12.5, fontWeight: '800' }, saveTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rowMsg: { fontSize: 11.5, fontWeight: '700', marginTop: 6 }, gradeTxt: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  textArea: { minHeight: 96, borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 14, textAlignVertical: 'top', marginTop: 4 },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 10 }, okTxt: { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  attemptBox: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ccd3df', paddingTop: 8, marginTop: 8 },
});
