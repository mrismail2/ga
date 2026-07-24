import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';
import LoadingDots from '../../components/LoadingDots';

/* Phase 3: REAL password-reset request. Sends a Supabase recovery email whose
   link opens the set-password screen. To avoid leaking which emails exist, the
   confirmation is shown regardless of whether the address has an account.

   A single compact card, centered on the page — the same rounded-card
   visual language (proportions, radius, shadow) as the landing page's own
   LoginModal card, so this screen reads as one consistent, professional
   auth surface instead of a full-bleed stretched form. */
export default function ForgotPasswordScreen({ goLogin }) {
  const { c } = useTheme();
  const { requestPasswordReset, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (!configured) { setErr('Supabase is not configured (mobile/.env).'); return; }
    if (!email.trim()) { setErr('Geli email-kaaga.'); return; }
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      // still show the neutral confirmation; reveal nothing about the account
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <TouchableOpacity onPress={goLogin} style={[styles.back, { backgroundColor: c.bg, borderColor: c.line }]} activeOpacity={0.85} hitSlop={8}>
              <Icon name="back" size={16} color={c.ink} />
            </TouchableOpacity>

            <View style={styles.logoWrap}><Logo size={34} /></View>

            <Text style={[styles.title, { color: c.ink }]}>Dib u deji furaha sirta</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Geli email-kaaga waxaana lagu soo diri doonaa link dib-u-dejin.</Text>

            {!sent ? (
              <>
                <Text style={[styles.label, { color: c.muted }]}>EMAIL</Text>
                <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                  <Icon name="mail" size={17} color={c.muted2} />
                  <TextInput value={email} onChangeText={setEmail} placeholder="tusaale: admin@dugsi.edu"
                    placeholderTextColor={c.muted2} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { color: c.ink }]} />
                </View>
                {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}
                <TouchableOpacity style={[styles.btn, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]} onPress={submit} activeOpacity={0.9} disabled={busy}>
                  {busy ? <LoadingDots color="#fff" size={7} gap={5} /> : (
                    <>
                      <Icon name="send" size={16} color="#fff" strokeWidth={2} />
                      <Text style={styles.btnTxt}>Dir Link Dib-u-dejin</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.okCircle, { backgroundColor: c.greenSoft }]}>
                  <Icon name="check" size={26} color={c.green} strokeWidth={2.5} />
                </View>
                <Text style={[styles.okTitle, { color: c.ink }]}>Fiiri email-kaaga</Text>
                <Text style={[styles.okSub, { color: c.muted }]}>
                  Haddii {email || 'email-kaaga'} uu akoon leeyahay, waxaad heli doontaa link dib-u-dejin oo furaha cusub aad ku dejinayso.
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={goLogin} style={{ alignSelf: 'center', marginTop: 20 }}>
              <Text style={[styles.link, { color: c.blue }]}>← Ku noqo Soo-gal</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: {
    width: '100%', maxWidth: 400, borderRadius: 28, paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 70px rgba(6,14,38,0.18)' } : { elevation: 8 }),
  },
  back: { position: 'absolute', top: 14, left: 14, zIndex: 20, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 5, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13, height: 50 },
  input: { flex: 1, fontSize: 14.5 },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, marginTop: 24 },
  btnTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  link: { fontSize: 13.5, fontWeight: '700' },
  okCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  okTitle: { fontSize: 17, fontWeight: '800' },
  okSub: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
