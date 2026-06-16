import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';

type Props = { navigation: NativeStackNavigationProp<any> };

const features = [
  { icon: '\u{1F468}‍\u{1F393}', title: 'Student Management', titleSo: 'Maamulka Ardayda' },
  { icon: '\u{1F469}‍\u{1F3EB}', title: 'Teacher Profiles', titleSo: 'Xogta Macalimiinta' },
  { icon: '📅', title: 'Attendance Tracking', titleSo: 'Raadinta Xaadirisinta' },
  { icon: '💳', title: 'Fee Payments', titleSo: 'Lacag-bixinta Ardayda' },
  { icon: '📝', title: 'Exams & Results', titleSo: 'Imtixaanada & Natiijada' },
  { icon: '⚠️', title: 'Student Incidents', titleSo: 'Kiisaska Ardayga' },
  { icon: '📨', title: 'Parent Messaging', titleSo: 'Farriimaha Waalidka' },
  { icon: '📊', title: 'Reports & Analytics', titleSo: 'Warbixinta & Falanqaynta' },
];

export const LandingScreen: React.FC<Props> = ({ navigation }) => (
  <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.logoCircle}><Text style={styles.logoK}>K</Text></View>
      <Text style={styles.brand}>Kobciye</Text>
      <Text style={styles.tagline}>Premium School Management SaaS</Text>
      <Text style={styles.taglineSo}>Maamulka Dugsiga Heerka Sare</Text>
      <View style={styles.heroActions}>
        <PrimaryButton label="Register Your School" onPress={() => navigation.navigate('RegisterSchool')} style={styles.heroBtn} />
        <SecondaryButton label="View Pricing" onPress={() => navigation.navigate('Pricing')} style={styles.heroBtn} />
      </View>
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Everything Your School Needs</Text>
      <Text style={styles.sectionTitleSo}>Wax kasta oo Dugsigaagu u baahan yahay</Text>
      <View style={styles.featureGrid}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureTitleSo}>{f.titleSo}</Text>
          </View>
        ))}
      </View>
    </View>
    <View style={styles.ctaCard}>
      <Text style={styles.ctaTitle}>Ready to transform your school?</Text>
      <Text style={styles.ctaTitleSo}>Ma diyaar u tahay inaad dugsigaaga beddesho?</Text>
      <PrimaryButton label="Get Started Free" onPress={() => navigation.navigate('RegisterSchool')} style={{ marginTop: 16 }} />
    </View>
    <View style={styles.loginRow}>
      <Text style={styles.loginHint}>Already registered? </Text>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.loginLink}>Login →</Text></TouchableOpacity>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48 },
  hero: { backgroundColor: Colors.navy, alignItems: 'center', paddingTop: 70, paddingBottom: 48, paddingHorizontal: 24 },
  logoCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoK: { fontSize: 42, fontWeight: '900', color: Colors.navy },
  brand: { fontSize: 32, fontWeight: '900', color: Colors.surface, letterSpacing: 1 },
  tagline: { fontSize: 15, color: Colors.navy300, marginTop: 6 },
  taglineSo: { fontSize: 13, color: Colors.gold, marginTop: 2, marginBottom: 24 },
  heroActions: { gap: 10, width: '100%' },
  heroBtn: { width: '100%' },
  section: { paddingHorizontal: 20, paddingTop: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  sectionTitleSo: { fontSize: 13, color: Colors.muted, marginBottom: 18 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, width: '47%', ...Shadows.sm },
  featureIcon: { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  featureTitleSo: { fontSize: 11, color: Colors.muted },
  ctaCard: { backgroundColor: Colors.navy, margin: 20, borderRadius: Radius.lg, padding: 24, alignItems: 'center' },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: Colors.surface, textAlign: 'center', marginBottom: 2 },
  ctaTitleSo: { fontSize: 13, color: Colors.gold, textAlign: 'center' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginHint: { color: Colors.muted, fontSize: 14 },
  loginLink: { color: Colors.blue, fontWeight: '700', fontSize: 14 },
});
