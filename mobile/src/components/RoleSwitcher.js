import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';

/* Static role badge. The role is decided by the landing login
   (Dugsiga / Arday / Waalid) — it cannot be switched from inside the app. */
export default function RoleSwitcher() {
  const { c } = useTheme();
  const { profile } = useRole();

  return (
    <View style={[styles.pill, { backgroundColor: c.blueSoft, borderColor: c.line2, borderWidth: 1 }]}>
      <Text style={[styles.pillTxt, { color: c.navy }]}>{profile.labelSo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  pillTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
});
