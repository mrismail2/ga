/* Warbixinno — role-scoped, filterable reports over real Phase 1–5 data.
   Errors remain errors; a real no-row aggregate remains a real zero. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Icon from '../../components/Icon';
import Phase5Screen from '../../components/Phase5Scaffold';
import { p4List } from '../../services/phase4';
import {
  reportEnrollmentSummary, reportFeeBalanceSummary, reportTeacherAssignments, reportResultsSummary,
  reportAttendanceOverview, reportTimetableOverview, reportAssignmentOverview,
  reportPaymentOverview, reportDisciplineOverview, p5FriendlyError,
} from '../../services/phase5';

function exportRows(rows, filename) {
  const csv = 'metric,value\n' + rows.map(([k, v]) => `"${String(k).replace(/"/g, '""')}","${String(v ?? '').replace(/"/g, '""')}"`).join('\n');
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); return true;
  }
  try { const { Clipboard } = require('react-native'); if (Clipboard?.setString) { Clipboard.setString(csv); return true; } } catch (e) { /* unavailable */ }
  return false;
}
function Stat({ c, label, value }) { return <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}><Text style={[styles.statVal, { color: c.ink }]}>{value == null ? '—' : String(value)}</Text><Text style={[styles.statLbl, { color: c.muted }]}>{label}</Text></View>; }
function Choice({ c, label, rows, value, onChange, nameKey = 'name' }) { return <View style={{ marginBottom: 10 }}><Text style={[styles.label, { color: c.muted }]}>{label}</Text><View style={styles.choices}><TouchableOpacity onPress={() => onChange('')} style={[styles.choice, { borderColor: !value ? c.blue : c.line, backgroundColor: !value ? c.blueSoft : c.surface }]}><Text style={[styles.choiceTxt, { color: !value ? c.blue : c.muted }]}>Dhammaan</Text></TouchableOpacity>{rows.map((r) => { const on = value === r.id; return <TouchableOpacity key={r.id} onPress={() => onChange(on ? '' : r.id)} style={[styles.choice, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blueSoft : c.surface }]}><Text style={[styles.choiceTxt, { color: on ? c.blue : c.muted }]}>{r[nameKey] || r.id}</Text></TouchableOpacity>; })}</View></View>; }

export default function ReportsLiveScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const [years, setYears] = useState([]); const [terms, setTerms] = useState([]); const [classes, setClasses] = useState([]);
  const [yearId, setYearId] = useState(''); const [termId, setTermId] = useState(''); const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [exportMsg, setExportMsg] = useState('');

  useEffect(() => { setData(null); setError(''); setYearId(''); setTermId(''); setClassId(''); setFrom(''); setTo(''); }, [schoolId]);
  useEffect(() => {
    if (!isLive || !schoolId) return;
    let alive = true;
    Promise.all([p4List('academic_years', schoolId), p4List('terms', schoolId), p4List('classes', schoolId)])
      .then(([y, t, cl]) => { if (alive) { setYears(y); setTerms(t); setClasses(cl); } })
      .catch((e) => { if (alive) setError(p5FriendlyError(e)); });
    return () => { alive = false; };
  }, [isLive, schoolId]);

  const load = async () => {
    if (loading) return;
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) { setError('Taariikhda bilowga: qaabka waa YYYY-MM-DD.'); return; }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) { setError('Taariikhda dhammaadka: qaabka waa YYYY-MM-DD.'); return; }
    setLoading(true); setError(''); setExportMsg('');
    try {
      const [enrol, fees, teachers, results, attendance, timetable, assignments, payments, discipline] = await Promise.all([
        reportEnrollmentSummary(schoolId, yearId || null), reportFeeBalanceSummary(schoolId, yearId || null),
        reportTeacherAssignments(schoolId), reportResultsSummary(schoolId, termId || null),
        reportAttendanceOverview(schoolId, { classId: classId || null, from: from || null, to: to || null }),
        reportTimetableOverview(schoolId, { academicYearId: yearId || null, termId: termId || null }),
        reportAssignmentOverview(schoolId, { classId: classId || null, from: from || null, to: to || null }),
        reportPaymentOverview(schoolId, { from: from || null, to: to || null }),
        reportDisciplineOverview(schoolId, { from: from || null, to: to || null }),
      ]);
      setData({ enrol, fees, teachers, results, attendance, timetable, assignments, payments, discipline });
    } catch (e) { setError(p5FriendlyError(e)); setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (schoolId) load(); }, [schoolId]); // initial real report

  const metricRows = () => {
    if (!data) return [];
    const teacherRows = data.teachers?.teachers || []; const resultRows = data.results?.exams || [];
    return [
      ['Arday firfircoon', data.enrol?.total_active], ['Fasallo', data.enrol?.classes?.length || 0],
      ['Xaadiris guud', data.attendance?.total], ['Xaadir joogid %', data.attendance?.present_rate], ['Maqan', data.attendance?.absent],
      ['Jadwal entries', data.timetable?.entries], ['Xilliyo', data.timetable?.periods],
      ['Shaqo-guri', data.assignments?.assignments], ['Gudbino', data.assignments?.submissions], ['La saxay/graded', data.assignments?.graded],
      ['Natiijo exams', resultRows.length], ['Macallimiin', teacherRows.length],
      ['Wadarta biilasha', data.fees?.total_due], ['La bixiyay', data.fees?.total_paid], ['Hadhaaga', data.fees?.total_balance],
      ['Lacag-bixinno', data.payments?.payment_count], ['Lacag la helay', data.payments?.amount_received], ['Lacag celin', data.payments?.reversed_count],
      ['Kiisaska', data.discipline?.total], ['Kiisas furan', data.discipline?.open], ['Kiisas xiran', data.discipline?.resolved],
    ];
  };
  const doExport = () => { const ok = exportRows(metricRows(), `kobciye-warbixin-${new Date().toISOString().slice(0, 10)}.csv`); setExportMsg(ok ? (Platform.OS === 'web' ? 'CSV waa la soo dejiyay.' : 'CSV waa la nuqul-qaaday.') : 'Soo dejinta lagama awoodin.'); };

  return <Phase5Screen title="Warbixinno" subtitle="Xogta dhabta ah iyo filtarrada" icon="reports" loading={false} error={null} empty={false}>
    <View style={[styles.filterCard, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Choice c={c} label="SANNAD-DUGSIYEEDKA" rows={years} value={yearId} onChange={setYearId} />
      <Choice c={c} label="TERM-KA" rows={terms} value={termId} onChange={setTermId} />
      <Choice c={c} label="FASALKA" rows={classes} value={classId} onChange={setClassId} />
      <View style={styles.dateRow}><View style={{ flex: 1 }}><Text style={[styles.label, { color: c.muted }]}>BILOW</Text><TextInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted2} style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} /></View><View style={{ flex: 1 }}><Text style={[styles.label, { color: c.muted }]}>DHAMMAAD</Text><TextInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted2} style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} /></View></View>
      <TouchableOpacity onPress={load} disabled={loading} style={[styles.loadBtn, { backgroundColor: c.blue, opacity: loading ? .7 : 1 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loadTxt}>Soo saar warbixinta</Text>}</TouchableOpacity>
    </View>
    {error ? <View style={[styles.errorBox, { backgroundColor: c.roseSoft }]}><Text style={[styles.errorTxt, { color: c.rose }]}>{error}</Text><TouchableOpacity onPress={load}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity></View> : null}
    {data ? <>
      <TouchableOpacity onPress={doExport} style={[styles.exportBtn, { borderColor: c.line, backgroundColor: c.surface }]}><Icon name="download" size={15} color={c.blue} /><Text style={[styles.exportTxt, { color: c.blue }]}>Soo dejiso CSV</Text></TouchableOpacity>
      {exportMsg ? <Text style={[styles.exportMsg, { color: c.muted }]}>{exportMsg}</Text> : null}
      <Text style={[styles.section, { color: c.ink }]}>Diiwaangelin iyo xaadiris</Text><View style={styles.grid}>{metricRows().slice(0, 5).map(([k, v]) => <Stat key={k} c={c} label={k} value={v} />)}</View>
      <Text style={[styles.section, { color: c.ink }]}>Jadwal, shaqo-guri iyo natiijo</Text><View style={styles.grid}>{metricRows().slice(5, 12).map(([k, v]) => <Stat key={k} c={c} label={k} value={v} />)}</View>
      <Text style={[styles.section, { color: c.ink }]}>Lacagaha</Text><View style={styles.grid}>{metricRows().slice(12, 18).map(([k, v]) => <Stat key={k} c={c} label={k} value={v} />)}</View>
      <Text style={[styles.section, { color: c.ink }]}>Kiisaska</Text><View style={styles.grid}>{metricRows().slice(18).map(([k, v]) => <Stat key={k} c={c} label={k} value={v} />)}</View>
    </> : !loading && !error ? <Text style={[styles.empty, { color: c.muted }]}>Dooro filtarrada kadibna soo saar warbixinta.</Text> : null}
  </Phase5Screen>;
}

const styles = StyleSheet.create({
  filterCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 }, label: { fontSize: 10.5, fontWeight: '800', letterSpacing: .3, marginBottom: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 }, choiceTxt: { fontSize: 11.5, fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 4 }, input: { height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 13 },
  loadBtn: { height: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, loadTxt: { color: '#fff', fontSize: 13.5, fontWeight: '800' },
  errorBox: { borderRadius: 12, padding: 12, marginBottom: 12 }, errorTxt: { fontSize: 12.5, fontWeight: '700' }, retry: { fontSize: 12, fontWeight: '800', marginTop: 6 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14, marginBottom: 8 }, exportTxt: { fontSize: 13, fontWeight: '800' }, exportMsg: { fontSize: 12.5, fontWeight: '700', marginBottom: 12 },
  section: { fontSize: 15, fontWeight: '800', marginTop: 16, marginBottom: 10 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stat: { flexGrow: 1, minWidth: '44%', borderWidth: 1, borderRadius: 14, padding: 14 }, statVal: { fontSize: 21, fontWeight: '800' }, statLbl: { fontSize: 11.5, fontWeight: '600', marginTop: 3 }, empty: { textAlign: 'center', fontSize: 13, fontWeight: '600', paddingVertical: 25 },
});
