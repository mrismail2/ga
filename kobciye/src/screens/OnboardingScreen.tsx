import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius } from '../constants/colors';

const slides = [
  { icon: '🏫', title: 'Premium School Management', desc: 'Manage students, teachers, attendance, payments and more from one powerful platform.', titleSo: 'Maamulka Dugsiga Heerka Sare', descSo: 'Maamul ardayda, macalimiinta, xaadirisinta, lacag-bixinta iyo wax kale oo badan hal platform oo xooggan.' },
  { icon: '📊', title: 'Track Every Student', desc: 'Monitor attendance, exam results, behavior and fee payments for every student.', titleSo: 'Raadi Arday Kasta', descSo: 'La socod xaadirisinta, natiijada imtixaanka, dhaqanka iyo lacag-bixinta ardayga kasta.' },
  { icon: '🔐', title: 'Multi-Role Access', desc: 'Role-based dashboards for Super Admin, School Admin, Teachers, Accountants, Parents and Students.', titleSo: 'Helitaan Doorka Saldhig', descSo: 'Dashboard-yada ku salaysan doorka: Super Admin, Maamulaha Dugsiga, Macalimiinta, Xisaabiyaha, Waalidka iyo Ardayda.' },
];

type Props = { navigation: NativeStackNavigationProp<any> };

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [current, setCurrent] = useState(0);
  const next = () => { if (current < slides.length - 1) setCurrent(current + 1); else navigation.replace('Landing'); };
  const skip = () => navigation.replace('Landing');
  const slide = slides[current];

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={skip} style={styles.skipBtn}><Text style={styles.skipText}>Skip</Text></TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.titleSo}>{slide.titleSo}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>
        <Text style={styles.descSo}>{slide.descSo}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (<View key={i} style={[styles.dot, i === current && styles.dotActive]} />))}
        </View>
        <TouchableOpacity onPress={next} style={styles.nextBtn}>
          <Text style={styles.nextText}>{current === slides.length - 1 ? 'Get Started' : 'Next →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  skipBtn: { position: 'absolute', top: 52, right: 24, zIndex: 10 },
  skipText: { color: Colors.muted, fontWeight: '600', fontSize: 14 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 80, marginBottom: 28 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.navy, textAlign: 'center', marginBottom: 4 },
  titleSo: { fontSize: 16, fontWeight: '600', color: Colors.blue, textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 15, color: Colors.text2, textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  descSo: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
  bottom: { paddingHorizontal: 32, paddingBottom: 48, alignItems: 'center', gap: 20 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border2 },
  dotActive: { backgroundColor: Colors.blue, width: 24, borderRadius: 4 },
  nextBtn: { backgroundColor: Colors.navy, paddingVertical: 14, paddingHorizontal: 48, borderRadius: Radius.md, width: '100%', alignItems: 'center' },
  nextText: { color: Colors.surface, fontWeight: '700', fontSize: 16 },
});
