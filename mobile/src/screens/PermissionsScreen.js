import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Card from '../components/Card';
import { PERMISSION_LABELS } from '../services/permissionStorage';

// auto-generate a temporary password (prototype only — no real auth)
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return 'Kob-' + p;
}

const PERM_ORDER = Object.keys(PERMISSION_LABELS);

/* Teacher permission matrix + invite. The School Admin toggles a teacher's
   permissions; each change persists to AsyncStorage (via RoleContext) and
   updates the teacher's UI/navigation immediately. */
export default function PermissionsScreen({ navigation }) {
  const { c } = useTheme();
  const { teacherPerms, setTeacherPermission } = useRole();
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState(null); // { email, password }

  const granted = PERM_ORDER.filter((k) => teacherPerms[k]).length;

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const sendInvite = () => {
    if (!validEmail) return;
    setInvite({ email: email.trim(), password: genPassword() });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Permissions"
          subtitle={`Macalin · ${granted}/${PERM_ORDER.length} la oggolaaday`}
          right={
            navigation ? (
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="back" size={20} color={c.ink} />
              </TouchableOpacity>
            ) : null
          }
        />

        {/* invite teacher by Gmail */}
        <Card>
          <Text style={[styles.fLabel, { color: c.muted }]}>GMAIL MACALINKA</Text>
          <View style={styles.emailRow}>
            <View style={[styles.emailBox, { backgroundColor: c.bg, borderColor: c.line }]}>
              <Icon name="mail" size={18} color={c.muted} />
              <TextInput
                value={email} onChangeText={setEmail}
                placeholder="macalin@gmail.com" placeholderTextColor={c.muted2}
                keyboardType="email-address" autoCapitalize="none"
                style={[styles.emailInput, { color: c.ink }]}
              />
            </View>
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: validEmail ? c.blue : c.muted2 }]} disabled={!validEmail} onPress={sendInvite}>
              <Icon name="send" size={16} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {invite ? (
            <View style={[styles.invite, { backgroundColor: c.greenSoft }]}>
              <Text style={[styles.inviteTitle, { color: c.green }]}>✓ Casoomaad la diray Gmail-ka</Text>
              <Text style={[styles.inviteLine, { color: c.ink2 }]}>📧 {invite.email}</Text>
              <Text style={[styles.inviteLine, { color: c.ink2 }]}>🔑 Furaha ku-meelgaarka: <Text style={{ fontWeight: '800' }}>{invite.password}</Text></Text>
              <Text style={[styles.inviteLine, { color: c.ink2 }]}>🔗 Link la diray — macalinku wuxuu arki karaa waxa la oggolaaday kaliya.</Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: c.muted2 }]}>
              Geli Gmail-ka macalinka → furaha si toos ah ayaa loo sameeyaa → link ayaa loo diraa.
            </Text>
          )}
        </Card>

        <View style={[styles.banner, { backgroundColor: c.blueSoft, marginTop: 14 }]}>
          <Icon name="settings" size={18} color={c.navy} />
          <Text style={[styles.bannerTxt, { color: c.navy }]}>
            Dooro waxa macalinku arki/samayn karo. Wixii aad oggolaato ayuu macalinku arki karaa.
          </Text>
        </View>

        <Card padded={false} style={{ marginTop: 14 }}>
          {PERM_ORDER.map((code, i) => (
            <View key={code} style={[styles.row, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.ink }]}>{PERMISSION_LABELS[code]}</Text>
                <Text style={[styles.code, { color: c.muted2 }]}>{code}</Text>
              </View>
              <Switch value={!!teacherPerms[code]} onValueChange={(v) => setTeacherPermission(code, v)} trackColor={{ true: c.blue }} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14 },
  bannerTxt: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  label: { fontSize: 14, fontWeight: '700' },
  code: { fontSize: 11.5, marginTop: 2 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  emailRow: { flexDirection: 'row', gap: 10 },
  emailBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  emailInput: { flex: 1, fontSize: 14 },
  sendBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invite: { borderRadius: 12, padding: 14, marginTop: 12, gap: 5 },
  inviteTitle: { fontSize: 13.5, fontWeight: '800' },
  inviteLine: { fontSize: 12.5, lineHeight: 18 },
  hint: { fontSize: 11.5, lineHeight: 17, marginTop: 10 },
});
