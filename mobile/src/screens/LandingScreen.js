import React, { useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  useWindowDimensions, Platform, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Pressable, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { radius, shadow } from '../theme/colors';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import KobciyeLanding from './landing/KobciyeLanding';

const ORANGE = '#F28C5A';
const WA_NUM = '252637373367';

/* ═══════════════════ LOGIN MODAL (single-card, form only) ════════
   A clean centered card presented as an overlay ON the landing — no
   brand panel, just the form. A floating logo badge sits above tabs
   (Dugsiga = real Supabase auth; Arday & Waalid = Coming Soon mockup)
   and the sign-in fields. A "forgot password" sub-view lives inside. */
const METHODS = [
  { key: 'staff', label: 'Dugsiga', icon: 'building' },
  { key: 'student', label: 'Arday', icon: 'students' },
  { key: 'parent', label: 'Waalid', icon: 'profile' },
];

function LoginModal({ onClose, onMinistry }) {
  const { c } = useTheme();
  const { signIn, requestPasswordReset, configured } = useAuth();

  const [view, setView] = useState('login');     // 'login' | 'forgot'
  const [method, setMethod] = useState('staff');  // staff | student | parent

  // staff (real auth)
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // student / parent (mockup only)
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [comingSoonMsg, setComingSoonMsg] = useState(null);

  // forgot password
  const [fgEmail, setFgEmail] = useState('');
  const [fgMsg, setFgMsg] = useState(null);
  const [fgErr, setFgErr] = useState(false);
  const [fgBusy, setFgBusy] = useState(false);

  const login = async () => {
    if (busy) return;
    setErr(null);
    if (!configured) { setErr('Backend-ka Supabase lama habayn. La xiriir maamulaha Kobciye.'); return; }
    if (!email.trim() || !pw) { setErr('Geli email iyo furaha sirta.'); return; }
    setBusy(true);
    try { await signIn(email.trim(), pw); }   // AuthContext routes on success
    catch (e) { setErr(e && e.message ? e.message : 'Soo galitaanku wuu fashilmay. Hubi xogtaada.'); }
    finally { setBusy(false); }
  };

  const submitComingSoon = () =>
    setComingSoonMsg('Galitaanka ID-ga waa dhawaan (Coming Soon). Hadda isticmaal tab-ka "Dugsiga".');

  const selectMethod = (k) => { setMethod(k); setErr(null); setComingSoonMsg(null); };

  const sendReset = async () => {
    if (fgBusy) return;
    if (!fgEmail.trim()) { setFgMsg('Fadlan gali iimayl-kaaga.'); setFgErr(true); return; }
    setFgMsg(null); setFgErr(false); setFgBusy(true);
    // Neutral confirmation regardless of outcome — never reveal whether the
    // email has an account (see the request-password-reset Edge Function,
    // which also refuses to send recovery mail to a pending-invite account).
    const GENERIC = 'Haddii email-kan uu leeyahay account shaqaynaya, fariin ayaa loo diri doonaa. Haddii aad haysato casuumaad, isticmaal link-ga casuumaadda ama weydiiso mid cusub.';
    try {
      await requestPasswordReset(fgEmail.trim());
      setFgMsg(GENERIC); setFgErr(false);
    } catch (e) { setFgMsg(GENERIC); setFgErr(false); }
    finally { setFgBusy(false); }
  };

  const idPh = {
    student: { school: 'tusaale: SCH-0042', id: 'tusaale: HID-000142' },
    parent: { school: 'tusaale: SCH-0042', id: "ID-ga arday-kaaga (tusaale: HID-000142)" },
  };

  /* ── forgot-password view ── */
  const ForgotForm = (
    <>
      <TouchableOpacity onPress={() => setView('login')} style={m.backRow} hitSlop={8}>
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="chevronRight" size={15} color={c.muted} />
        </View>
        <Text style={[m.backTxt, { color: c.muted }]}>Ku noqo</Text>
      </TouchableOpacity>
      <Text style={[m.title, { color: c.ink }]}>Furaha sirta ma illowday?</Text>
      <Text style={[m.subtitle, { color: c.muted }]}>Gali iimaylkaaga — waxaan kuu soo dirnaa link aad furaha ku cusboonaysiiso.</Text>
      <Text style={[m.label, { color: c.muted }]}>EMAIL</Text>
      <View style={[m.field, { backgroundColor: c.bg, borderColor: c.line }]}>
        <Icon name="mail" size={17} color={c.muted2} />
        <TextInput value={fgEmail} onChangeText={setFgEmail} placeholder="tusaale: admin@dugsi.edu"
          placeholderTextColor={c.muted2} autoCapitalize="none" keyboardType="email-address"
          style={[m.input, { color: c.ink }]} />
      </View>
      {fgMsg ? <Text style={[m.err, { color: fgErr ? c.rose : c.green }]}>{fgMsg}</Text> : null}
      <TouchableOpacity style={[m.loginBtn, { backgroundColor: c.navy, opacity: fgBusy ? 0.7 : 1 }]}
        onPress={sendReset} activeOpacity={0.9} disabled={fgBusy}>
        {fgBusy ? <ActivityIndicator color="#fff" /> : (
          <><Text style={m.loginTxt}>Dir Link-ga</Text><Icon name="chevronRight" size={18} color="#fff" /></>
        )}
      </TouchableOpacity>
    </>
  );

  /* ── login view (tabs + staff/mockup) ── */
  const LoginForm = (
    <>
      <Text style={[m.title, { color: c.ink }]}>Soo gal akoonkaaga</Text>
      <Text style={[m.subtitle, { color: c.muted }]}>Dooro sida aad u gali doonto</Text>

      <View style={[m.tabs, { backgroundColor: c.bg, borderColor: c.line }]}>
        {METHODS.map((mm) => {
          const on = method === mm.key;
          return (
            <TouchableOpacity key={mm.key} onPress={() => selectMethod(mm.key)}
              style={[m.tab, on && { backgroundColor: c.navy }]} activeOpacity={0.85}>
              <Icon name={mm.icon} size={14} color={on ? '#fff' : c.muted} />
              <Text style={[m.tabTxt, { color: on ? '#fff' : c.muted }]}>{mm.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {method === 'staff' ? (
        <>
          <Text style={[m.label, { color: c.muted }]}>EMAIL</Text>
          <View style={[m.field, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Icon name="mail" size={17} color={c.muted2} />
            <TextInput value={email} onChangeText={setEmail} placeholder="tusaale: admin@dugsi.edu"
              placeholderTextColor={c.muted2} autoCapitalize="none" keyboardType="email-address"
              style={[m.input, { color: c.ink }]} />
          </View>
          <Text style={[m.label, { color: c.muted }]}>FURAHA SIRTA</Text>
          <View style={[m.field, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Icon name="key" size={17} color={c.muted2} />
            <TextInput value={pw} onChangeText={setPw} placeholder="••••••••" secureTextEntry={!showPw}
              placeholderTextColor={c.muted2} style={[m.input, { color: c.ink }]} />
            <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8}>
              <Text style={[m.showTxt, { color: c.blue }]}>{showPw ? 'Qari' : 'Tus'}</Text>
            </TouchableOpacity>
          </View>
          {err ? <Text style={[m.err, { color: c.rose }]}>{err}</Text> : null}
          <TouchableOpacity style={[m.loginBtn, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]}
            onPress={login} activeOpacity={0.9} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <><Text style={m.loginTxt}>Soo Gal</Text><Icon name="chevronRight" size={18} color="#fff" /></>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView('forgot')} style={{ alignSelf: 'center', marginTop: 16 }}>
            <Text style={[m.link, { color: c.blue }]}>Ma illowday furaha sirta?</Text>
          </TouchableOpacity>
          {onMinistry ? (
            <TouchableOpacity onPress={onMinistry} style={[m.minBtn, { borderColor: c.line }]} activeOpacity={0.85}>
              <Icon name="shield" size={14} color={c.navy} />
              <Text style={[m.minTxt, { color: c.navy }]}>Eegista Wasaaradda</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <>
          <View style={[m.soonBanner, { backgroundColor: c.goldSoft }]}>
            <Icon name="clock" size={14} color={c.gold700} />
            <Text style={[m.soonTxt, { color: c.gold700 }]}>Dhawaan (Coming Soon)</Text>
          </View>
          <Text style={[m.label, { color: c.muted }]}>ID-GA DUGSIGA (SCHOOL ID)</Text>
          <View style={[m.field, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Icon name="building" size={17} color={c.muted2} />
            <TextInput value={schoolId} onChangeText={setSchoolId}
              placeholder={idPh[method === 'student' ? 'student' : 'parent'].school}
              placeholderTextColor={c.muted2} autoCapitalize="characters" style={[m.input, { color: c.ink }]} />
          </View>
          <Text style={[m.label, { color: c.muted }]}>
            {method === 'student' ? 'ID-GAAGA ARDAY (STUDENT ID)' : "ID-GA ARDAY-GAAGA (CHILD'S STUDENT ID)"}
          </Text>
          <View style={[m.field, { backgroundColor: c.bg, borderColor: c.line }]}>
            <Icon name="students" size={17} color={c.muted2} />
            <TextInput value={studentId} onChangeText={setStudentId}
              placeholder={idPh[method === 'student' ? 'student' : 'parent'].id}
              placeholderTextColor={c.muted2} autoCapitalize="characters" style={[m.input, { color: c.ink }]} />
          </View>
          {comingSoonMsg ? <Text style={[m.err, { color: c.gold700 }]}>{comingSoonMsg}</Text> : null}
          <TouchableOpacity style={[m.loginBtn, { backgroundColor: c.navy }]} onPress={submitComingSoon} activeOpacity={0.9}>
            <Text style={m.loginTxt}>Soo Gal</Text>
            <Icon name="chevronRight" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={[m.infoTxt, { color: c.muted }]}>
            {method === 'student'
              ? 'Galitaanka ardayda ee ID-ga waa nidaam soo socda — wali lama shaqaysiin.'
              : 'Galitaanka waalidka ee ID-ga waa nidaam soo socda — wali lama shaqaysiin.'}
          </Text>
        </>
      )}
    </>
  );

  return (
    <View style={m.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={m.kav}>
        <View style={[m.card, { backgroundColor: c.surface }]}>
          <TouchableOpacity onPress={onClose} style={m.xBtn} activeOpacity={0.85} hitSlop={8}>
            <Text style={m.xTxt}>✕</Text>
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={m.cardInner}>
            <View style={m.logoWrap}><Logo size={34} /></View>
            {view === 'forgot' ? ForgotForm : LoginForm}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ───────────────── MODAL STYLES (single-card, form only) ─────────── */
const m = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,14,38,0.62)', zIndex: 9000, alignItems: 'center', justifyContent: 'center', padding: 18 },
  kav: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 400, maxHeight: '92%', borderRadius: 28, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0 24px 70px rgba(6,14,38,0.4)' } : { elevation: 16 }) },
  cardInner: { paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24 },
  xBtn: { position: 'absolute', top: 14, right: 14, zIndex: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' } : { elevation: 4 }) },
  xTxt: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: -1 },

  logoWrap: { alignSelf: 'center', marginBottom: 14 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 5, marginBottom: 20, lineHeight: 19 },
  tabs: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabTxt: { fontSize: 12.5, fontWeight: '700' },
  soonBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginTop: 14, marginBottom: 2 },
  soonTxt: { fontSize: 11.5, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13, height: 50 },
  input: { flex: 1, fontSize: 14.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  showTxt: { fontSize: 12.5, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 14, marginTop: 24 },
  loginTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  link: { fontSize: 13.5, fontWeight: '700' },
  infoTxt: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: 20, lineHeight: 18 },
  minBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: 14, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  minTxt: { fontSize: 12.5, fontWeight: '700' },
});

/* ───────────────────── WhatsApp FAB ─────────────────────────────── */
function WhatsAppFab() {
  const open = () => {
    const msg = encodeURIComponent('Assalamu Calaykum, waxaan jeclahay inaan dugsigayga Kobciye ku diiwaangeliyo.');
    Linking.openURL('https://wa.me/' + WA_NUM + '?text=' + msg);
  };
  return (
    <TouchableOpacity style={fabStyle.btn} onPress={open} activeOpacity={0.85}>
      <Text style={fabStyle.ico}>💬</Text>
    </TouchableOpacity>
  );
}
const fabStyle = StyleSheet.create({
  btn: { position: 'absolute', right: 16, bottom: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', zIndex: 8000, ...(Platform.OS === 'web' ? { boxShadow: '0 4px 14px rgba(0,0,0,0.25)' } : { elevation: 8 }) },
  ico: { fontSize: 24 },
});

/* ═══════════════════ WEB LANDING WRAPPER ════════════════════════ */
/* KobciyeLanding is an auto-generated conversion of landing/index.html whose
   layout lives entirely in inline styles (no media queries), so the desktop
   two-column hero used to stay two-column — and squeeze — on phones. We inject
   a small responsive stylesheet that targets those inline styles by attribute
   so, on mobile, the hero stacks cleanly (headline → CTA → stats → phone
   mockup) with no horizontal overflow. Web-only; native uses NativeLanding. */
const LANDING_MOBILE_CSS = `
@media (max-width: 860px){
  /* header: drop the centre nav links so logo + login never overflow */
  header nav{ display:none !important; }

  /* hero: collapse the 2-col grid to a single centred column */
  #home > div{
    grid-template-columns:1fr !important;
    padding-top:44px !important;
    gap:6px !important;
    text-align:center !important;
  }
  #home > div > div:first-child{ padding-bottom:22px !important; }
  #home h1{ font-size:clamp(30px,8vw,44px) !important; letter-spacing:-1px !important; }
  #home p{ margin-left:auto !important; margin-right:auto !important; }
  /* centre the CTA row, the "how it works" link and the stat row */
  #home div[style*="flex-wrap:wrap"]{ justify-content:center !important; }
  #home div[style*="gap:38px"]{ justify-content:center !important; gap:26px !important; }
  /* phone mockup: drop the tall reserved height so it sits right under the copy */
  #home div[style*="540px"]{ min-height:0 !important; margin-top:6px !important; }

  /* two-column info block (FAQ / "how it works"): the 260px min column would
     shove the second column off-screen — stack it to one column instead */
  div[style*="minmax(260px"]{ grid-template-columns:1fr !important; gap:30px !important; }

  /* footer: 4 columns -> 2 so links stay readable and never overflow */
  footer div[style*="1.4fr 1fr 1fr 1.2fr"]{ grid-template-columns:1fr 1fr !important; gap:28px !important; }
}
@media (max-width: 480px){
  #home h1{ font-size:30px !important; }
  #home div[style*="gap:38px"]{ gap:18px !important; }
  footer div[style*="1.4fr 1fr 1fr 1.2fr"]{ grid-template-columns:1fr !important; }
}
`;

function WebLanding({ onEnter }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: LANDING_MOBILE_CSS }} />
      <div style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
        <KobciyeLanding onEnter={onEnter} />
      </div>
    </View>
  );
}

/* ═══════════════════ LANDING DATA ═══════════════════════════════ */
const FEATURES = [
  ['students', 'Xogta Ardayda', 'Diiwaangeli oo maamul xogta ardayda meel keliya.'],
  ['attendance', 'Xaadiriska Ardayda', 'Xaadiriska waxaad si fudud uga samayn kartaa Mobile-kaaga gacanta, umana baahnid inaad daabacdo waraaqo badan.'],
  ['finance', 'Maaliyadda Dugsiga', 'Ka rays buuggaagtii waaweynaa, hadda si fudud ayaad u diiwaan gelin kartaa lacag bixinta ardayda (Fee) & xiisaabaadka dugsigaba.'],
  ['exams', 'Imtixaannaadka', 'Uma baahnid in macalinkasta maaddadiisa Excel ku soo qoro, Diiwaan ayaa iskugu kaa gaynaya haybana xogta imtixaannaadka ardayda.'],
  ['shield', 'Amniga Xogta', 'Xogtaadu waa ammaan, door-kasta wuxuu arkaa wixii loo oggol yahay.'],
  ['advisor', 'AI Advisor', 'Talooyin caqli-gal ah oo ku saleysan xogta dugsiga — kaaga caawiya goʻaan-gaarka.'],
];

const PLANS = [
  { name: 'Dugsiyada Yar-Yar', rate: '$0.07', per: 'arday/bishii', cap: 'Ilaa 500 Arday', example: '500 arday × $0.07 = $35/bishii',
    feats: ['Nidaamka Xaadirinta', 'Nidaamka Imtixaannaadka', 'Warbixinaha Ardayga', 'Ururinta Iida', 'Nidaamka Xisaabaadka', 'Akoonka Ardayga & Waalidka'], popular: false },
  { name: 'Dugsiyada Waaweyn', rate: '$0.10', per: 'arday/bishii', cap: 'Arday Xaddidlaan', example: '500 arday × $0.10 = $50/bishii',
    feats: ['Dhammaan Yar-Yar', 'AI Advisor', 'Faracyada Dugsiga (3)', 'Multi-school & Warbixinno', 'Taageero gaar ah', 'API access'], popular: true },
];

const PILLS = [['Arday', '500+'], ['Dugsi', '50+'], ['Magaalo', '3']];

const CONTACT = [
  ['phone', 'WhatsApp', '+252 63 7373367', '#16A34A'],
  ['phone', 'Telefoon', '+252 7373367', '#2F6BF0'],
  ['pin', 'Goobta', 'Gabiley, Somaliland', '#7C3AED'],
  ['profile', 'Aasaasaha', 'Ismail Abdirahman Ahmed', '#E5484D'],
];

/* ═══════════════════ NATIVE LANDING ════════════════════════════ */
function NativeLanding({ onLogin }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 3 : width >= 600 ? 2 : 1;
  const wide = width >= 860;
  const [lang, setLang] = useState('SO');

  const openWA = () => {
    const msg = encodeURIComponent('Assalamu Calaykum, waxaan jeclahay inaan dugsigayga Kobciye ku diiwaangeliyo.');
    Linking.openURL('https://wa.me/' + WA_NUM + '?text=' + msg);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={styles.topbar}>
          <View style={styles.brand}>
            <Logo size={36} />
          </View>
          <View style={styles.headRight}>
            <View style={[styles.langWrap, { backgroundColor: c.surface, borderColor: c.line2 }]}>
              {['EN', 'SO'].map((l) => (
                <TouchableOpacity key={l} onPress={() => setLang(l)} style={[styles.langBtn, lang === l && { backgroundColor: c.navy }]}>
                  <Text style={[styles.langTxt, { color: lang === l ? '#fff' : c.muted }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.loginBtn, { backgroundColor: c.navy }]} onPress={onLogin}>
              <Text style={styles.loginTxt}>Gal akoonkaaga →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* hero + mockup */}
        <View style={[styles.heroWrap, wide && { flexDirection: 'row', alignItems: 'center', gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, { backgroundColor: c.greenSoft }]}>
              <Icon name="building" size={13} color={c.green} />
              <Text style={[styles.badgeTxt, { color: c.green }]}>Cloud-Based School Management System</Text>
            </View>
            <Text style={[styles.h1, { color: c.ink }]}>Si Fudud U Maamul Xogta <Text style={{ color: c.green }}>Ardayda!</Text></Text>
            <Text style={[styles.sub, { color: c.muted }]}>
              Kobciye wuxuu kaa caawiyaa inaad qaab fudud u maamusho xogta ardayda iyo macluumaadka dugsigaaga.
            </Text>
            <TouchableOpacity style={[styles.cta, { backgroundColor: c.navy }]} onPress={openWA}>
              <Text style={styles.ctaTxt}>Dugsigaaga diiwaan geli</Text>
              <Icon name="chevronRight" size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.pills}>
              {PILLS.map(([l, v]) => (
                <View key={l} style={styles.pill}>
                  <Text style={[styles.pillVal, { color: c.navy }]}>{v}</Text>
                  <Text style={[styles.pillLbl, { color: c.muted }]}>{l}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* dashboard mockup card */}
          <View style={[styles.mock, { backgroundColor: c.surface, borderColor: c.line }, shadow.card, wide ? { width: 360 } : { marginTop: 26 }]}>
            <View style={[styles.mockTop, { backgroundColor: c.navy }]}>
              <Text style={styles.mockBrand}>Kobciye</Text>
              <View style={styles.mockIcons}>
                <Icon name="search" size={15} color="rgba(255,255,255,.8)" />
                <Icon name="more" size={15} color="rgba(255,255,255,.8)" />
              </View>
            </View>
            <View style={styles.mockTabs}>
              <View style={[styles.mockTab, { backgroundColor: c.greenSoft }]}><Text style={[styles.mockTabTxt, { color: c.green }]}>✓ AL-MAAX SECONDARY</Text></View>
              <View style={[styles.mockTab, { backgroundColor: c.bg }]}><Text style={[styles.mockTabTxt, { color: c.muted }]}>AL-MAAX PRIMARY</Text></View>
            </View>
            {[['Mustafa Ali', 'Form 4A'], ['Saadaqa Ahmed', 'Class 3'], ['Amina Yonis', 'Form 3B'], ['Abdullahi Osman', 'Form 2D']].map(([n, cl], i) => (
              <View key={n} style={[styles.mockRow, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
                <View style={[styles.mockAv, { backgroundColor: c.blueSoft }]}><Icon name="profile" size={14} color={c.navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mockName, { color: c.ink }]}>{n}</Text>
                  <Text style={[styles.mockCls, { color: c.muted }]}>{cl}</Text>
                </View>
                <View style={[styles.mockBadge, { backgroundColor: c.greenSoft }]}><Text style={[styles.mockBadgeTxt, { color: c.green }]}>Secondary</Text></View>
              </View>
            ))}
          </View>
        </View>

        {/* features */}
        <Text style={[styles.secTitle, { color: c.ink }]}>Faa'iidooyinka Nidaamka <Text style={{ color: c.green }}>Kobciye</Text></Text>
        <Text style={[styles.secSub, { color: c.muted }]}>Waa nidaam loo diyaariyay inuu daboolo baahiyaha gaarka ah ee xarumaha waxbarashada.</Text>
        <View style={styles.grid}>
          {FEATURES.map(([icon, title, desc]) => (
            <View key={title} style={[styles.feat, { backgroundColor: c.surface, borderColor: c.line, width: cols === 1 ? '100%' : cols === 2 ? '48%' : '31.5%' }, shadow.sm]}>
              <View style={[styles.featIcon, { backgroundColor: c.blueSoft }]}><Icon name={icon} size={22} color={c.blue} /></View>
              <Text style={[styles.featTitle, { color: c.ink }]}>{title}</Text>
              <Text style={[styles.featDesc, { color: c.muted }]}>{desc}</Text>
            </View>
          ))}
        </View>

        {/* AI teacher section */}
        <View style={[styles.aiWrap, { backgroundColor: c.blueSoft }]}>
          <Text style={[styles.secTitle, { color: c.ink, marginTop: 0 }]}>Kobciye ku Horumar <Text style={{ color: c.green }}>Dugsigaaga</Text></Text>
          <Text style={[styles.secSub, { color: c.muted }]}>Nidaamka ugu fudud ee aad ku maamusho xogta ardayda — mar walba gacantaada ku jirta.</Text>
          <View style={[styles.aiCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.card]}>
            <View style={[styles.aiHead, { backgroundColor: c.navy }]}>
              <Text style={styles.mockBrand}>Kobciye</Text>
              <Text style={styles.aiHi}>Hi, Yusuf 👋</Text>
            </View>
            <View style={{ padding: 14 }}>
              <View style={styles.aiBadge}><Icon name="advisor" size={13} color={c.blue} /><Text style={[styles.aiBadgeTxt, { color: c.blue }]}>AI · My teacher</Text></View>
              <Text style={[styles.aiNote, { color: c.muted }]}>Exam kaga eeg macalinka ku dhiga maadada lana xiddhiidh — AI ayaa kaa caawiya.</Text>
              {[['Teacher Amina Yusuf', 'Mathematics', 'Class teacher'], ['Teacher Sahra Maxamed', 'Science', 'Subject teacher']].map(([n, s, role]) => (
                <View key={n} style={[styles.aiTeach, { borderColor: c.line }]}>
                  <View style={[styles.mockAv, { backgroundColor: c.blueSoft }]}><Icon name="profile" size={14} color={c.navy} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mockName, { color: c.ink }]}>{n}</Text>
                    <Text style={[styles.mockCls, { color: c.muted }]}>{s} · {role}</Text>
                  </View>
                  <View style={[styles.aiMsgBtn, { backgroundColor: c.navy }]}><Icon name="messages" size={13} color="#fff" /><Text style={styles.aiMsgTxt}>Fariin</Text></View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* pricing */}
        <Text style={[styles.secTitle, { color: c.ink }]}>Qiimaha Barnaamijka <Text style={{ color: c.green }}>Kobciye</Text></Text>
        <Text style={[styles.secSub, { color: c.muted }]}>Qiimuhu wuxuu ku xidhan yahay cadadka ardayda fasalka — bilow bil kasta aad doortid.</Text>
        <View style={[styles.freeBanner, { backgroundColor: c.navy }]}>
          <Text style={styles.freeEmoji}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.freeTitle}>1 Bil Bilaash Ah!</Text>
            <Text style={styles.freeSub}>Tijaabi dhammaan nidaamyada — lacag la'aan, xaddid la'aan.</Text>
          </View>
        </View>
        <View style={[styles.priceGrid, { flexDirection: width >= 760 ? 'row' : 'column' }]}>
          {PLANS.map((p) => (
            <View key={p.name} style={[styles.plan, { backgroundColor: c.surface, borderColor: p.popular ? c.navy : c.line, borderWidth: p.popular ? 2 : 1 }, shadow.sm]}>
              <View style={[styles.diamond, { backgroundColor: c.ink }]}>
                <Text style={styles.diamondRate}>{p.rate}</Text>
                <Text style={styles.diamondPer}>/{p.per}</Text>
              </View>
              <Text style={[styles.planName, { color: c.ink }]}>{p.name}</Text>
              <View style={styles.planCap}><Icon name="students" size={14} color={c.blue} /><Text style={[styles.planCapTxt, { color: c.blue }]}>{p.cap}</Text></View>
              <View style={[styles.exampleBox, { backgroundColor: c.greenSoft }]}>
                <Text style={[styles.exampleTxt, { color: c.green }]}>🎁 {p.example}</Text>
              </View>
              <Text style={[styles.featsLbl, { color: c.muted }]}>NIDAAMYADA AAD KA DHEX HELAYSO:</Text>
              {p.feats.map((f) => (
                <View key={f} style={styles.featRow}>
                  <Icon name="check" size={15} color={c.green} strokeWidth={2.5} />
                  <Text style={[styles.featLine, { color: c.ink2 }]}>{f}</Text>
                </View>
              ))}
              <TouchableOpacity style={[styles.planBtn, { backgroundColor: c.navy }]} onPress={onLogin}>
                <Text style={styles.planBtnTxt}>Bilaaw Hadda →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* contact */}
        <View style={[styles.badge, { backgroundColor: c.greenSoft, alignSelf: 'center', marginTop: 30 }]}>
          <Text style={[styles.badgeTxt, { color: c.green }]}>NALA SOO XIDHIIDH</Text>
        </View>
        <Text style={[styles.secTitle, { color: c.ink, marginTop: 10 }]}>Nala Soo <Text style={{ color: c.green }}>Xidhiidh</Text></Text>
        <Text style={[styles.secSub, { color: c.muted }]}>Su'aalo ma qabtaa ama caawimo ma u baahantahay? Kobciye team-ku wuu diyaar yahay.</Text>
        <View style={styles.contactGrid}>
          {CONTACT.map(([icon, label, val, col]) => (
            <View key={label} style={[styles.contactCard, { backgroundColor: c.surface, borderColor: c.line, width: cols === 1 ? '48%' : '23.5%' }]}>
              <View style={[styles.contactIcon, { backgroundColor: col + '22' }]}><Icon name={icon} size={20} color={col} /></View>
              <Text style={[styles.contactLbl, { color: c.muted }]}>{label}</Text>
              <Text style={[styles.contactVal, { color: c.ink }]}>{val}</Text>
            </View>
          ))}
        </View>

        {/* footer */}
        <View style={[styles.footer, { backgroundColor: c.navy }]}>
          <Text style={styles.footBrand}>Kobciye</Text>
          <Text style={styles.footSub}>Kobciye — Cloud-Based School Management System</Text>
          <Text style={styles.footSub}>Gabiley, Somaliland · kobciye.com</Text>
          <Text style={styles.footCopy}>© 2025 Kobciye. Dhammaan xuquuqda way ilaalisan yihiin.</Text>
        </View>
      </ScrollView>
      <WhatsAppFab />
    </SafeAreaView>
  );
}

/* ═══════════════════ LANDING SCREEN (ENTRY) ════════════════════ */
export default function LandingScreen({ onEnter, onMinistry }) {
  const [showLogin, setShowLogin] = useState(false);

  const openLogin = useCallback(() => setShowLogin(true), []);
  const close     = useCallback(() => setShowLogin(false), []);

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS === 'web'
        ? <WebLanding onEnter={openLogin} />
        : <NativeLanding onLogin={openLogin} />}

      {showLogin && <LoginModal onClose={close} onMinistry={onMinistry} />}
    </View>
  );
}

/* ═══════════════════ PAGE STYLES ═══════════════════════════════ */
const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 0, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandWord: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  brandSub: { fontSize: 10.5, fontWeight: '600' },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  langWrap: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, padding: 2 },
  langBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 18 },
  langTxt: { fontSize: 12, fontWeight: '800' },
  loginBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12 },
  loginTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  heroWrap: { marginTop: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  badgeTxt: { fontSize: 11.5, fontWeight: '700' },
  h1: { fontSize: 32, fontWeight: '800', lineHeight: 40, marginTop: 16 },
  sub: { fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 13, paddingHorizontal: 22, borderRadius: 14, marginTop: 22 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pills: { flexDirection: 'row', gap: 26, marginTop: 24 },
  pillVal: { fontSize: 24, fontWeight: '800' },
  pillLbl: { fontSize: 12, marginTop: 1 },
  mock: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  mockTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  mockBrand: { color: '#fff', fontSize: 15, fontWeight: '800' },
  mockIcons: { flexDirection: 'row', gap: 12 },
  mockTabs: { flexDirection: 'row', gap: 8, padding: 12 },
  mockTab: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  mockTabTxt: { fontSize: 10, fontWeight: '800' },
  mockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  mockAv: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mockName: { fontSize: 13, fontWeight: '700' },
  mockCls: { fontSize: 11, marginTop: 1 },
  mockBadge: { borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9 },
  mockBadgeTxt: { fontSize: 10.5, fontWeight: '700' },
  secTitle: { fontSize: 22, fontWeight: '800', marginTop: 32, textAlign: 'center' },
  secSub: { fontSize: 13.5, marginTop: 4, marginBottom: 16, textAlign: 'center', lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  feat: { borderWidth: 1, borderRadius: radius.md, padding: 16, marginBottom: 12 },
  featIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featTitle: { fontSize: 15.5, fontWeight: '800' },
  featDesc: { fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  aiWrap: { marginTop: 28, marginHorizontal: -16, padding: 24, borderRadius: 0 },
  aiCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', maxWidth: 420, width: '100%', alignSelf: 'center' },
  aiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  aiHi: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  aiBadgeTxt: { fontSize: 12.5, fontWeight: '800' },
  aiNote: { fontSize: 11.5, marginTop: 4, marginBottom: 10, lineHeight: 16 },
  aiTeach: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  aiMsgBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9 },
  aiMsgTxt: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  freeBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 16 },
  freeEmoji: { fontSize: 22 },
  freeTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  freeSub: { color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 2 },
  priceGrid: { gap: 14 },
  plan: { flex: 1, borderRadius: radius.lg, padding: 20, alignItems: 'center' },
  diamond: { width: 96, height: 96, borderRadius: 20, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }], marginBottom: 18 },
  diamondRate: { color: '#22C55E', fontSize: 22, fontWeight: '800', transform: [{ rotate: '-45deg' }] },
  diamondPer: { color: 'rgba(255,255,255,.7)', fontSize: 10, transform: [{ rotate: '-45deg' }], marginTop: -2 },
  planName: { fontSize: 18, fontWeight: '800' },
  planCap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  planCapTxt: { fontSize: 13, fontWeight: '700' },
  exampleBox: { borderRadius: 12, padding: 12, marginVertical: 14, width: '100%' },
  exampleTxt: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  featsLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, alignSelf: 'flex-start', marginBottom: 8 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginVertical: 4 },
  featLine: { fontSize: 13 },
  planBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  planBtnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  contactCard: { borderWidth: 1, borderRadius: radius.md, padding: 16, alignItems: 'center', marginBottom: 12 },
  contactIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  contactLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  contactVal: { fontSize: 13, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  footer: { marginHorizontal: -16, marginTop: 24, padding: 28, alignItems: 'center' },
  footBrand: { color: '#fff', fontSize: 20, fontWeight: '800' },
  footSub: { color: 'rgba(255,255,255,.7)', fontSize: 12.5, marginTop: 6, textAlign: 'center' },
  footCopy: { color: 'rgba(255,255,255,.5)', fontSize: 11.5, marginTop: 16, textAlign: 'center' },
});
