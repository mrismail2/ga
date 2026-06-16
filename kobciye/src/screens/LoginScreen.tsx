import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<any> };

export const LoginScreen: React.FC<Props> = ({ navigation }) => (
  <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <View style={styles.logoWrap}>
      <View style={styles.logoCircle}><Text style={styles.logoK}>K</Text></View>
      <Text style={styles.brand}>Kobciye</Text>
      <Text style={styles.tagline}>School Management Platform</Text>
    </View>
    <View style={styles.noticeCard}>
      <Text style={styles.noticeIcon}>🔐</Text>
      <Text style={styles.noticeTitle}>Login Coming in Phase 3</Text>
      <Text style={styles.noticeText}>Secure login will be activated in Phase 3.</Text>
      <Text style={styles.noticeSo}>Gelitaanka ammaan ah waxaa la shidli doonaa Marxaladda 3.</Text>
      <View style={styles.divider} />
      <Text style={styles.noticeHint}>{`Phase 3 will include:\n• Supabase Auth integration\n• Role-based access control\n• Secure session management\n• Multi-school support`}</Text>
    </View>
    <View style={styles.phaseRow}>
      {['Phase 1\nUI Foundation', 'Phase 2\nDatabase', 'Phase 3\nAuth & Login', 'Phase 4\nFull Launch'].map((p, i) => (
        <View key={i} style={styles.phaseItem}>
          <View style={[styles.phaseDot, i === 0 && styles.phaseActive, i === 2 && styles.phaseFocus]} />
          <Text style={[styles.phaseLabel, i === 0 && styles.phaseActiveText]}>{p}</Text>
        </View>
      ))}
    </View>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
      <Text style={styles.backText}>← Back to Home</Text>
    </TouchableOpacity>
  </ScrollView>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48, paddingTop: 60, paddingHorizontal: 24, alignItems: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoK: { fontSize: 42, fontWeight: '900', color: Colors.gold },
  brand: { fontSize: 28, fontWeight: '900', color: Colors.navy, letterSpacing: 1 },
  tagline: { fontSize: 13, color: Colors.muted, marginTop: 4 },
  noticeCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 24, width: '100%', alignItems: 'center', ...Shadows.md, borderWidth: 1.5, borderColor: Colors.border },
  noticeIcon: { fontSize: 44, marginBottom: 12 },
  noticeTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy, marginBottom: 8, textAlign: 'center' },
  noticeText: { fontSize: 14, color: Colors.text2, textAlign: 'center', lineHeight: 20 },
  noticeSo: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 18, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, width: '100%', marginVertical: 16 },
  noticeHint: { fontSize: 13, color: Colors.muted, lineHeight: 22, alignSelf: 'flex-start' },
  phaseRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 28, paddingHorizontal: 4 },
  phaseItem: { alignItems: 'center', flex: 1 },
  phaseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border2, marginBottom: 6 },
  phaseActive: { backgroundColor: Colors.green },
  phaseFocus: { backgroundColor: Colors.orange },
  phaseLabel: { fontSize: 10, color: Colors.muted, textAlign: 'center', lineHeight: 14 },
  phaseActiveText: { color: Colors.green, fontWeight: '700' },
  backBtn: { marginTop: 28, paddingVertical: 12, paddingHorizontal: 24, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.border2 },
  backText: { color: Colors.muted, fontWeight: '600', fontSize: 14 },
});
