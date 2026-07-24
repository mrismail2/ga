import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { radius } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Badge from '../components/Badge';
import {
  schoolsForRole, canSeeSchoolBilling, getStudentsBySchool, getActiveStudentsBySchool,
  getNonBilledStudentsBySchool, calculateSchoolBilling, formatCurrency, STATUS_META,
} from '../data/billing';
import { getClassDisplayName } from '../data/identity';
import { useAppData } from '../context/AppDataContext';

function StatCard({ label, value, color, hint }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.sVal, { color: color || c.ink }]}>{value}</Text>
      <Text style={[styles.sLbl, { color: c.muted }]} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={[styles.sHint, { color: c.muted2 }]}>{hint}</Text> : null}
    </View>
  );
}

/* Student-Based School Billing — the school's monthly Kobciye subscription
   = active students × per-student rate. Visible to Super Admin (all
   schools), School Admin & Accountant (own school only). Teachers see
   aggregated billing only (no per-student details). */
export default function BillingScreen({ navigation }) {
  const { c } = useTheme();
  const { role, profile } = useRole();
  const schoolId = profile.school_id || 'school_001';
  const schools = schoolsForRole(role, schoolId);
  const [active, setActive] = useState(0);
  const [subStatus, setSubStatus] = useState({});
  const showStudentDetails = role !== 'teacher'; // schoolId -> 'approved' | 'rejected' | 'suspended'
  // billing is computed from the ONE central store (active students)
  const { data: appData } = useAppData();
  const registry = appData.students;

  const back = navigation ? (
    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon name="back" size={20} color={c.ink} />
    </TouchableOpacity>
  ) : null;

  if (!canSeeSchoolBilling(role)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Biilasha Dugsiga" right={back} />
          <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Icon name="shield" size={30} color={c.muted2} />
            <Text style={[styles.noAccess, { color: c.muted }]}>
              Biilasha rukunka dugsiga lama oggola doorkaaga. (Waalid/Arday/Macalin)
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const school = schools[Math.min(active, schools.length - 1)] || schools[0];
  const students = getStudentsBySchool(registry, school.id);
  const activeStudents = getActiveStudentsBySchool(registry, school.id);
  const notBilled = getNonBilledStudentsBySchool(registry, school.id);
  const bill = calculateSchoolBilling(registry, school);
  const projected = (bill.activeStudents + 30) * bill.rate; // simple projection
  const planLabel = school.plan === 'small' ? 'Small Plan' : 'Large Plan';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Biilasha Dugsiga" subtitle="Lacagta rukunka — ardayda firfircoon" right={back} />

        {/* super admin: pick a school */}
        {role === 'superadmin' && schools.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {schools.map((s, i) => (
              <TouchableOpacity key={s.id} onPress={() => setActive(i)} style={[styles.schoolTab, { borderColor: c.line, backgroundColor: i === active ? c.navy : c.surface }]}>
                <Text style={[styles.schoolTabTxt, { color: i === active ? '#fff' : c.ink2 }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* plan banner */}
        <Card style={[styles.banner, { backgroundColor: c.navy }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bLabel}>{school.name}</Text>
            <Text style={styles.bBill}>{formatCurrency(bill.monthlyAmount)}<Text style={styles.bPer}> / bishii</Text></Text>
            <Text style={styles.bMeta}>{bill.activeStudents} arday firfircoon × {formatCurrency(bill.rate)}</Text>
          </View>
          <View style={styles.planChip}>
            <Text style={styles.planChipTxt}>{planLabel}</Text>
          </View>
        </Card>

        {/* Super Admin subscription control — approve / reject / suspend */}
        {role === 'superadmin' ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={[styles.fLabel, { color: c.muted }]}>MAAMULKA RUKUNKA (Super Admin)</Text>
            {subStatus[school.id] ? (
              <View style={[styles.subBanner, {
                backgroundColor: subStatus[school.id] === 'approved' ? c.greenSoft : subStatus[school.id] === 'rejected' ? c.roseSoft : c.goldSoft,
              }]}>
                <Text style={[styles.subBannerTxt, {
                  color: subStatus[school.id] === 'approved' ? c.green : subStatus[school.id] === 'rejected' ? c.rose : c.gold700,
                }]}>
                  {subStatus[school.id] === 'approved' ? '✓ La oggolaaday — shaqadu way socotaa' :
                   subStatus[school.id] === 'rejected' ? '✕ La diiday' :
                   '⏸ La joojiyay — shaqadu way hakatay'}
                </Text>
              </View>
            ) : null}
            <View style={styles.subBtns}>
              <TouchableOpacity style={[styles.subBtn, { backgroundColor: c.greenSoft }]} onPress={() => setSubStatus((s) => ({ ...s, [school.id]: 'approved' }))}>
                <Icon name="check" size={15} color={c.green} strokeWidth={2.4} />
                <Text style={[styles.subBtnTxt, { color: c.green }]}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subBtn, { backgroundColor: c.roseSoft }]} onPress={() => setSubStatus((s) => ({ ...s, [school.id]: 'rejected' }))}>
                <Icon name="close" size={15} color={c.rose} strokeWidth={2.4} />
                <Text style={[styles.subBtnTxt, { color: c.rose }]}>Diido</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subBtn, { backgroundColor: c.goldSoft }]} onPress={() => setSubStatus((s) => ({ ...s, [school.id]: 'suspended' }))}>
                <Icon name="clock" size={15} color={c.gold700} strokeWidth={2.4} />
                <Text style={[styles.subBtnTxt, { color: c.gold700 }]}>Joojin</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {/* 4 cards */}
        <View style={styles.grid}>
          <StatCard label="Active Students" value={String(bill.activeStudents)} color={c.green} hint="La xisaabiyay" />
          <StatCard label="Not Billed" value={String(notBilled.length)} color={c.rose} hint="Lama xisaabin" />
          <StatCard label="Rate / Student" value={formatCurrency(bill.rate)} color={c.navy} />
          <StatCard label="Monthly Bill" value={formatCurrency(bill.monthlyAmount)} color={c.blue} />
        </View>

        {/* formula */}
        <Card style={{ marginTop: 12 }}>
          <Text style={[styles.fLabel, { color: c.muted }]}>QAACIDADA (FORMULA)</Text>
          <Text style={[styles.formula, { color: c.ink }]}>
            {bill.activeStudents} active × {formatCurrency(bill.rate)} = <Text style={{ color: c.green }}>{formatCurrency(bill.monthlyAmount)}</Text> / month
          </Text>
          <View style={[styles.projRow, { borderTopColor: c.line }]}>
            <Text style={[styles.projLbl, { color: c.muted }]}>Saadaasha bisha soo socota (+30 arday)</Text>
            <Text style={[styles.projVal, { color: c.ink }]}>{formatCurrency(projected)}</Text>
          </View>
        </Card>

        {/* total students summary */}
        <View style={styles.row3}>
          <View style={[styles.miniStat, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.miniVal, { color: c.ink }]}>{students.length}</Text>
            <Text style={[styles.miniLbl, { color: c.muted }]}>Total Students</Text>
          </View>
          <View style={[styles.miniStat, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.miniVal, { color: c.green }]}>{bill.activeStudents}</Text>
            <Text style={[styles.miniLbl, { color: c.muted }]}>Active</Text>
          </View>
          <View style={[styles.miniStat, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[styles.miniVal, { color: c.rose }]}>{notBilled.length}</Text>
            <Text style={[styles.miniLbl, { color: c.muted }]}>Not Billed</Text>
          </View>
        </View>

        {/* Student Billing Status table (as cards) — hidden from teachers */}
        {showStudentDetails && (
          <>
            <Text style={[styles.section, { color: c.ink }]}>Xaaladda Lacagta Ardayda</Text>
            {students.slice(0, 14).map((s) => {
              const m = STATUS_META[s.status] || STATUS_META.active;
              const counted = s.status === 'active';
              return (
                <View key={s.student_internal_id} style={[styles.bRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.bName, { color: c.ink }]} numberOfLines={1}>{s.full_name}</Text>
                    <Text style={[styles.bSub, { color: c.muted }]} numberOfLines={1}>
                      {s.student_id} · {getClassDisplayName(s.class_id)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge label={m.label} tone={m.tone} />
                    <Text style={[styles.bAmt, { color: counted ? c.green : c.muted2 }]}>
                      {counted ? formatCurrency(bill.rate) : '$0.00'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
        <Text style={[styles.note, { color: c.muted2 }]}>
          Prototype frontend oo keliya — mock data. Lacag-bixin dhab ah (Stripe) ma jirto.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noAccess: { fontSize: 13.5, fontWeight: '600', textAlign: 'center', marginTop: 12, lineHeight: 20 },
  schoolTab: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 },
  schoolTabTxt: { fontSize: 12.5, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 0 },
  bLabel: { color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: '600' },
  bBill: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  bPer: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,.7)' },
  bMeta: { color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginTop: 4 },
  planChip: { backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 },
  planChipTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  subBanner: { borderRadius: 12, padding: 12, marginBottom: 10 },
  subBannerTxt: { fontSize: 13, fontWeight: '700' },
  subBtns: { flexDirection: 'row', gap: 8 },
  subBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  subBtnTxt: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  stat: { flex: 1, minWidth: '46%', borderWidth: 1, borderRadius: 14, padding: 14 },
  sVal: { fontSize: 22, fontWeight: '800' },
  sLbl: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  sHint: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  formula: { fontSize: 15, fontWeight: '700' },
  projRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  projLbl: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  projVal: { fontSize: 15, fontWeight: '800' },
  row3: { flexDirection: 'row', gap: 10, marginTop: 12 },
  miniStat: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  miniVal: { fontSize: 18, fontWeight: '800' },
  miniLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  bRow: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 10 },
  bName: { fontSize: 14, fontWeight: '700' },
  bSub: { fontSize: 11.5, marginTop: 2 },
  bAmt: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 11.5, lineHeight: 17, marginTop: 16, textAlign: 'center' },
});
