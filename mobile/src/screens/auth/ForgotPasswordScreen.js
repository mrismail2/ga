import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';
import LoadingDots from '../../components/LoadingDots';

/* Phase 3: REAL password-reset request. Sends a Supabase recovery email whose
   link opens the set-password screen. To avoid leaking which emails exist, the
   confirmation is shown regardless of whether the address has an account.

   Wide-screen layout matches LoginScreen's two-panel treatment (navy brand
   panel + a width-capped, centered form column) so the form no longer
   stretches full-bleed across a desktop window. Narrow/mobile layout is
   unchanged. */
export default function ForgotPasswordScreen({ goLogin }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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

  const Brand = (
    <View style={[styles.brandPanel, { backgroundColor: c.navy }, wide ? styles.brandPanelWide : styles.brandPanelNarrow]}>
      <Logo size={40} variant="white" />
      <Text style={styles.brandHeadline}>Dib u soo cel <Text style={{ color: c.gold }}>akoonkaaga</Text></Text>
      {wide ? (
        <Text style={styles.brandSub}>
          Geli email-kaaga oo ku diiwaan gashan Kobciye — waxaan kuu soo diri doonaa link aad ku dejinayso furaha sirta cusub.
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={wide ? styles.contentWide : styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {Brand}

          <View style={[styles.formCol, wide && styles.formColWide]}>
            <TouchableOpacity onPress={goLogin} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={18} color={c.ink} />
              <Text style={[styles.backTxt, { color: c.ink }]}>Ku noqo Soo-gal</Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: c.ink }]}>Dib u deji furaha sirta</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Geli email-kaaga waxaana lagu soo diri doonaa link dib-u-dejin.</Text>

            {!sent ? (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
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
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line, alignItems: 'center' }]}>
                <View style={[styles.okCircle, { backgroundColor: c.greenSoft }]}>
                  <Icon name="check" size={26} color={c.green} strokeWidth={2.5} />
                </View>
                <Text style={[styles.okTitle, { color: c.ink }]}>Fiiri email-kaaga</Text>
                <Text style={[styles.okSub, { color: c.muted }]}>
                  Haddii {email || 'email-kaaga'} uu akoon leeyahay, waxaad heli doontaa link dib-u-dejin oo furaha cusub aad ku dejinayso.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 0, paddingBottom: 40 },
  contentWide: { flexDirection: 'row', minHeight: '100%' },
  brandPanel: { alignItems: 'center' },
  brandPanelNarrow: { paddingTop: 40, paddingBottom: 32, paddingHorizontal: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brandPanelWide: { flex: 1, justifyContent: 'center', paddingHorizontal: 48, minHeight: 640 },
  brandHeadline: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 20, lineHeight: 34, maxWidth: 380 },
  brandSub: { color: 'rgba(255,255,255,.75)', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 14, lineHeight: 21, maxWidth: 360 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 38, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, marginBottom: 18 },
  backTxt: { fontSize: 12.5, fontWeight: '700' },
  formCol: { padding: 22, paddingTop: 28 },
  formColWide: { flex: 1, maxWidth: 420, justifyContent: 'center', alignSelf: 'center', width: '100%' },
  title: { fontSize: 21, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 6, marginBottom: 18, lineHeight: 19 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 14.5 },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, marginTop: 18 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  okCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  okTitle: { fontSize: 17, fontWeight: '800' },
  okSub: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 19 },
});
