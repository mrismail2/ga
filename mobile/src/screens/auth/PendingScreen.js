import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../../components/Logo';
import Icon from '../../components/Icon';

/* Phase 3: an authenticated user whose DB role is 'pending' (no school yet).
   They are signed in for real, but have no dashboard until an invitation is
   accepted or a super_admin assigns them a role. They see NO demo data. */
export default function PendingScreen() {
  const { c } = useTheme();
  const { signOut, profile, refreshProfile } = useAuth();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Logo size={54} />
        <View style={[styles.circle, { backgroundColor: c.goldSoft }]}>
          <Icon name="notice" size={30} color={c.gold700} strokeWidth={2.2} />
        </View>
        <Text style={[styles.title, { color: c.ink }]}>Akoonkaagu waa diyaar</Text>
        <Text style={[styles.sub, { color: c.muted }]}>
          {profile && profile.full_name ? `${profile.full_name}, ` : ''}
          weli dugsi laguuma xirin. Haddii lagu casuumay maamule, fur link-ga email-kaaga si aad u dhammaystirto.
          Haddii kale, la sug maamulaha guud inuu ku siiyo door.
        </Text>

        <TouchableOpacity style={[styles.btn, { backgroundColor: c.navy }]} onPress={refreshProfile} activeOpacity={0.9}>
          <Icon name="clock" size={16} color="#fff" strokeWidth={2} />
          <Text style={styles.btnTxt}>Dib u eeg xaaladda</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut} style={{ marginTop: 18 }}>
          <Text style={[styles.link, { color: c.blue }]}>Ka bax</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13.5, fontWeight: '600', marginTop: 10, textAlign: 'center', lineHeight: 21 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, paddingHorizontal: 26, marginTop: 26 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  link: { fontSize: 14, fontWeight: '700' },
});
