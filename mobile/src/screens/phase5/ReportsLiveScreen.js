/* Warbixinno — real reports from Phase 1–5 Supabase data. Every figure comes
   from a role-scoped RPC; an auth failure raises (never a silent zero) and a
   real empty result shows a real zero. No fake charts or percentages. */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Phase5Screen, { useAsyncData } from '../../components/Phase5Scaffold';
import { reportEnrollmentSummary, reportFeeBalanceSummary } from '../../services/phase5';

function Stat({ label, value }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.statVal, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.statLbl, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

export default function ReportsLiveScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const { data, loading, error, reload } = useAsyncData(
    async () => ({
      enrol: await reportEnrollmentSummary(schoolId),
      fees: await reportFeeBalanceSummary(schoolId),
    }),
    [schoolId], { enabled: isLive && !!schoolId },
  );

  const enrol = data && data.enrol;
  const fees = data && data.fees;
  return (
    <Phase5Screen title="Warbixinno" subtitle="Xogta dhabta ah" icon="reports"
      loading={loading} error={error} onRetry={reload}
      empty={false}>
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
    </Phase5Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, minWidth: '45%', borderWidth: 1, borderRadius: 14, padding: 16 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
