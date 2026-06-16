import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<any> };

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [notifs, setNotifs] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [somali, setSomali] = useState(false);

  const sections = [
    {
      title: 'Preferences / Doorbidyada',
      items: [
        {
          label: 'Push Notifications / Ogeysiisyada', labelSo: 'Shid/Damee ogeysiisyada',
          type: 'switch' as const, value: notifs, onChange: setNotifs,
        },
        {
          label: 'Dark Mode / Habka Madow', labelSo: 'Habka madow',
          type: 'switch' as const, value: darkMode, onChange: setDarkMode,
        },
        {
          label: 'Somali Language / Af-Soomaali', labelSo: 'Beddel luqadda Soomaaliga',
          type: 'switch' as const, value: somali, onChange: setSomali,
        },
      ],
    },
    {
      title: 'Account / Xisaabta',
      items: [
        { label: 'Edit Profile / Wax ka beddel Profile', type: 'link' as const },
        { label: 'Change Password / Beddel Furaha', type: 'link' as const, note: 'Phase 3' },
        { label: 'School Settings / Goobaha Dugsiga', type: 'link' as const },
      ],
    },
    {
      title: 'About / Ku Saabsan',
      items: [
        { label: 'App Version / Nooca App', type: 'info' as const, value: 'Kobciye v1.0.0 — Phase 1' },
        { label: 'Supabase Status / Xaaladda Supabase', type: 'info' as const, value: '⏳ Not connected (Phase 2)' },
        { label: 'Auth Status / Xaaladda Auth', type: 'info' as const, value: '🔐 Not active (Phase 3)' },
        { label: 'Privacy Policy', type: 'link' as const },
        { label: 'Terms of Service', type: 'link' as const },
      ],
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.titleSo}>Goobaha / Dejinta</Text>
      </View>
      <View style={styles.phaseBanner}>
        <Text style={styles.phaseText}>📱 Phase 1 — Settings placeholder</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {sections.map((sec, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <View style={styles.card}>
              {sec.items.map((item, ii) => (
                <View key={ii} style={[styles.row, ii < sec.items.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowLabel}>
                    <Text style={styles.rowText}>{item.label}</Text>
                    {'labelSo' in item && item.labelSo && (
                      <Text style={styles.rowSo}>{item.labelSo}</Text>
                    )}
                    {'note' in item && item.note && (
                      <View style={styles.noteBadge}>
                        <Text style={styles.noteText}>{item.note}</Text>
                      </View>
                    )}
                  </View>
                  {item.type === 'switch' && (
                    <Switch
                      value={'value' in item ? (item.value as boolean) : false}
                      onValueChange={'onChange' in item ? (item.onChange as (v: boolean) => void) : undefined}
                      trackColor={{ false: Colors.border2, true: Colors.blue }}
                      thumbColor={Colors.surface}
                    />
                  )}
                  {item.type === 'link' && (
                    <Text style={styles.chevron}>›</Text>
                  )}
                  {item.type === 'info' && (
                    <Text style={styles.infoText}>{'value' in item ? item.value : ''}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  content: { padding: 16, paddingBottom: 48 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { flex: 1 },
  rowText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  rowSo: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  noteBadge: {
    marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, backgroundColor: Colors.orangeSoft, alignSelf: 'flex-start',
  },
  noteText: { fontSize: 10, color: Colors.orange, fontWeight: '600' },
  chevron: { fontSize: 20, color: Colors.muted },
  infoText: { fontSize: 12, color: Colors.muted, maxWidth: 160, textAlign: 'right' },
});
