/* Jadwalka imtixaanka — per-exam schedule entry (§9).
   Reached from the exams list ("Qorshee") by an Admin. Lists the sittings
   already scheduled for the exam and lets an admin add a new one
   (date + optional start/end/room) through create_exam_schedule's insert
   path. The schedule inherits the exam's class/subject/teacher so it stays
   consistent with the exam it belongs to. RLS remains the authority; a
   non-admin who deep-links here gets a read-only notice. No demo data. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { listExamSchedules, createExamSchedule, p5FriendlyError } from '../../services/phase5';
const { canCreateModule } = require('../../domain/phase5Access');

export default function ExamScheduleScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const exam = (route && route.params && route.params.exam) || null;
  const isAdmin = canCreateModule(roleKey, undefined); // admin-only module default

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [date, setDate] = useState('');
  const [startT, setStartT] = useState('');
  const [endT, setEndT] = useState('');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!isLive || !schoolId || !exam) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try { setRows(await listExamSchedules(schoolId, { exam_id: exam.id })); }
    catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, exam]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (saving) return;
    setFormErr(null); setSuccess('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { setFormErr('Taariikhda: qaabka waa YYYY-MM-DD.'); return; }
    if (startT.trim() && !/^\d{2}:\d{2}$/.test(startT.trim())) { setFormErr('Bilowga: qaabka waa HH:MM.'); return; }
    if (endT.trim() && !/^\d{2}:\d{2}$/.test(endT.trim())) { setFormErr('Dhammaadka: qaabka waa HH:MM.'); return; }
    setSaving(true);
    try {
      await createExamSchedule({
        school_id: schoolId, exam_id: exam.id, class_id: exam.class_id, subject_id: exam.subject_id,
        teacher_id: exam.teacher_id || null, academic_year_id: exam.academic_year_id || null, term_id: exam.term_id || null,
        exam_date: date.trim(), start_time: startT.trim() || null, end_time: endT.trim() || null, room: room.trim() || null,
      });
      setSuccess('Waa la qorsheeyay.');
      setDate(''); setStartT(''); setEndT(''); setRoom('');
      await load();
    } catch (e) { setFormErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }
  const back = () => { if (navigation && navigation.goBack) navigation.goBack(); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.headRow}>
          <TouchableOpacity onPress={back} style={[styles.backBtn, { borderColor: c.line }]}>
            <Icon name="back" size={16} color={c.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ScreenHeader title="Jadwalka imtixaanka" subtitle={exam ? exam.title : 'Imtixaan'} />
          </View>
        </View>

        {!exam ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.boxSub, { color: c.muted }]}>Imtixaan lama dooran.</Text>
          </View>
        ) : (
          <>
            {isAdmin ? (
              <View style={[styles.form, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Text style={[styles.lbl, { color: c.muted }]}>TAARIIKHDA (YYYY-MM-DD) *</Text>
                <TextInput value={date} onChangeText={setDate} placeholder="2026-11-01" placeholderTextColor={c.muted2}
                  style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbl, { color: c.muted }]}>BILOW (HH:MM)</Text>
                    <TextInput value={startT} onChangeText={setStartT} placeholder="08:00" placeholderTextColor={c.muted2}
                      style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbl, { color: c.muted }]}>DHAMMAAD (HH:MM)</Text>
                    <TextInput value={endT} onChangeText={setEndT} placeholder="10:00" placeholderTextColor={c.muted2}
                      style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                  </View>
                </View>
                <Text style={[styles.lbl, { color: c.muted }]}>QOLKA</Text>
                <TextInput value={room} onChangeText={setRoom} placeholder="ikhtiyaari" placeholderTextColor={c.muted2}
                  style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
                {formErr ? <Text style={[styles.err, { color: c.rose }]}>{formErr}</Text> : null}
                {success ? <Text style={[styles.okTxt, { color: c.green }]}>{success}</Text> : null}
                <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.9}
                  style={[styles.saveBtn, { backgroundColor: c.blue, opacity: saving ? 0.7 : 1 }]}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Ku dar jadwal</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.readonly, { color: c.muted }]}>Kaliya maamulka ayaa jadwal dari kara.</Text>
            )}

            {loading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
            : loadErr ? (
              <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
                <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
                <TouchableOpacity onPress={load}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
              </View>
            ) : rows.length === 0 ? (
              <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="clock" size={24} color={c.muted2} />
                <Text style={[styles.boxSub, { color: c.muted }]}>Weli jadwal lama dhigin.</Text>
              </View>
            ) : (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
                {rows.map((r, i) => (
                  <View key={r.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
                    <Text style={[styles.rowTitle, { color: c.ink }]}>{r.exam_date}</Text>
                    <Text style={[styles.rowSub, { color: c.muted }]}>
                      {[(r.start_time || '').slice(0, 5), (r.end_time || '').slice(0, 5)].filter(Boolean).join('–') || '—'}
                      {r.room ? ' · ' + r.room : ''}
                    </Text>
                  </View>
                ))}
              </View>
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
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  form: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 4 },
  input: { height: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 14 },
  timeRow: { flexDirection: 'row', gap: 10 },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  okTxt: { fontSize: 12.5, fontWeight: '700', marginTop: 10 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  readonly: { fontSize: 13, fontWeight: '600', marginBottom: 12 },
  state: { alignItems: 'center', paddingVertical: 30 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 6 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
});
