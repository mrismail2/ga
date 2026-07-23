import React, { useState } from 'react';
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
  SIM_TEACHERS, SIM_CLASSES, SIM_SUBJECTS, CHANGE_TYPES, PERIODS, tFind, cFind,
  runTeacherReplacementSimulation, suggestBestFitTeachers, generateHandoverPlan, emergencyCover,
} from '../data/simulator';

const riskTone = (lvl) => (lvl === 'High' ? 'rose' : lvl === 'Medium' || lvl === 'Moderate' ? 'gold' : 'green');

function Picker({ label, value, options, onPick, getLabel }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((o) => {
          const v = getLabel ? getLabel(o) : o;
          const on = value === (getLabel ? getLabel(o) : o);
          return (
            <TouchableOpacity key={v} onPress={() => onPick(getLabel ? getLabel(o) : o)}
              style={[styles.chip, { borderColor: c.line, backgroundColor: on ? c.navy : 'transparent' }]}>
              <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* Teacher Replacement Simulator — Super Admin & School Admin only.
   Decision-SUPPORT signals; never judges teacher quality. */
export default function SimulatorScreen({ navigation }) {
  const { c } = useTheme();
  const { role } = useRole();
  const [cur, setCur] = useState('');
  const [prop, setProp] = useState('');
  const [cls, setCls] = useState('');
  const [subject, setSubject] = useState('');
  const [changeType, setChangeType] = useState(CHANGE_TYPES[1]);
  const [period, setPeriod] = useState(PERIODS[2]);
  const [result, setResult] = useState(null);
  const [handover, setHandover] = useState(null);
  const [exported, setExported] = useState(false);

  // hard gate (nav already hides it, but enforce here too)
  if (role !== 'superadmin' && role !== 'schooladmin') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={{ padding: 16 }}>
          <ScreenHeader title="Simulator" />
          <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Icon name="shield" size={30} color={c.muted2} />
            <Text style={{ color: c.muted, marginTop: 12, textAlign: 'center' }}>Qaybtan lama oggola doorkaaga.</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const curT = tFind(cur), propT = tFind(prop);
  const emergency = changeType === 'Daboolid degdeg';

  const run = () => {
    setHandover(null); setExported(false);
    setResult(runTeacherReplacementSimulation({ current: curT, proposed: propT, fromClass: cls, subject, changeType, period }));
  };

  const suggestions = cls && subject ? suggestBestFitTeachers(cls, subject) : [];
  const cover = emergency && cls && subject ? emergencyCover(cls, subject) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Teacher Replacement Simulator"
          subtitle="Qorshee isbeddelka macalimiinta ka hor inta aanu saamayn ardayda."
          right={navigation ? (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          ) : null}
        />

        {/* warning note */}
        <View style={[styles.warn, { backgroundColor: c.goldSoft }]}>
          <Icon name="alert" size={18} color={c.gold700} />
          <Text style={[styles.warnTxt, { color: c.gold700 }]}>
            Qalabkani wuxuu bixiyaa calaamado go'aan-taageero ah oo kaliya. Ma qiimeeyo tayada macalinka — go'aanka kama dambeysta ah waxaa qaata hoggaanka dugsiga.
          </Text>
        </View>

        {/* scenario builder */}
        <Text style={[styles.section, { color: c.ink }]}>1 · Dhis Xaaladda (Scenario)</Text>
        <Card>
          <Picker label="MACALINKA HADDA" value={cur} options={SIM_TEACHERS} getLabel={(t) => t.name} onPick={(name) => setCur((SIM_TEACHERS.find((t) => t.name === name) || {}).id)} />
          <Picker label="MACALINKA LA SOO JEEDIYAY" value={prop} options={SIM_TEACHERS} getLabel={(t) => t.name} onPick={(name) => setProp((SIM_TEACHERS.find((t) => t.name === name) || {}).id)} />
          <Picker label="FASALKA" value={cls} options={SIM_CLASSES} getLabel={(x) => x.name} onPick={setCls} />
          <Picker label="MAADDA" value={subject} options={SIM_SUBJECTS} onPick={setSubject} />
          <Picker label="NOOCA ISBEDDELKA" value={changeType} options={CHANGE_TYPES} onPick={setChangeType} />
          <Picker label="MUDDADA" value={period} options={PERIODS} onPick={setPeriod} />
          <TouchableOpacity style={[styles.runBtn, { backgroundColor: c.blue }]} onPress={run}>
            <Icon name="advisor" size={17} color="#fff" />
            <Text style={styles.runTxt}>Socodsii Simulation</Text>
          </TouchableOpacity>
        </Card>

        {/* teacher comparison cards */}
        {(curT || propT) ? (
          <>
            <Text style={[styles.section, { color: c.ink }]}>2 · Isbarbardhig Macalimiinta</Text>
            <View style={styles.cmpRow}>
              {[curT, propT].filter(Boolean).map((t, i) => (
                <View key={t.id} style={[styles.cmpCard, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.cmpTag, { color: c.muted }]}>{i === 0 ? 'HADDA' : 'LA SOO JEEDIYAY'}</Text>
                  <Text style={[styles.cmpName, { color: c.ink }]}>{t.name}</Text>
                  <Text style={[styles.cmpSub, { color: c.muted }]}>{t.subjects.join(', ')}</Text>
                  <Row c={c} k="Xaadiris" v={t.attendanceRate + '%'} />
                  <Row c={c} k="Syllabus" v={t.syllabus + '%'} />
                  <Row c={c} k="Cabasho waalid" v={String(t.parentComplaints)} />
                  <Row c={c} k="Khibrad" v={t.years + ' snd'} />
                  <Badge label={t.syllabus >= 80 ? 'Calaamad xooggan' : 'U baahan taageero'} tone={t.syllabus >= 80 ? 'green' : 'gold'} style={{ marginTop: 8 }} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* simulation result */}
        {result && !result.ok ? (
          <Card style={{ marginTop: 16 }}><Text style={{ color: c.rose, fontWeight: '700' }}>{result.message}</Text></Card>
        ) : null}
        {result && result.ok ? (
          <>
            <Text style={[styles.section, { color: c.ink }]}>3 · Natiijada Simulation</Text>
            <Card>
              <Lbl c={c}>A · KOOBAN</Lbl>
              <Text style={[styles.body, { color: c.ink2 }]}>{result.summary}</Text>
              <Lbl c={c}>B · CADDAYNTA LA ISTICMAALAY</Lbl>
              {result.evidence.map((e, i) => <Text key={i} style={[styles.bullet, { color: c.ink2 }]}>• {e}</Text>)}
              <Lbl c={c}>C · KU-TIIRSANAANTA FASALKA</Lbl>
              <View style={styles.depRow}>
                <Badge label={result.dependency.level} tone={riskTone(result.dependency.level)} />
                <Text style={[styles.body, { color: c.ink2, flex: 1, marginLeft: 8 }]}>{result.dependency.text}</Text>
              </View>
            </Card>

            <Text style={[styles.section, { color: c.ink }]}>4 · Saadaasha Saamaynta</Text>
            {result.impacts.map((im) => (
              <Card key={im.label} style={styles.impact}>
                <View style={styles.impactHead}>
                  <Text style={[styles.impactLbl, { color: c.ink }]}>{im.label}</Text>
                  <Badge label={im.level === 'High' ? 'Khatar sare' : im.level === 'Medium' ? 'Khatar dhexe' : 'Khatar hoose'} tone={riskTone(im.level)} />
                </View>
                <Text style={[styles.body, { color: c.muted }]}>{im.text}</Text>
              </Card>
            ))}

            {result.risks.length ? (
              <>
                <Text style={[styles.section, { color: c.ink }]}>5 · Digniinaha</Text>
                <Card padded={false}>
                  {result.risks.map((r, i) => (
                    <View key={i} style={[styles.warnRow, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
                      <Icon name="alert" size={16} color={c.gold700} />
                      <Text style={[styles.body, { color: c.ink2, flex: 1 }]}>{r}</Text>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            <Card style={{ marginTop: 12, backgroundColor: c.blueSoft }}>
              <Lbl c={c}>TALADA LA GUDBINAYO</Lbl>
              <Text style={[styles.body, { color: c.navy, fontWeight: '600' }]}>{result.recommendation}</Text>
              <View style={styles.confRow}>
                <Text style={[styles.confLbl, { color: c.muted }]}>Kalsoonida (Confidence):</Text>
                <Badge label={result.confidence} tone={result.confidence === 'High' ? 'green' : result.confidence === 'Medium' ? 'gold' : 'rose'} />
              </View>
              {result.missing.length ? <Text style={[styles.missing, { color: c.rose }]}>Xog maqan: {result.missing.join(', ')}</Text> : null}
            </Card>

            {/* handover + export */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.navy }]} onPress={() => setHandover(generateHandoverPlan(curT, propT, cls))}>
                <Icon name="note" size={15} color="#fff" />
                <Text style={styles.actTxt}>Qorshe Kala-guur</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.green }]} onPress={() => setExported(true)}>
                <Icon name="download" size={15} color="#fff" />
                <Text style={styles.actTxt}>Export Report</Text>
              </TouchableOpacity>
            </View>

            {handover ? (
              <Card style={{ marginTop: 12 }}>
                <Lbl c={c}>QORSHAHA KALA-GUURKA</Lbl>
                {handover.map((h, i) => <Text key={i} style={[styles.bullet, { color: c.ink2 }]}>{i + 1}. {h}</Text>)}
              </Card>
            ) : null}
            {exported ? (
              <View style={[styles.exported, { backgroundColor: c.greenSoft }]}>
                <Text style={[styles.exportedTxt, { color: c.green }]}>✓ Warbixinta waa la diyaariyay (printable) — {new Date().toLocaleDateString()} · Dugsiga Hidaayada</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* best-fit suggestions */}
        {suggestions.length ? (
          <>
            <Text style={[styles.section, { color: c.ink }]}>6 · Macalimiin ku Habboon ({cls} · {subject})</Text>
            {suggestions.map((s) => (
              <Card key={s.teacher.id} style={styles.sug}>
                <View style={styles.sugHead}>
                  <Text style={[styles.cmpName, { color: c.ink }]}>{s.teacher.name}</Text>
                  <View style={[styles.scoreBadge, { backgroundColor: s.score >= 75 ? c.greenSoft : s.score >= 55 ? c.goldSoft : c.roseSoft }]}>
                    <Text style={[styles.scoreTxt, { color: s.score >= 75 ? c.green : s.score >= 55 ? c.gold700 : c.rose }]}>{s.score}/100</Text>
                  </View>
                </View>
                {s.why.map((w, i) => <Text key={i} style={[styles.bullet, { color: c.green }]}>✓ {w}</Text>)}
                {s.risks.map((r, i) => <Text key={'r' + i} style={[styles.bullet, { color: c.rose }]}>⚠ {r}</Text>)}
                <Text style={[styles.confSmall, { color: c.muted }]}>Kalsooni: {s.confidence}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {/* emergency cover */}
        {cover && cover.ok ? (
          <>
            <Text style={[styles.section, { color: c.ink }]}>7 · Daboolid Degdeg (Emergency)</Text>
            <Card style={{ backgroundColor: c.roseSoft }}>
              <Text style={[styles.cmpName, { color: c.rose }]}>{cover.teacher.name} · {cover.score}/100</Text>
              <Text style={[styles.body, { color: c.ink2, marginTop: 4 }]}>{cover.text}</Text>
              <Lbl c={c}>HUBINTA LA-SOCODKA</Lbl>
              {cover.checklist.map((x, i) => <Text key={i} style={[styles.bullet, { color: c.ink2 }]}>• {x}</Text>)}
            </Card>
          </>
        ) : null}

        <Text style={[styles.disclaimer, { color: c.muted2 }]}>
          Decision-support only · ma aha go'aan shaqaalaynta · frontend prototype (mock data).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ c, k, v }) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvK, { color: c.muted }]}>{k}</Text>
      <Text style={[styles.kvV, { color: c.ink }]}>{v}</Text>
    </View>
  );
}
function Lbl({ c, children }) { return <Text style={[styles.blockLbl, { color: c.muted }]}>{children}</Text>; }

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  warn: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, marginBottom: 4 },
  warnTxt: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13, marginRight: 8 },
  chipTxt: { fontSize: 12.5, fontWeight: '700' },
  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 6 },
  runTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cmpRow: { flexDirection: 'row', gap: 12 },
  cmpCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
  cmpTag: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  cmpName: { fontSize: 15.5, fontWeight: '800', marginTop: 2 },
  cmpSub: { fontSize: 12, marginTop: 1, marginBottom: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  kvK: { fontSize: 12 },
  kvV: { fontSize: 12.5, fontWeight: '700' },
  blockLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 14, marginBottom: 6 },
  body: { fontSize: 13.5, lineHeight: 20 },
  bullet: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  depRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
  impact: { marginBottom: 10 },
  impactHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  impactLbl: { fontSize: 14, fontWeight: '800' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  confLbl: { fontSize: 12.5, fontWeight: '600' },
  missing: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  actTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exported: { padding: 14, borderRadius: 12, marginTop: 12 },
  exportedTxt: { fontSize: 12.5, fontWeight: '700' },
  sug: { marginBottom: 10 },
  sugHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  scoreBadge: { borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  scoreTxt: { fontSize: 14, fontWeight: '800' },
  confSmall: { fontSize: 11.5, fontWeight: '600', marginTop: 6 },
  disclaimer: { fontSize: 11.5, lineHeight: 17, marginTop: 22, textAlign: 'center' },
});
