import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';

/* Phase 3: Kobciye is INVITE-ONLY. There is NO public school self-registration.
   Schools + their first admin are created only by the Kobciye super admin
   (through the secure Edge Functions). This screen therefore stores NOTHING —
   no password, no mock registration, no AsyncStorage — it only explains the
   process and offers Contact / Request-a-Demo / Login. It is reachable only in
   local demo mode; the live login screen never links here. */
export default function RegisterSchoolScreen({ goLogin }) {
  const { c } = useTheme();

  const contact = () => Linking.openURL('https://wa.me/252637373367').catch(() => {});

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={goLogin} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="back" size={20} color={c.ink} />
        </TouchableOpacity>

        <View style={styles.brand}>
          <Logo size={48} />
          <Text style={[styles.title, { color: c.ink }]}>Diiwaangelinta Dugsiga</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.iconCircle, { backgroundColor: c.blueSoft }]}>
            <Icon name="building" size={26} color={c.navy} />
          </View>
          <Text style={[styles.lead, { color: c.ink }]}>
            Diiwaangelinta dugsiyada waxaa maamula Kobciye Super Admin.
          </Text>
          <Text style={[styles.body, { color: c.muted }]}>
            Dugsiga cusub iyo maamulihiisa koowaad waxaa abuura maamulaha guud (super admin) oo keliya. Kadib waxaa email laguugu soo diri doonaa casuumaad aad furahaaga gaarka ah ku dooranayso — fure diyaar ah cidna lama diro.
          </Text>

          <TouchableOpacity style={[styles.btn, { backgroundColor: c.navy }]} onPress={contact} activeOpacity={0.9}>
            <Icon name="phone" size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.btnTxt}>Xiriir Kobciye (Request a Demo)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnOutline, { borderColor: c.line }]} onPress={goLogin} activeOpacity={0.85}>
            <Text style={[styles.btnOutlineTxt, { color: c.navy }]}>Ku noqo Soo-gal (Login)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 22, paddingTop: 18, paddingBottom: 40 },
  back: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  brand: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: 'center' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  lead: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 13.5, fontWeight: '600', textAlign: 'center', lineHeight: 21, marginTop: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, alignSelf: 'stretch', marginTop: 22 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  btnOutline: { alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, borderWidth: 1.5, alignSelf: 'stretch', marginTop: 12 },
  btnOutlineTxt: { fontSize: 14.5, fontWeight: '800' },
});
