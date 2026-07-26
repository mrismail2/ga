/* Akoonnada — School Admin provisions logins for EXISTING teacher / student /
   parent records. "U dir Casuumaad" (invite), "Dib u dir" (resend) and "Jooji"
   (revoke) all go through the provision-account Edge Function, which does the
   Supabase Auth admin work server-side (no service-role key in the client) and
   records the invitation via create_account_invitation. Never creates a second
   domain record. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { ModuleScreenFrame, useAsyncData, SuccessNote, ErrorNote } from '../../components/Phase5Scaffold';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listAccountInvitations, provisionAccount, revokeAccountInvitation, p5FriendlyError } from '../../services/phase5';

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

  const doInvite = async (rec, action = 'invite') => {
    if (busy) return;
    setBusy(rec.id); setSuccess(''); setErr('');
    try {
      await provisionAccount({
        action, role: tab.role, school_id: schoolId,
        [tab.idKey]: rec.id, email: rec.email || '', name: rec[tab.nameKey] || '', phone: rec.phone || '',
      });
      setSuccess(action === 'resend' ? 'Casuumaad dib loo diray.' : 'Casuumaad la diray.');
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
                    <TouchableOpacity onPress={() => doInvite(rec, 'resend')} style={[styles.btn, { borderColor: c.line }]}><Text style={[styles.btnTxt, { color: c.blue }]}>Dib u dir</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => doRevoke(inv)} style={[styles.btn, { borderColor: c.line }]}><Text style={[styles.btnTxt, { color: c.rose }]}>Jooji</Text></TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => doInvite(rec, 'invite')} style={[styles.btn, { backgroundColor: c.blue, borderColor: c.blue }]}><Text style={[styles.btnTxt, { color: '#fff' }]}>U dir Casuumaad</Text></TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ModuleScreenFrame>
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
  active: { fontSize: 12, fontWeight: '800' },
  btn: { borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 10 },
  btnTxt: { fontSize: 11.5, fontWeight: '800' },
});
