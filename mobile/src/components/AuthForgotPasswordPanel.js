/* ============================================================
   Kobciye — role-aware Forgot Password panel

   Staff: email recovery link.
   Student: full name + public School ID + active class + linked guardian
            mobile → WhatsApp OTP → new password.
   Parent: public School ID + own mobile → WhatsApp OTP → new password.

   This changes ONLY password recovery. Normal Student/Parent login remains
   School ID + Student ID + password. No local auth or plaintext OTP storage.
   ============================================================ */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';

const METHODS = [
  { key: 'staff', label: 'Dugsiga', icon: 'building' },
  { key: 'student', label: 'Arday', icon: 'students' },
  { key: 'parent', label: 'Waalid', icon: 'profile' },
];

const GENERIC = 'Haddii xogtu sax tahay, koodh ayaa loo diray WhatsApp-ka ku xiran akoonka.';

export default function AuthForgotPasswordPanel({ initialMethod = 'staff', onBack }) {
  const { c } = useTheme();
  const { requestPasswordReset, requestIdentifierPasswordReset, verifyIdentifierPasswordReset, configured } = useAuth();
  const [method, setMethod] = useState(initialMethod || 'staff');
  const [step, setStep] = useState('request'); // request | verify | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const changeMethod = (next) => {
    setMethod(next); setStep('request'); setErr(null); setMsg(null);
    setChallengeId(null); setCode(''); setNewPassword(''); setConfirmPassword(''); setSeconds(0);
  };

  const request = async ({ isResend = false } = {}) => {
    if (busy) return;
    setErr(null); setMsg(null);

    if (method === 'staff') {
      if (!email.trim()) { setErr('Fadlan geli email-kaaga.'); return; }
      if (!configured) {
        setMsg('Haddii email-kan uu leeyahay account shaqaynaya, link dib-u-dejin ah ayaa loo diri doonaa.');
        setStep('done');
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(email.trim());
        setMsg('Haddii email-kan uu leeyahay account shaqaynaya, link dib-u-dejin ah ayaa loo diri doonaa.');
        setStep('done');
      } catch (_e) {
        setMsg('Haddii email-kan uu leeyahay account shaqaynaya, link dib-u-dejin ah ayaa loo diri doonaa.');
        setStep('done');
      } finally { setBusy(false); }
      return;
    }

    if (!schoolCode.trim() || !parentPhone.trim()) {
      setErr('Geli ID-ga dugsiga iyo mobile-ka waalidka.'); return;
    }
    if (method === 'student' && (!fullName.trim() || !className.trim())) {
      setErr('Geli magaca ardayga oo buuxa iyo fasalka hadda.'); return;
    }

    if (!configured) {
      setChallengeId('demo_challenge');
      setSeconds(300);
      setMsg(GENERIC);
      setStep('verify');
      return;
    }

    setBusy(true);
    try {
      const result = await requestIdentifierPasswordReset({
        kind: method,
        schoolCode: schoolCode.trim(),
        fullName: method === 'student' ? fullName.trim() : null,
        className: method === 'student' ? className.trim() : null,
        parentPhone: parentPhone.trim(),
      });
      setChallengeId(result && result.challenge_id ? result.challenge_id : null);
      setSeconds(Number(result && result.expires_in) || 300);
      setMsg(GENERIC);
      setStep('verify');
    } catch (e) {
      setErr(e && e.message ? e.message : 'Koodhka WhatsApp lama diri karo hadda. Isku day mar kale.');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (busy) return;
    setErr(null);
    if (!challengeId || !/^\d{6}$/.test(code.trim())) { setErr('Geli koodhka 6-da lambar ah.'); return; }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErr('Furaha cusub waa inuu leeyahay ugu yaraan 8 xaraf, xaraf iyo lambar.'); return;
    }
    if (newPassword !== confirmPassword) { setErr('Labada furaha isku mid ma aha.'); return; }

    if (!configured) {
      setMsg('Furaha sirta waa la beddelay. Hadda ku gal furaha cusub.');
      setStep('done');
      return;
    }

    setBusy(true);
    try {
      const result = await verifyIdentifierPasswordReset({
        challengeId,
        code: code.trim(),
        newPassword,
      });
      setMsg((result && result.message) || 'Furaha sirta waa la beddelay. Hadda ku gal furaha cusub.');
      setStep('done');
    } catch (e) {
      setErr(e && e.message ? e.message : 'Koodhku ma saxna ama wuu dhacay.');
    } finally { setBusy(false); }
  };

  const resend = async () => {
    if (seconds > 240 || busy) return; // at least 60 seconds after the last request
    setChallengeId(null); setCode(''); setMsg(null); setErr(null);
    await request({ isResend: true });
  };

  return (
    <View>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backRow} hitSlop={8}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chevronRight" size={15} color={c.muted} /></View>
          <Text style={[styles.backTxt, { color: c.muted }]}>Ku noqo</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.title, { color: c.ink }]}>Furaha sirta ma illowday?</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>Dooro nooca akoonka oo xaqiiji aqoonsigaaga.</Text>

      <View style={[styles.tabs, { backgroundColor: c.bg, borderColor: c.line }]}> 
        {METHODS.map((item) => {
          const active = method === item.key;
          return (
            <TouchableOpacity key={item.key} onPress={() => changeMethod(item.key)}
              style={[styles.tab, active && { backgroundColor: c.navy }]} activeOpacity={0.85}>
              <Icon name={item.icon} size={14} color={active ? '#fff' : c.muted} />
              <Text style={[styles.tabTxt, { color: active ? '#fff' : c.muted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {step === 'done' ? (
        <View style={[styles.note, { backgroundColor: c.greenSoft }]}> 
          <Icon name="check" size={18} color={c.green} />
          <Text style={[styles.noteTxt, { color: c.green }]}>{msg}</Text>
          <TouchableOpacity onPress={onBack || (() => { setStep('request'); setMsg(null); })} style={[styles.doneBtn, { backgroundColor: c.navy }]}> 
            <Text style={styles.btnTxt}>Ku noqo soo galitaanka</Text>
          </TouchableOpacity>
        </View>
      ) : step === 'verify' ? (
        <>
          {msg ? <Text style={[styles.generic, { color: c.muted }]}>{msg}</Text> : null}
          <Text style={[styles.label, { color: c.muted }]}>KOODHKA WHATSAPP</Text>
          <Field icon="key" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" keyboardType="number-pad" c={c} />
          <Text style={[styles.label, { color: c.muted }]}>FURAHA CUSUB</Text>
          <PasswordField value={newPassword} onChangeText={setNewPassword} show={showPassword} setShow={setShowPassword} c={c} />
          <Text style={[styles.label, { color: c.muted }]}>KU CELI FURAHA</Text>
          <Field icon="key" value={confirmPassword} onChangeText={setConfirmPassword}
            placeholder="••••••••" secureTextEntry={!showPassword} c={c} />
          {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}
          <TouchableOpacity style={[styles.primary, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]}
            onPress={verify} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Xaqiiji oo beddel furaha</Text>}
          </TouchableOpacity>
          <View style={styles.resendRow}>
            <TouchableOpacity onPress={resend} disabled={busy || seconds > 240}>
              <Text style={[styles.link, { color: seconds > 240 ? c.muted2 : c.blue }]}>Dib u dir koodhka</Text>
            </TouchableOpacity>
            <Text style={[styles.timer, { color: c.muted }]}>{seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Wuu dhacay'}</Text>
          </View>
        </>
      ) : (
        <>
          {method === 'staff' ? (
            <>
              <Text style={[styles.label, { color: c.muted }]}>EMAIL</Text>
              <Field icon="mail" value={email} onChangeText={setEmail} placeholder="tusaale: admin@dugsi.edu"
                keyboardType="email-address" autoCapitalize="none" c={c} />
            </>
          ) : (
            <>
              {method === 'student' ? (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>MAGACA ARDAYGA OO BUUXA</Text>
                  <Field icon="profile" value={fullName} onChangeText={setFullName} placeholder="Magaca oo buuxa" c={c} />
                </>
              ) : null}
              <Text style={[styles.label, { color: c.muted }]}>ID-GA DUGSIGA</Text>
              <Field icon="building" value={schoolCode} onChangeText={setSchoolCode} placeholder="tusaale: SCH-0042"
                autoCapitalize="characters" c={c} />
              {method === 'student' ? (
                <>
                  <Text style={[styles.label, { color: c.muted }]}>FASALKA HADDA</Text>
                  <Field icon="classes" value={className} onChangeText={setClassName} placeholder="tusaale: Fasalka 8A" c={c} />
                </>
              ) : null}
              <Text style={[styles.label, { color: c.muted }]}>{method === 'student' ? 'MOBILE-KA WAALIDKA' : 'MOBILE-KA WAALIDKA'}</Text>
              <Field icon="phone" value={parentPhone} onChangeText={setParentPhone} placeholder="tusaale: +25263XXXXXXX"
                keyboardType="phone-pad" c={c} />
            </>
          )}
          {err ? <Text style={[styles.err, { color: c.rose }]}>{err}</Text> : null}
          <TouchableOpacity style={[styles.primary, { backgroundColor: c.navy, opacity: busy ? 0.7 : 1 }]}
            onPress={request} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{method === 'staff' ? 'Dir Link-ga' : 'U dir Koodh WhatsApp'}</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function Field({ icon, c, ...props }) {
  return (
    <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}> 
      <Icon name={icon} size={17} color={c.muted2} />
      <TextInput {...props} placeholderTextColor={c.muted2} style={[styles.input, { color: c.ink }]} />
    </View>
  );
}

function PasswordField({ value, onChangeText, show, setShow, c }) {
  return (
    <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}> 
      <Icon name="key" size={17} color={c.muted2} />
      <TextInput value={value} onChangeText={onChangeText} placeholder="••••••••" secureTextEntry={!show}
        placeholderTextColor={c.muted2} style={[styles.input, { color: c.ink }]} />
      <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={8}>
        <Text style={[styles.link, { color: c.blue }]}>{show ? 'Qari' : 'Tus'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 5, marginBottom: 16, lineHeight: 19 },
  tabs: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  tabTxt: { fontSize: 12.5, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 14 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13, height: 50 },
  input: { flex: 1, fontSize: 14.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 12, textAlign: 'center', lineHeight: 18 },
  generic: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18, marginTop: 10 },
  primary: { minHeight: 52, borderRadius: 14, marginTop: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  btnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800', textAlign: 'center' },
  link: { fontSize: 12.5, fontWeight: '700' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  timer: { fontSize: 12.5, fontWeight: '700' },
  note: { borderRadius: 16, padding: 18, alignItems: 'center', gap: 10, marginTop: 12 },
  noteTxt: { fontSize: 13.5, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  doneBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, marginTop: 6 },
});
