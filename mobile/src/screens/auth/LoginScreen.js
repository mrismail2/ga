import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';
import LoadingDots from '../../components/LoadingDots';

/* Login-method tabs (NOT the demo role-picker — that entry point is gone).
   All three are wired to REAL Supabase auth:
     • staff  → email + password (signInWithEmail)
     • student→ School ID + Student ID + password  (identifier-login Edge Fn)
     • parent → School ID + Child Student ID + password (identifier-login)
   The student/parent path returns a normal Supabase session via setSession, so
   refresh/Sign Out/RLS/password-reset all work identically. No mockups, no
   "coming soon", no local auth. */
const METHODS = [
  { key: 'staff', label: 'Dugsiga', icon: 'building' },
  { key: 'student', label: 'Arday', icon: 'students' },
  { key: 'parent', label: 'Waalid', icon: 'profile' },
];

const FEATURE_CHIPS = [
  { icon: 'students', label: 'Ardayda' },
  { icon: 'attendance', label: 'Xaadiriska' },
  { icon: 'exams', label: 'Imtixaannada' },
  { icon: 'finance', label: 'Maaliyadda' },
];

export default function LoginScreen({ goForgot }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { signIn, signInWithSchoolIdentifier, configured } = useAuth();

  const [method, setMethod] = useState('staff');

  // staff (real) fields
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // student / parent identifier-login fields
  const [schoolId, setSchoolId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [idPw, setIdPw] = useState('');
  const [showIdPw, setShowIdPw] = useState(false);

  const login = async () => {
    if (busy) return;                       // prevent duplicate submits
    setErr(null);
    if (!configured) { setErr('Backend-ka Supabase lama habayn. La xiriir maamulaha Kobciye.'); return; }
    if (!email.trim() || !pw) { setErr('Geli email iyo furaha sirta.'); return; }
    setBusy(true);
    try {
      await signIn(email.trim(), pw);       // AuthContext routes on success
    } catch (e) {
      setErr(e && e.message ? e.message : 'Sign in failed. Check your details.');
    } finally {
      setBusy(false);
    }
  };

  // REAL student/parent identifier login → normal Supabase session.
  const loginByIdentifier = async () => {
    if (busy) return;                       // prevent duplicate submits
    setErr(null);
    if (!configured) { setErr('Backend-ka Supabase lama habayn. La xiriir maamulaha Kobciye.'); return; }
    if (!schoolId.trim() || !studentId.trim() || !idPw) {
      setErr('Geli School ID, Student ID iyo furaha sirta.'); return;
    }
    setBusy(true);
    try {
      await signInWithSchoolIdentifier({
        kind: method,                       // 'student' | 'parent'
        schoolCode: schoolId.trim(),
        studentId: studentId.trim(),
        password: idPw,
      });                                   // AuthContext routes on success
    } catch (e) {
      setErr(e && e.message ? e.message : 'Galitaanku wuu fashilmay. Hubi xogtaada.');
    } finally {
      setBusy(false);
    }
  };

  const selectMethod = (k) => {
    setMethod(k);
    setErr(null);
    setIdPw(''); setShowIdPw(false);
  };

  const idPlaceholderStudent = { school: 'tusaale: SCH-0042', student: 'tusaale: HID-000142' };
  const idPlaceholderParent = { school: 'tusaale: SCH-0042', student: "ID-ga arday-kaaga (tusaale: HID-000142)" };

  const Brand = (
    <View style={[styles.brandPanel, { backgroundColor: c.navy }, wide ? styles.brandPanelWide : styles.brandPanelNarrow]}>
      <Logo size={40} variant="white" />
      <Text style={styles.brandHeadline}>
        Si Fudud U Maamul Xogta <Text style={{ color: c.gold }}>Ardayda</Text> & Dugsigaaga
      </Text>
      {wide ? (
        <>
          <Text style={styles.brandSub}>
            Nidaam keliya oo lagu maamulo ardayda, xaadiriska, imtixaannada iyo maaliyadda dugsigaaga.
          </Text>
          <View style={styles.chipsRow}>
            {FEATURE_CHIPS.map((f) => (
              <View key={f.label} style={styles.chip}>
                <View style={styles.chipIcon}><Icon name={f.icon} size={16} color="#fff" /></View>
                <Text style={styles.chipTxt}>{f.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={wide ? styles.contentWide : styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {Brand}

          <View style={[styles.formCol, wide && styles.formColWide]}>
            <Text style={[styles.title, { color: c.ink }]}>Soo gal akoonkaaga</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>Dooro sida aad u gali doonto</Text>

            {/* login-method tabs */}
            <View style={[styles.tabs, { backgroundColor: c.bg, borderColor: c.line }]}>
              {METHODS.map((m) => {
                const on = method === m.key;
                return (
                  <TouchableOpacity key={m.key} onPress={() => selectMethod(m.key)}
                    style={[styles.tab, on && { backgroundColor: c.navy }]} activeOpacity={0.85}>
                    <Icon name={m.icon} size={14} color={on ? '#fff' : c.muted} />
                    <Text style={[styles.tabTxt, { color: on ? '#fff' : c.muted }]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
              {method === 'staff' ? (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>EMAIL</Text>
                  <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="mail" size={17} color={c.muted2} />
                    <TextInput value={email} onChangeText={setEmail} placeholder="tusaale: admin@dugsi.edu"
                      placeholderTextColor={c.muted2} autoCapitalize="none" keyboardType="email-address"
                      style={[styles.input, { color: c.ink }]} />
                  </View>

                  <Text style={[styles.label, { color: c.muted }]}>FURAHA SIRTA</Text>
                  <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="key" size={17} color={c.muted2} />
                    <TextInput value={pw} onChangeText={setPw} placeholder="••••••••" secureTextEntry={!showPw}
                      placeholderTextColor={c.muted2} style={[styles.input, { color: c.ink }]} />
                    <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                      <Text style={[styles.showTxt, { color: c.blue }]}>{showPw ? 'Qari' : 'Tus'}</Text>
                    </TouchableOpacity>
                  </View>

                  {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}

                  <TouchableOpacity style={[styles.loginBtn, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]}
                    onPress={login} activeOpacity={0.9} disabled={busy}>
                    {busy ? <LoadingDots color="#fff" size={7} gap={5} /> : (
                      <>
                        <Text style={styles.loginTxt}>Soo Gal</Text>
                        <Icon name="chevronRight" size={18} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={goForgot} style={{ alignSelf: 'center', marginTop: 14 }}>
                    <Text style={[styles.link, { color: c.blue }]}>Ma illowday furaha sirta?</Text>
                  </TouchableOpacity>

                  {/* invite-only: schools are registered by the Kobciye super
                      admin. No public school self-registration, no demo mode. */}
                  <Text style={[styles.infoTxt, { color: c.muted }]}>
                    School registration is handled by the Kobciye Super Admin.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>ID-GA DUGSIGA (SCHOOL ID)</Text>
                  <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="building" size={17} color={c.muted2} />
                    <TextInput value={schoolId} onChangeText={setSchoolId}
                      placeholder={method === 'student' ? idPlaceholderStudent.school : idPlaceholderParent.school}
                      placeholderTextColor={c.muted2} autoCapitalize="characters" autoCorrect={false}
                      style={[styles.input, { color: c.ink }]} />
                  </View>

                  <Text style={[styles.label, { color: c.muted }]}>
                    {method === 'student' ? 'ID-GAAGA ARDAY (STUDENT ID)' : 'ID-GA ARDAY-GAAGA (CHILD’S STUDENT ID)'}
                  </Text>
                  <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="students" size={17} color={c.muted2} />
                    <TextInput value={studentId} onChangeText={setStudentId}
                      placeholder={method === 'student' ? idPlaceholderStudent.student : idPlaceholderParent.student}
                      placeholderTextColor={c.muted2} autoCapitalize="characters" autoCorrect={false}
                      style={[styles.input, { color: c.ink }]} />
                  </View>

                  <Text style={[styles.label, { color: c.muted }]}>
                    {method === 'student' ? 'FURAHA ARDAYGA' : 'FURAHA WAALIDKA'}
                  </Text>
                  <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="key" size={17} color={c.muted2} />
                    <TextInput value={idPw} onChangeText={setIdPw} placeholder="••••••••" secureTextEntry={!showIdPw}
                      placeholderTextColor={c.muted2} style={[styles.input, { color: c.ink }]} />
                    <TouchableOpacity onPress={() => setShowIdPw((v) => !v)} hitSlop={8}>
                      <Text style={[styles.showTxt, { color: c.blue }]}>{showIdPw ? 'Qari' : 'Tus'}</Text>
                    </TouchableOpacity>
                  </View>

                  {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}

                  <TouchableOpacity style={[styles.loginBtn, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]}
                    onPress={loginByIdentifier} activeOpacity={0.9} disabled={busy}>
                    {busy ? <LoadingDots color="#fff" size={7} gap={5} /> : (
                      <>
                        <Text style={styles.loginTxt}>Soo Gal</Text>
                        <Icon name="chevronRight" size={18} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={goForgot} style={{ alignSelf: 'center', marginTop: 14 }}>
                    <Text style={[styles.link, { color: c.blue }]}>Ma illowday furaha sirta?</Text>
                  </TouchableOpacity>

                  <Text style={[styles.infoTxt, { color: c.muted }]}>
                    {method === 'student'
                      ? 'Isticmaal School ID iyo Student ID-gaaga oo dugsigu ku siiyay.'
                      : 'Isticmaal School ID iyo Student ID-ga ilmahaaga.'}
                  </Text>
                </>
              )}
            </View>
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
  brandHeadline: { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 20, lineHeight: 34, maxWidth: 440 },
  brandSub: { color: 'rgba(255,255,255,.75)', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 14, lineHeight: 21, maxWidth: 400 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  chipTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  formCol: { padding: 22, paddingTop: 28 },
  formColWide: { flex: 1, maxWidth: 460, justifyContent: 'center', alignSelf: 'center', width: '100%' },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 18 },
  tabs: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9 },
  tabTxt: { fontSize: 12.5, fontWeight: '700' },
  card: { borderRadius: 18, borderWidth: 1, padding: 18 },
  soonBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 6 },
  soonTxt: { fontSize: 11.5, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 14 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: 14.5 },
  showTxt: { fontSize: 12.5, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 14, marginTop: 22 },
  loginTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  link: { fontSize: 13.5, fontWeight: '700' },
  infoTxt: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
