/* Akoonnada — School Admin provisions logins for EXISTING teacher / student /
   parent records. "U dir Casuumaad" (invite), "Dib u dir" (resend) and "Jooji"
   (revoke) all go through the provision-account Edge Function, which does the
   Supabase Auth admin work server-side (no service-role key in the client) and
   records the invitation via create_account_invitation. Never creates a second
   domain record. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, TextInput } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { ModuleScreenFrame, useAsyncData, SuccessNote, ErrorNote, SaveButton } from '../../components/Phase5Scaffold';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listAccountInvitations, provisionAccount, revokeAccountInvitation, p5FriendlyError } from '../../services/phase5';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const TABS = [
  { role: 'teacher', label: 'Macallimiin', table: 'teachers', nameKey: 'full_name', idKey: 'teacher_id' },
  { role: 'student', label: 'Ardayda', table: 'students', nameKey: 'full_name', idKey: 'student_id' },
  { role: 'parent', label: 'Waalidiin', table: 'parents', nameKey: 'full_name', idKey: 'parent_id' },
];

export default function ProvisioningScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const [tab, setTab] = useState(TABS[0]);
  const [busy, setBusy] = useState(null);
  const [success, setSuccess] = useState('');
  const [err, setErr] = useState('');
  // invite dialog: an authorised admin may enter/correct the email before sending
  const [inviteRec, setInviteRec] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  // one-time credentials for a no-email student (shown ONCE, never re-fetchable)
  const [credentials, setCredentials] = useState(null);

  const { data, loading, error, reload } = useAsyncData(
    async () => ({
      records: await p4List(tab.table, schoolId),
      invites: await listAccountInvitations(schoolId, { intended_role: tab.role }),
    }),
    [schoolId, tab.role], { enabled: isLive && !!schoolId },
  );

  const records = (data && data.records) || [];
  const invites = (data && data.invites) || [];
  const inviteFor = (recId) => invites.find((i) => i[tab.idKey] === recId && i.status === 'pending')
    || invites.find((i) => i[tab.idKey] === recId);

  // open the invite dialog (prefill the record's email so the admin can edit it)
  const openInvite = (rec) => {
    setInviteRec(rec); setInviteEmail(rec.email || ''); setInviteErr(''); setSuccess(''); setErr('');
  };

  const submitInvite = async (action = 'invite') => {
    if (inviteBusy || !inviteRec) return;
    const rec = inviteRec;
    const emailTrim = inviteEmail.trim();
    // teacher/parent MUST have a valid email; a student may be provisioned with
    // no email (a generated login + one-time temp password is returned instead).
    if (tab.role !== 'student' && !EMAIL_RE.test(emailTrim)) {
      setInviteErr('Geli email sax ah.'); return;
    }
    if (tab.role === 'student' && emailTrim && !EMAIL_RE.test(emailTrim)) {
      setInviteErr('Email-ku ma saxna. Ka tag faaruq haddii aan la haysan.'); return;
    }
    setInviteBusy(true); setInviteErr('');
    try {
      const res = await provisionAccount({
        action, role: tab.role, school_id: schoolId,
        [tab.idKey]: rec.id, email: emailTrim, name: rec[tab.nameKey] || '', phone: rec.phone || '',
      });
      setInviteRec(null);
      if (res && res.credentials) {
        setCredentials(res.credentials);       // show the one-time student credentials
      } else {
        setSuccess(action === 'resend' ? 'Casuumaad dib loo diray.' : 'Casuumaad la diray.');
      }
      await reload();
    } catch (e) { setInviteErr(p5FriendlyError(e)); }
    finally { setInviteBusy(false); }
  };

  // resend keeps the previously-recorded email (no dialog needed)
  const doResend = async (rec) => {
    if (busy) return;
    setBusy(rec.id); setSuccess(''); setErr('');
    try {
      const res = await provisionAccount({
        action: 'resend', role: tab.role, school_id: schoolId,
        [tab.idKey]: rec.id, email: rec.email || '', name: rec[tab.nameKey] || '', phone: rec.phone || '',
      });
      if (res && res.credentials) setCredentials(res.credentials);
      else setSuccess('Casuumaad dib loo diray.');
      await reload();
    } catch (e) { setErr(p5FriendlyError(e)); }
    finally { setBusy(null); }
  };
  const doRevoke = async (inv) => {
    if (busy) return;
    setBusy(inv.id); setSuccess(''); setErr('');
    try { await revokeAccountInvitation(inv.id); setSuccess('Casuumaad waa la joojiyay.'); await reload(); }
    catch (e) { setErr(p5FriendlyError(e)); }
    finally { setBusy(null); }
  };

  return (
    <ModuleScreenFrame title="Akoonnada" subtitle="U samee gelitaan macallimiin/arday/waalid">
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.role} onPress={() => setTab(t)}
            style={[styles.tab, { borderColor: tab.role === t.role ? c.blue : c.line, backgroundColor: tab.role === t.role ? c.blueSoft : c.surface }]}>
            <Text style={[styles.tabTxt, { color: tab.role === t.role ? c.blue : c.muted }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <SuccessNote text={success} />
      <ErrorNote text={err} />

      {loading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
      : error ? (
        <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
          <Text style={[styles.boxSub, { color: c.rose }]}>{error}</Text>
          <TouchableOpacity onPress={reload}><Text style={{ color: c.blue, fontWeight: '700', marginTop: 8 }}>Isku day mar kale</Text></TouchableOpacity>
        </View>
      ) : records.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="profile" size={24} color={c.muted2} />
          <Text style={[styles.boxSub, { color: c.muted }]}>Weli diiwaan lama diiwaangelin.</Text>
        </View>
      ) : (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
          {records.map((rec, i) => {
            const inv = inviteFor(rec.id);
            const linked = rec.profile_id;
            return (
              <View key={rec.id} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{rec[tab.nameKey]}</Text>
                  <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
                    {linked ? 'Akoon firfircoon' : inv ? `Casuumaad: ${inv.status}` : 'Akoon ma laha'}
                  </Text>
                </View>
                {busy === rec.id || (inv && busy === inv.id) ? <ActivityIndicator color={c.blue} /> : linked ? (
                  <Text style={[styles.active, { color: c.green }]}>Firfircoon</Text>
                ) : inv && inv.status === 'pending' ? (
                  <>
                    <TouchableOpacity onPress={() => doResend(rec)} style={[styles.btn, { borderColor: c.line }]}><Text style={[styles.btnTxt, { color: c.blue }]}>Dib u dir</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => doRevoke(inv)} style={[styles.btn, { borderColor: c.line }]}><Text style={[styles.btnTxt, { color: c.rose }]}>Jooji</Text></TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => openInvite(rec)} style={[styles.btn, { backgroundColor: c.blue, borderColor: c.blue }]}><Text style={[styles.btnTxt, { color: '#fff' }]}>U dir Casuumaad</Text></TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* invite dialog — editable email (required for teacher/parent) */}
      <Modal visible={!!inviteRec} transparent animationType="fade" onRequestClose={() => setInviteRec(null)}>
        <Pressable style={styles.overlay} onPress={() => setInviteRec(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>U dir Casuumaad · {inviteRec ? inviteRec[tab.nameKey] : ''}</Text>
            <Text style={[styles.lbl, { color: c.muted }]}>
              EMAIL {tab.role === 'student' ? '(IKHTIYAARI)' : '(QASAB)'}
            </Text>
            <TextInput value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address"
              placeholder="tusaale: qof@email.com" placeholderTextColor={c.muted2}
              style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
            {tab.role === 'student' ? (
              <Text style={[styles.hint, { color: c.muted }]}>
                Haddii aan email la gelin, akoon gudaha ah ayaa la abuuri doonaa, furaha ku-meel-gaadhka ahna hal mar ayaa la tusi doonaa.
              </Text>
            ) : null}
            <ErrorNote text={inviteErr} />
            <SaveButton onPress={() => submitInvite('invite')} saving={inviteBusy} label="Dir" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* one-time student credentials — shown once, never re-fetchable */}
      <Modal visible={!!credentials} transparent animationType="fade" onRequestClose={() => setCredentials(null)}>
        <Pressable style={styles.overlay} onPress={() => setCredentials(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>Furaha ku-meel-gaadhka ah</Text>
            <Text style={[styles.hint, { color: c.rose }]}>
              Hal mar ayaa la tusayaa. Sii ardayga, ka dibna ma soo bandhigi doono mar kale.
            </Text>
            {credentials ? (
              <View style={[styles.credBox, { backgroundColor: c.bg, borderColor: c.line }]}>
                <CredRow c={c} label="School ID" value={credentials.school_code} />
                <CredRow c={c} label="Student ID" value={credentials.student_id} />
                <CredRow c={c} label="Furaha" value={credentials.temp_password} />
              </View>
            ) : null}
            <Text style={[styles.hint, { color: c.muted }]}>Marka uu markii ugu horreysay galo, waa in uu furaha beddelaa.</Text>
            <TouchableOpacity onPress={() => setCredentials(null)} style={[styles.doneBtn, { backgroundColor: c.blue }]}>
              <Text style={styles.doneTxt}>Waan xasuustay</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ModuleScreenFrame>
  );
}

function CredRow({ c, label, value }) {
  return (
    <View style={styles.credRow}>
      <Text style={[styles.credLbl, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.credVal, { color: c.ink }]} selectable>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  tabTxt: { fontSize: 12.5, fontWeight: '800' },
  state: { alignItems: 'center', paddingVertical: 30 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14 },
  name: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 16.5, fontWeight: '800', marginBottom: 14 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7 },
  input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  hint: { fontSize: 12, fontWeight: '600', marginTop: 10, lineHeight: 17 },
  credBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, gap: 10 },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credLbl: { fontSize: 12, fontWeight: '700' },
  credVal: { fontSize: 14, fontWeight: '800' },
  doneBtn: { height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  doneTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  active: { fontSize: 12, fontWeight: '800' },
  btn: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 },
  btnTxt: { fontSize: 11.5, fontWeight: '800' },
});
