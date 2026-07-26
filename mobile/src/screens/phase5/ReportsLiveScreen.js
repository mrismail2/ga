/* Warbixinno — real reports from Phase 1–5 Supabase data. Every figure comes
   from a role-scoped RPC; an auth failure raises (never a silent zero) and a
   real empty result shows a real zero. No fake charts or percentages.
   §12: four report families (enrolment, fees, teacher load, results) plus a
   CSV export of the live figures (web download; native copy-to-share text). */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Icon from '../../components/Icon';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import { reportEnrollmentSummary, reportFeeBalanceSummary, reportTeacherAssignments, reportResultsSummary } from '../../services/phase5';

function Stat({ label, value }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.statVal, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.statLbl, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

/* Build a CSV from label/value rows and hand it to the user. On web this
   triggers a real file download; on native (no filesystem here) it copies the
   CSV to the clipboard when available so it can be shared. Never touches any
   backend — it only serialises figures already on screen. */
function exportRows(rows, filename) {
  const csv = 'metric,value\n' + rows.map(([k, v]) => `"${String(k).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`).join('\n');
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
  try {
    const { Clipboard } = require('react-native');
    if (Clipboard && Clipboard.setString) { Clipboard.setString(csv); return true; }
  } catch (e) { /* no clipboard available */ }
  return false;
}

export default function ReportsLiveScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const [exportMsg, setExportMsg] = React.useState('');
  const { data, loading, error, reload } = useAsyncData(
    async () => ({
      enrol: await reportEnrollmentSummary(schoolId),
      fees: await reportFeeBalanceSummary(schoolId),
      teachers: await reportTeacherAssignments(schoolId),
      results: await reportResultsSummary(schoolId),
    }),
    [schoolId], { enabled: isLive && !!schoolId },
  );

  const enrol = data && data.enrol;
  const fees = data && data.fees;
  const teachers = data && data.teachers;
  const results = data && data.results;

  const teacherRows = (teachers && teachers.teachers) || (Array.isArray(teachers) ? teachers : []);
  const resultRows = (results && results.exams) || (Array.isArray(results) ? results : []);

  const doExport = () => {
    const rows = [];
    if (enrol) { rows.push(['Arday firfircoon', enrol.total_active]); rows.push(['Fasallo', (enrol.classes || []).length]); }
    if (fees) {
      rows.push(['Wadarta la sugayo', fees.total_due]); rows.push(['La bixiyay', fees.total_paid]);
      rows.push(['Hadhaaga', fees.total_balance]); rows.push(['Biilal furan', fees.outstanding_invoices]);
    }
    rows.push(['Macallimiin (culays shaqo)', teacherRows.length]);
    rows.push(['Diiwaanka natiijada', resultRows.length]);
    const okDl = exportRows(rows, `kobciye-warbixin-${new Date().toISOString().slice(0, 10)}.csv`);
    setExportMsg(okDl ? (Platform.OS === 'web' ? 'CSV waa la soo dejiyay.' : 'CSV waa la nuqul-qaaday (clipboard).') : 'Soo dejinta lagama awoodin.');
  };

  const canExport = !!(enrol || fees);

  return (
    <Phase5Screen title="Warbixinno" subtitle="Xogta dhabta ah" icon="reports"
      loading={loading} error={error} onRetry={reload}
      empty={false}>
      {canExport ? (
        <TouchableOpacity onPress={doExport} activeOpacity={0.85} style={[styles.exportBtn, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Icon name="note" size={15} color={c.blue} />
          <Text style={[styles.exportTxt, { color: c.blue }]}>Soo dejiso CSV</Text>
        </TouchableOpacity>
      ) : null}
      {exportMsg ? <Text style={[styles.exportMsg, { color: c.muted }]}>{exportMsg}</Text> : null}

      {enrol ? (
        <>
          <Text style={[styles.section, { color: c.ink }]}>Diiwaangelinta</Text>
          <View style={styles.grid}>
            <Stat label="Arday firfircoon" value={String(enrol.total_active)} />
            <Stat label="Fasallo" value={String((enrol.classes || []).length)} />
          </View>
        </>
      ) : null}
      {fees ? (
        <>
          <Text style={[styles.section, { color: c.ink, marginTop: 18 }]}>Lacagaha</Text>
          <View style={styles.grid}>
            <Stat label="Wadarta la sugayo" value={String(fees.total_due)} />
            <Stat label="La bixiyay" value={String(fees.total_paid)} />
            <Stat label="Hadhaaga" value={String(fees.total_balance)} />
            <Stat label="Biilal furan" value={String(fees.outstanding_invoices)} />
          </View>
        </>
      ) : null}
      {teacherRows.length ? (
        <>
          <Text style={[styles.section, { color: c.ink, marginTop: 18 }]}>Culayska macallimiinta</Text>
          <View style={styles.grid}>
            <Stat label="Macallimiin leh hawlo" value={String(teacherRows.length)} />
          </View>
        </>
      ) : null}
      {resultRows.length ? (
        <>
          <Text style={[styles.section, { color: c.ink, marginTop: 18 }]}>Natiijooyinka</Text>
          <View style={styles.grid}>
            <Stat label="Diiwaanno natiijo" value={String(resultRows.length)} />
          </View>
        </>
      ) : null}
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, minWidth: '45%', borderWidth: 1, borderRadius: 14, padding: 16 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14, marginBottom: 8 },
  exportTxt: { fontSize: 13, fontWeight: '800' },
  exportMsg: { fontSize: 12.5, fontWeight: '700', marginBottom: 12 },
});
