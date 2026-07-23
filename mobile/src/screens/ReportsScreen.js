import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Card from '../components/Card';

const TEMPLATES = ['Xaadiris', 'Imtixaan', 'Lacag', 'Qoraal Macalin', 'Guud'];
const METHODS = ['SMS', 'WhatsApp', 'App'];

/* Parent-report composer — pick a template + channel, preview the message. */
export default function ReportsScreen({ navigation }) {
  const { c } = useTheme();
  const [tpl, setTpl] = useState(0);
  const [method, setMethod] = useState(0);
  const [sent, setSent] = useState(false);

  const preview = {
    0: 'Xaadirinta Aaliyah bishaan waa 96%. Mahadsanid taageeradaada.',
    1: 'Natiijada imtixaanka dhexe ee Aaliyah: celcelis 76%. Faahfaahin app-ka.',
    2: 'Lacagta bishaan ($25) waa la helay. Mahadsanid.',
    3: 'Macalinku wuxuu sheegay in Aaliyah ay si fiican u qabato fasalka.',
    4: 'Salaan, kani waa warbixin guud oo ku saabsan Aaliyah.',
  }[tpl];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Warbixinno"
          subtitle="Warbixinta waalidka"
          right={
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          }
        />

        <Card>
          <Text style={[styles.label, { color: c.muted }]}>NOOCA TEMPLATE-KA</Text>
          <View style={styles.chips}>
            {TEMPLATES.map((t, i) => (
              <TouchableOpacity
                key={t}
                onPress={() => { setTpl(i); setSent(false); }}
                style={[styles.chip, { borderColor: c.line, backgroundColor: tpl === i ? c.blue : 'transparent' }]}
              >
                <Text style={[styles.chipTxt, { color: tpl === i ? '#fff' : c.ink2 }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: c.muted, marginTop: 16 }]}>HABKA DIRITAANKA</Text>
          <View style={styles.chips}>
            {METHODS.map((m, i) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMethod(i)}
                style={[styles.chip, { borderColor: c.line, backgroundColor: method === i ? c.navy : 'transparent' }]}
              >
                <Text style={[styles.chipTxt, { color: method === i ? '#fff' : c.ink2 }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: c.muted, marginTop: 16 }]}>HORFARIIN</Text>
          <View style={[styles.preview, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Text style={{ color: c.ink2, fontSize: 13.5, lineHeight: 20 }}>{preview}</Text>
          </View>

          <TouchableOpacity style={[styles.send, { backgroundColor: sent ? c.green : c.blue }]} onPress={() => setSent(true)}>
            <Text style={styles.sendTxt}>{sent ? '✓ Waa la diray (' + METHODS[method] + ')' : 'Dir Warbixinta'}</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13 },
  chipTxt: { fontSize: 12.5, fontWeight: '700' },
  preview: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 70 },
  send: { marginTop: 16, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  sendTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
