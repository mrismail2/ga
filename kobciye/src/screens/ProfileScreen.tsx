import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';
import { Avatar } from '../components/Avatar';

type Props = { navigation: NativeStackNavigationProp<any> };

export const ProfileScreen: React.FC<Props> = ({ navigation }) => (
  <View style={styles.wrap}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.titleSo}>Profile-ka</Text>
    </View>
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 — Profile placeholder (Auth in Phase 3)</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {/* Profile hero */}
      <View style={styles.heroCard}>
        <Avatar initials="FC" size={72} color={Colors.gold} />
        <Text style={styles.heroName}>Faadumo Cali</Text>
        <Text style={styles.heroRole}>Maamulaha Dugsiga</Text>
        <Text style={styles.heroSchool}>Dugsiga Hidaayada · Gabiley</Text>
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>School Admin</Text>
        </View>
      </View>

      {/* Info cards */}
      <View style={styles.infoCard}>
        {[
          { label: 'Full Name / Magaca Buuxa', value: 'Faadumo Cali Warsame' },
          { label: 'Email / Emayl', value: 'faadumo@hidaayada.edu.so' },
          { label: 'Phone / Telefoon', value: '+252 63 4xx xxxx' },
          { label: 'Role / Door', value: 'School Admin' },
          { label: 'School / Dugsiga', value: 'Dugsiga Hidaayada' },
          { label: 'Region / Gobol', value: 'Gabiley, Somaliland' },
        ].map((item, i) => (
          <View key={i} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>🔐</Text>
        <Text style={styles.noticeText}>
          Profile editing and account management will be available in Phase 3 when Supabase Auth is activated.
        </Text>
      </View>
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  back: { fontSize: 22, color: Colors.blue, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  titleSo: { fontSize: 13, color: Colors.muted, marginTop: 2 },
  phaseBanner: {
    backgroundColor: Colors.orange + '20',
    paddingVertical: 7, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.orange + '30',
  },
  phaseText: { fontSize: 11, color: Colors.orange, fontWeight: '600', textAlign: 'center' },
  content: { padding: 20, paddingBottom: 48, alignItems: 'center' },
  heroCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    ...Shadows.md,
  },
  heroName: { color: Colors.surface, fontSize: 20, fontWeight: '800', marginTop: 12 },
  heroRole: { color: Colors.gold, fontSize: 14, marginTop: 4 },
  heroSchool: { color: Colors.navy300, fontSize: 12, marginTop: 4, marginBottom: 12 },
  roleChip: {
    backgroundColor: Colors.blue,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  roleChipText: { color: Colors.surface, fontWeight: '700', fontSize: 12 },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    width: '100%',
    ...Shadows.sm,
    marginBottom: 16,
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 16, paddingVertical: 14,
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  infoLabel: { fontSize: 11, color: Colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  noticeCard: {
    backgroundColor: Colors.blueSoft,
    borderRadius: Radius.md,
    padding: 16,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  noticeIcon: { fontSize: 20 },
  noticeText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 18 },
});
