import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';
import LoadingDots from '../../components/LoadingDots';

/* Phase 3 — Section E: the invited school admin (or a user resetting their
   password) chooses and confirms their OWN password. For an invite we then
   call the secure accept-school-invite Edge Function, which assigns
   school_admin server-side. Tokens are never shown or logged.

   Distinct invite-state screens (expired / cancelled / already accepted /
   invalid) come from the structured error codes the Edge Function returns —
   PLUS `flowError` from AuthContext, set immediately when the callback URL
   itself (the code/token in the reset or invite link) could not be exchanged
   for a session, before the user ever gets to type a password. */

// Public support line (same number used across the landing page) — powers the
// "need help?" affordance on the invite-state screens. UI-only, no auth impact.
const SUPPORT_WA = '252637373367';

export default function SetPasswordScreen({ mode = 'invite' }) {
  const { c } = useTheme();
  const { setNewPassword, signOut, flowError } = useAuth();

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [state, setState] = useState(null); // 'expired' | 'cancelled' | 'already_accepted' | 'email_mismatch' | 'not_found' | 'already_member' | 'invalid'

  // an invalid/expired callback URL is known immediately (no submit needed)
  useEffect(() => { if (flowError) setState(flowError); }, [flowError]);

  const isInvite = mode === 'invite';
  const isFirstLogin = mode === 'first_login';

  const strong = (p) => p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);

  const openSupport = () => {
    const msg = encodeURIComponent('Assalamu Calaykum, waxaan caawimaad uga baahanahay casuumaadda Kobciye.');
    Linking.openURL('https://wa.me/' + SUPPORT_WA + '?text=' + msg);
  };

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (!strong(pw)) { setErr('Furaha waa inuu ka koobnaadaa ugu yaraan 8 xaraf, oo leh xaraf iyo lambar.'); return; }
    if (pw !== pw2) { setErr('Furaha labaad iskuma mid aha.'); return; }
    setBusy(true);
    try {
      await setNewPassword(pw, { accept: isInvite });
      // success: AuthContext clears the flow and routes to the dashboard
    } catch (e) {
      const code = e && e.code ? e.code : null;
      if (code && ['expired', 'cancelled', 'already_accepted', 'email_mismatch', 'not_found', 'already_member'].includes(code)) {
        setState(code);
      } else if (e && e.passwordSaved) {
        // the password WAS saved — never say "failed" as if nothing
        // happened, and never suggest making a new account.
        setErr('Furaha waa la kaydiyay, balse ku biirista dugsiga ayaa fashilantay. Fadlan ha samayn account kale; la xiriir maamulka Kobciye.');
      } else {
        setErr(e && e.message ? e.message : 'Waa la fashilmay. Isku day mar kale.');
      }
    } finally {
      setBusy(false);
    }
  };

  /* ── invite-state screen (expired / cancelled / already accepted / …) ── */
  if (state) {
    const info = STATE_COPY[state] || STATE_COPY.invalid;
    // Tone communicates severity — not every state is a hard error (e.g.
    // "already accepted" is actually a good outcome; "temporary" is a retry,
    // not a broken link) so they should not all look like the same red
    // failure screen.
    const TONES = {
      rose: { soft: c.roseSoft, solid: c.rose },
      gold: { soft: c.goldSoft, solid: c.gold700 },
      green: { soft: c.greenSoft, solid: c.green },
      blue: { soft: c.blueSoft, solid: c.blue },
    };
    const tone = TONES[info.tone] || TONES.rose;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <View style={styles.center}>
          <View style={styles.wrap}>
            <View style={styles.stateBrand}><Logo size={44} /></View>
            <View style={[styles.stateCard, { backgroundColor: c.surface }, cardShadow]}>
              <View style={[styles.okCircle, { backgroundColor: tone.soft }]}>
                <Icon name={info.icon} size={32} color={tone.solid} strokeWidth={2.4} />
              </View>
              <Text style={[styles.stateTitle, { color: c.ink }]}>{info.title}</Text>
              <Text style={[styles.stateSub, { color: c.muted }]}>{info.sub}</Text>
              <TouchableOpacity style={[styles.btn, styles.btnRow, { backgroundColor: c.blue, marginTop: 24 }]} onPress={signOut} activeOpacity={0.9}>
                <Icon name="arrowLeft" size={18} color="#fff" strokeWidth={2.4} />
                <Text style={styles.btnTxt}>Ku Noqo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openSupport} style={styles.helpRow} hitSlop={8} activeOpacity={0.7}>
                <Text style={[styles.helpTxt, { color: c.blue }]}>U baahan tahay caawimaad?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* ── password setup / reset form ── */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.wrap}>
            <View style={styles.brand}>
              <Logo size={50} />
              <Text style={[styles.title, { color: c.ink }]}>{isInvite ? 'Ku biir Kobciye' : isFirstLogin ? 'Beddel furaha ku-meelgaarka ah' : 'Deji furaha cusub'}</Text>
              <Text style={[styles.sub, { color: c.muted }]}>
                {isInvite
                  ? 'Dooro furahaaga sirta. Adiga oo keliya ayaa yaqaan — cidna kuuma soo dirin furaha diyaar ah.'
                  : isFirstLogin
                    ? 'Furaha ku-meelgaarka ah hal mar ayuu shaqaynayaa. Hadda samee furahaaga gaarka ah.'
                    : 'Geli furahaaga cusub si aad u sii wado.'}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: c.surface }, cardShadow]}>
              <Text style={[styles.label, { color: c.muted }]}>FURAHA CUSUB</Text>
              <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line2 }]}>
                <View style={[styles.iconBadge, { backgroundColor: c.blueSoft }]}>
                  <Icon name="lock" size={16} color={c.blue} strokeWidth={2} />
                </View>
                <TextInput value={pw} onChangeText={setPw} placeholder="Ugu yaraan 8 xaraf" secureTextEntry={!show}
                  placeholderTextColor={c.muted2} autoCapitalize="none" style={[styles.input, { color: c.ink }]} />
                <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={8} style={styles.showBtn}>
                  <Icon name={show ? 'eyeOff' : 'eye'} size={16} color={c.blue} strokeWidth={2} />
                  <Text style={[styles.showTxt, { color: c.blue }]}>{show ? 'Qari' : 'Tus'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, styles.labelTop, { color: c.muted }]}>XAQIIJI FURAHA</Text>
              <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line2 }]}>
                <View style={[styles.iconBadge, { backgroundColor: c.blueSoft }]}>
                  <Icon name="lock" size={16} color={c.blue} strokeWidth={2} />
                </View>
                <TextInput value={pw2} onChangeText={setPw2} placeholder="Ku celi furaha" secureTextEntry={!show}
                  placeholderTextColor={c.muted2} autoCapitalize="none" style={[styles.input, { color: c.ink }]} />
              </View>

              {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}

              <TouchableOpacity style={[styles.btn, styles.btnRow, { backgroundColor: c.blue, marginTop: 22, opacity: busy ? 0.7 : 1 }]}
                onPress={submit} activeOpacity={0.9} disabled={busy}>
                {busy ? <LoadingDots color="#fff" size={7} gap={5} /> : (
                  <>
                    <Icon name="shield" size={18} color="#fff" strokeWidth={2.2} />
                    <Text style={styles.btnTxt}>{isInvite ? 'Deji Furaha & Ku biir' : isFirstLogin ? 'Beddel Furaha' : 'Kaydi Furaha Cusub'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// tone: 'rose' (genuine error, dead end) | 'gold' (neutral — doesn't apply to
// you) | 'green' (positive — already done, nothing wrong) | 'blue'
// (informational — safe to retry, not a broken link).
const STATE_COPY = {
  expired: { icon: 'alert', tone: 'rose', title: 'Casuumaadda way dhacday', sub: 'Casuumaaddan way dhacday ama hore ayaa loo isticmaalay. Fadlan weydii maamulka inuu kuu soo diro casuumaad cusub.' },
  cancelled: { icon: 'close', tone: 'rose', title: 'Casuumaadda waa la joojiyay', sub: 'Casuumaaddan waa la joojiyay (cancelled). La xiriir maamulaha guud.' },
  already_accepted: { icon: 'check', tone: 'green', title: 'Horey ayaa loo aqbalay', sub: 'Casuumaaddan horey ayaa loo aqbalay. Isku day inaad soo gasho si caadi ah.' },
  email_mismatch: { icon: 'mail', tone: 'rose', title: 'Email khaldan', sub: 'Casuumaaddan waxaa loo diray email kale. Isticmaal email-ka lagugu casuumay.' },
  not_found: { icon: 'notice', tone: 'rose', title: 'Casuumaad lama helin', sub: 'Casuumaad sugaya llooma helin akoonkaaga.' },
  already_member: { icon: 'building', tone: 'gold', title: 'Horey ayaad dugsi u leedahay', sub: 'Akoonkaagu horey ayuu dugsi u tirsan yahay, sidaas darteed lama beddeli karo.' },
  // network hiccup, temporary server issue, or a profile-load failure AFTER
  // the invite/recovery link itself was already successfully verified — this
  // must NEVER be conflated with `invalid`, since the link itself is known
  // good (see classifyCallbackError in AuthContext.js). Blue, not rose — this
  // is a retry, not a broken link.
  temporary: { icon: 'notice', tone: 'blue', title: 'Ma xaqiijin karo hadda', sub: 'Fadhiga casuumaadda lama xaqiijin karo hadda. Fadlan isku day mar kale, ama hubi internet-kaaga.' },
  // a PKCE ?code= link opened in a DIFFERENT browser/device than the one
  // that requested it — the link may be perfectly valid where it was
  // requested; this is guidance, not a broken link (see classifyCallbackError).
  wrong_browser: { icon: 'notice', tone: 'gold', title: 'Ku fur isla browser-ka', sub: 'Link-gan waxaa lagu furi karaa kaliya browser-ka/qalabka aad codsiga ka samaysay. Fadlan halkaas ku fur, ama weydiiso link cusub.' },
  invalid: { icon: 'close', tone: 'rose', title: 'Casuumaad aan sax ahayn', sub: 'Link-gan ma shaqaynayo. Fadlan weydiiso mid cusub.' },
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 18px 48px rgba(20,40,80,0.10)' }
  : { shadowColor: '#142850', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 };

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, paddingVertical: 34 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22 },
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontSize: 13.5, fontWeight: '500', marginTop: 9, textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },
  card: { borderRadius: 22, padding: 22 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  labelTop: { marginTop: 18 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, height: 54 },
  iconBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  showBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 6, paddingRight: 2 },
  showTxt: { fontSize: 13, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12, lineHeight: 18 },
  btn: { alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 15 },
  btnRow: { flexDirection: 'row', gap: 9 },
  btnTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800' },

  // invite-state screen
  stateBrand: { alignItems: 'center', marginBottom: 22 },
  okCircle: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  stateCard: { width: '100%', borderRadius: 22, padding: 28, alignItems: 'center' },
  stateTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  stateSub: { fontSize: 13.5, fontWeight: '500', marginTop: 10, textAlign: 'center', lineHeight: 21, paddingHorizontal: 4 },
  helpRow: { marginTop: 16, alignItems: 'center' },
  helpTxt: { fontSize: 13, fontWeight: '700' },
});
