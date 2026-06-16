import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<any> };

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => (
  <View style={styles.wrap}>
    <View style={styles.card}>
      <Text style={styles.icon}>🔑</Text>
      <Text style={styles.title}>Password Reset</Text>
      <Text style={styles.subtitle}>Dib u dejinta Furaha Sirta</Text>
      <Text style={styles.body}>Password reset will be available in Phase 3 when Supabase Auth is activated.</Text>
      <Text style={styles.bodySo}>Dib u dejinta furaha sirta waxaa la heli doonaa Marxaladda 3 markii Supabase Auth la shidlo.</Text>
    </View>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
      <Text style={styles.backText}>← Back to Login</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 28, width: '100%', alignItems: 'center', ...Shadows.md },
  icon: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.navy, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.muted, marginBottom: 16 },
  body: { fontSize: 14, color: Colors.text2, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  bodySo: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 18 },
  backBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border2 },
  backText: { color: Colors.muted, fontWeight: '600', fontSize: 14 },
});
