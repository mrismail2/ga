import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Badge from '../components/Badge';
import SectionTitle from '../components/SectionTitle';

/* AI Principal Advisor — rule-based briefing over local school data.
   Super Admin / School Admin only. Not a general chatbot; answers come
   from the prototype's own numbers (mirrors the web advisor). */
const PULSE = { score: 78, statusSo: 'Wanaagsan', tone: 'green' };

const BRIEFING = [
  ['rose', 'Sare', 'rose', '3 arday oo khatar sare ah', 'Maqnaansho + lacag dib u dhac. La xidhiidh waalidka.'],
  ['gold', 'Dhexe', 'gold', 'Dakhliga wuu hooseeyay 4%', '5 arday oo aan weli bixin. Dir xusuusin.'],
  ['green', 'Hoose', 'green', 'Xaadiristu way kor u kacday', '94% maanta — +3% usbuucii hore.'],
];

const SUGGESTED = [
  'Maxaa maanta mudan feejignaan?',
  'Ardaydee ayaa khatar ku jira?',
  'Maxay dakhligu u hooseeyay?',
  'Fasalkee ayaa ugu daciif ah?',
];

const ANSWERS = {
  'Maxaa maanta mudan feejignaan?': '3 arday ayaa calaamado khatar muujinaya (maqnaansho + lacag). Waxaa habboon in la waco waalidkood maanta.',
  'Ardaydee ayaa khatar ku jira?': 'Cabdiraxmaan Y., Nuur D., iyo Liibaan C. — calaamado way muujinayaan, la-socod ayay u baahan yihiin.',
  'Maxay dakhligu u hooseeyay?': 'Dakhligu wuxuu hooseeyay 4% sababtoo ah 5 arday oo aan weli bixin lacagtii bishaan. Xusuusin ayaa lagu talinayaa.',
  'Fasalkee ayaa ugu daciif ah?': 'Form 6B ayaa celcelis ugu hooseeya (65%) Sayniska. Taageero dheeraad ah ayaa loo baahan yahay.',
};

const notEnough = "Macluumaadku kuma filna su'aashaada. Isku day su'aalo ku saabsan: xaadiris, lacag, natiijo, kiisas ama ardayda khatarta ku jira.";

export default function AdvisorScreen({ navigation }) {
  const { c } = useTheme();
  const [answer, setAnswer] = useState(null);
  const [query, setQuery] = useState('');

  // match the typed question to the closest known answer (keyword search)
  const runQuery = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = SUGGESTED.find((s) => {
      const words = s.toLowerCase().split(/\s+/);
      return words.some((w) => w.length > 3 && q.includes(w)) || s.toLowerCase().includes(q);
    });
    setAnswer(hit || query.trim());
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="AI Advisor"
          subtitle="School Brain · xog dugsiga"
          right={
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          }
        />

        {/* pulse */}
        <Card style={[styles.pulse, { backgroundColor: c.navy }]}>
          <View style={styles.pulseTop}>
            <Text style={styles.pulseTitle}>School Pulse Score</Text>
            <Badge label={PULSE.statusSo} tone={PULSE.tone} />
          </View>
          <Text style={styles.pulseScore}>{PULSE.score}<Text style={styles.pulseMax}>/100</Text></Text>
          <Text style={styles.pulseSub}>Xaaladda guud ee dugsiga — xaadiris, lacag, imtixaan & jawaab waalid.</Text>
        </Card>

        {/* briefing */}
        <SectionTitle title="Warbixinta Mudnaanta Maanta" />
        {BRIEFING.map((b, i) => (
          <Card key={i} style={styles.brief}>
            <View style={[styles.briefDot, { backgroundColor: b[0] === 'rose' ? c.rose : b[0] === 'gold' ? c.gold : c.green }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.briefHead}>
                <Text style={[styles.briefTitle, { color: c.ink }]}>{b[3]}</Text>
                <Badge label={b[1]} tone={b[2]} />
              </View>
              <Text style={[styles.briefBody, { color: c.muted }]}>{b[4]}</Text>
            </View>
          </Card>
        ))}

        {/* ask — search box */}
        <SectionTitle title="Weydii Advisor-ka" />
        <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Qor su'aashaada halkan…"
            placeholderTextColor={c.muted2}
            style={[styles.searchInput, { color: c.ink }]}
            onSubmitEditing={runQuery}
            returnKeyType="search"
          />
          <TouchableOpacity style={[styles.askBtn, { backgroundColor: query.trim() ? c.blue : c.muted2 }]} disabled={!query.trim()} onPress={runQuery}>
            <Icon name="send" size={15} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.chips}>
          {SUGGESTED.map((q) => (
            <TouchableOpacity key={q} style={[styles.chip, { backgroundColor: c.blueSoft }]} onPress={() => { setQuery(q); setAnswer(q); }}>
              <Text style={[styles.chipTxt, { color: c.navy }]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {answer ? (
          <Card style={{ marginTop: 12 }}>
            <Text style={[styles.qTxt, { color: c.blue }]}>{answer}</Text>
            <Text style={[styles.aTxt, { color: c.ink2 }]}>{ANSWERS[answer] || notEnough}</Text>
          </Card>
        ) : null}

        <Text style={[styles.disclaimer, { color: c.muted2 }]}>
          Advisor-ku wuxuu ka shaqeeyaa xogta dugsiga oo kaliya — ma aha chatbot guud — wuxuu bixiyaa talo ku saleysan xogta dugsiga oo kaliya.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pulse: { borderWidth: 0 },
  pulseTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pulseTitle: { color: 'rgba(255,255,255,.85)', fontSize: 13, fontWeight: '700' },
  pulseScore: { color: '#fff', fontSize: 38, fontWeight: '800', marginTop: 8 },
  pulseMax: { fontSize: 18, color: 'rgba(255,255,255,.6)', fontWeight: '600' },
  pulseSub: { color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  brief: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  briefDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  briefHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  briefTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  briefBody: { fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingLeft: 12, paddingRight: 6, height: 50, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  askBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8 },
  chip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12 },
  chipTxt: { fontSize: 13.5, fontWeight: '700' },
  qTxt: { fontSize: 13.5, fontWeight: '700', marginBottom: 8 },
  aTxt: { fontSize: 13.5, lineHeight: 20 },
  disclaimer: { fontSize: 11.5, lineHeight: 17, marginTop: 20, textAlign: 'center' },
});
