import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';
import { FormInput } from '../components/FormInput';
import { PrimaryButton } from '../components/PrimaryButton';

type Props = { navigation: NativeStackNavigationProp<any> };
const schoolTypes = ['Primary School', 'Secondary School', 'Combined School', 'University', 'Islamic School'];

export const RegisterSchoolScreen: React.FC<Props> = ({ navigation }) => {
  const [form, setForm] = useState({ schoolName: '', schoolType: 'Primary School', region: '', principalName: '', email: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);
  const set = (field: string) => (val: string) => setForm((f) => ({ ...f, [field]: val }));

  if (submitted) {
    return (
      <View style={styles.successWrap}>
        <Text style={styles.successIcon}>🎉</Text>
        <Text style={styles.successTitle}>Registration Submitted!</Text>
        <Text style={styles.successTitleSo}>Diiwaangelinta waa la gudbiyay!</Text>
        <Text style={styles.successText}>Thank you for registering {form.schoolName}. Our team will review your application and activate your account in Phase 3.</Text>
        <PrimaryButton label="Back to Home" onPress={() => navigation.navigate('Landing')} style={{ marginTop: 20, width: '100%' }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.title}>Register Your School</Text>
      <Text style={styles.titleSo}>Dugsigu ku Diiwaan-galin</Text>
      <Text style={styles.subtitle}>Fill in your school details below. Our team will review and activate your account.</Text>
      <View style={styles.card}>
        <FormInput label="School Name / Magaca Dugsiga" value={form.schoolName} onChangeText={set('schoolName')} placeholder="e.g. Dugsiga Hidaayada" />
        <Text style={styles.fieldLabel}>School Type / Nooca Dugsiga</Text>
        <View style={styles.typeRow}>
          {schoolTypes.map((t) => (
            <TouchableOpacity key={t} onPress={() => set('schoolType')(t)} style={[styles.typeChip, form.schoolType === t && styles.typeChipActive]}>
              <Text style={[styles.typeText, form.schoolType === t && styles.typeTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormInput label="Region / City" value={form.region} onChangeText={set('region')} placeholder="e.g. Gabiley" style={{ marginTop: 16 }} />
        <FormInput label="Principal Name" value={form.principalName} onChangeText={set('principalName')} />
        <FormInput label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
        <FormInput label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <View style={styles.noticeBox}><Text style={styles.noticeText}>⚠️ Phase 1 UI preview. No real data saved. Full activation in Phase 3.</Text></View>
        <PrimaryButton label="Submit Registration" onPress={() => setSubmitted(true)} style={{ marginTop: 8 }} color={Colors.navy} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  back: { marginBottom: 16 },
  backText: { color: Colors.blue, fontWeight: '600', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, marginBottom: 2 },
  titleSo: { fontSize: 14, color: Colors.muted, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 20, ...Shadows.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text2, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  typeChipActive: { borderColor: Colors.navy, backgroundColor: Colors.navy },
  typeText: { fontSize: 12, color: Colors.text2, fontWeight: '600' },
  typeTextActive: { color: Colors.surface },
  noticeBox: { backgroundColor: Colors.orangeSoft, borderRadius: Radius.sm, padding: 12, marginTop: 16, marginBottom: 8 },
  noticeText: { fontSize: 12, color: Colors.orange, lineHeight: 16 },
  successWrap: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { fontSize: 60, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginBottom: 4 },
  successTitleSo: { fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 16 },
  successText: { fontSize: 14, color: Colors.text2, textAlign: 'center', lineHeight: 20 },
});
