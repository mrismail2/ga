/* Transcripts — University Mode only. Lists issued transcripts and lets a
   university admin issue one for a student (snapshotting published course
   results). School Mode never reaches this screen (nav is role/mode-aware).
   Real Supabase data only. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listTranscripts, issueTranscript, p5FriendlyError } from '../../services/phase5';

export default function TranscriptsScreen() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const isAdmin = roleKey === 'schooladmin' || roleKey === 'superadmin';
  const { data, loading, error, reload } = useAsyncData(
    async () => ({
      transcripts: await listTranscripts(schoolId),
      students: isAdmin ? await p4List('university_students', schoolId) : [],
    }),
    [schoolId], { enabled: isLive && !!schoolId },
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const rows = (data && data.transcripts) || [];
  const students = (data && data.students) || [];

  const issue = async (stu) => {
    if (busy) return;
    setBusy(true); setNote('');
    try { await issueTranscript(schoolId, { studentId: stu.id }); setNote(`Transcript loo sameeyay ${stu.full_name}.`); await reload(); }
    catch (e) { setNote(p5FriendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Phase5Screen title="Transcripts" subtitle="Diiwaanka natiijada jaamacadda" icon="download"
      loading={loading} error={error} onRetry={reload} empty={false}>
      {note ? <View style={[styles.note, { backgroundColor: c.blueSoft }]}><Text style={[styles.noteTxt, { color: c.blue }]}>{note}</Text></View> : null}

      {isAdmin && students.length > 0 ? (
        <>
          <Text style={[styles.section, { color: c.ink }]}>Samee transcript</Text>
          {students.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => issue(s)} disabled={busy} activeOpacity={0.85}
              style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[styles.rowTitle, { color: c.ink }]}>{s.full_name}</Text>
              {busy ? <ActivityIndicator color={c.blue} /> : <Icon name="download" size={16} color={c.blue} />}
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Text style={[styles.section, { color: c.ink, marginTop: 18 }]}>Transcripts la sameeyay ({rows.length})</Text>
      {rows.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.boxSub, { color: c.muted }]}>Weli transcript lama samayn.</Text>
        </View>
      ) : rows.map((r) => (
        <View key={r.id} style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View>
            <Text style={[styles.rowTitle, { color: c.ink }]}>GPA: {r.gpa == null ? '—' : r.gpa}</Text>
            <Text style={[styles.rowSub, { color: c.muted }]}>Credits: {r.total_credits} · {String(r.issued_at).slice(0, 10)}</Text>
          </View>
        </View>
      ))}
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  note: { padding: 11, borderRadius: 11, marginBottom: 12 },
  noteTxt: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center' },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
