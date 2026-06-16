import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { TopHeader } from '../../components/TopHeader';
import { ModuleCard } from '../../components/ModuleCard';
import { AttendanceBadge } from '../../components/AttendanceBadge';
import { PaymentBadge } from '../../components/PaymentBadge';

const student = {
  name: 'Abdirashid Xasan',
  class: 'Grade 5A',
  teacher: 'Maxamed Yuusuf',
  avatar: 'AX',
};

const subjects = [
  { name: 'Mathematics', teacher: 'Maxamed Yuusuf', score: 85 },
  { name: 'Science',     teacher: 'Caasha Mahad',   score: 78 },
  { name: 'Arabic',      teacher: 'Bashir Axmed',   score: 92 },
  { name: 'English',     teacher: 'Faadumo Cali',   score: 74 },
  { name: 'Somali',      teacher: 'Amina Warsame',  score: 88 },
];

const modules = [
  { title: 'Profile-keyga',   titleEn: 'My Profile',          icon: '👤', color: Colors.navy },
  { title: 'Fasalkeyga',      titleEn: 'My Class',            icon: '🏫', color: Colors.blue },
  { title: 'Xaadirisinta',    titleEn: 'Attendance Summary',  icon: '📅', color: Colors.green },
  { title: 'Natiijada',       titleEn: 'Exam Results',        icon: '📝', color: Colors.orange },
  { title: 'Lacag-bixinta',   titleEn: 'Payment Status',      icon: '💳', color: Colors.navy },
  { title: 'Fariimaha',       titleEn: 'Messages',            icon: '💬', color: Colors.blue, count: 1 },
  { title: 'Dhaleeceynta',    titleEn: 'Teacher Feedback',    icon: '💬', color: Colors.gold700 },
  { title: 'Dhaqanka',        titleEn: 'Behavior Summary',    icon: '⭐', color: Colors.green },
  { title: 'Ogeysiisyada',    titleEn: 'Latest Notice',       icon: '📢', color: Colors.navy600 },
];

export const StudentDashboard: React.FC = () => (
  <View style={styles.wrap}>
    <TopHeader
      title="Student Dashboard"
      subtitle="Arday · Dugsiga Hidaayada"
      userName={student.name}
      userRole={`Arday · ${student.class}`}
    />
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student.avatar}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{student.name}</Text>
          <Text style={styles.profileClass}>{student.class} · {student.teacher}</Text>
          <View style={styles.statusRow}>
            <AttendanceBadge status="present" />
            <PaymentBadge status="partial" />
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>\ud83d� My Subjects · Maaddooyinkeyda</Text>
      {subjects.map((s, i) => (
        <View key={i} style={styles.subjectRow}>
          <View style={[styles.subjectIcon, { backgroundColor: Colors.blue + '15' }]}>
            <Text style={{ fontSize: 16 }}>📖</Text>
          </View>
          <View style={styles.subjectInfo}>
            <Text style={styles.subjectName}>{s.name}</Text>
            <Text style={styles.subjectTeacher}>{s.teacher}</Text>
          </View>
          <View style={[styles.scoreBadge, {
            backgroundColor: s.score >= 80 ? Colors.greenSoft : s.score >= 60 ? Colors.orangeSoft : Colors.redSoft
          }]}>
            <Text style={[styles.scoreText, {
              color: s.score >= 80 ? Colors.green : s.score >= 60 ? Colors.orange : Colors.red
            }]}>{s.score}%</Text>
          </View>
        </View>
      ))}

      <View style={styles.behaviorCard}>
        <Text style={styles.behaviorIcon}>⭐</Text>
        <View style={styles.behaviorInfo}>
          <Text style={styles.behaviorTitle}>Behavior Summary · Koobida Dhaqanka</Text>
          <Text style={styles.behaviorText}>Good standing. No open incidents recorded.</Text>
          <Text style={styles.behaviorTextSo}>Xaalad wanaagsan. Kiis furan lama diiwaan-galin.</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>📦 My Modules</Text>
      {modules.map((m, i) => (
        <ModuleCard
          key={i}
          title={m.title}
          subtitle={m.titleEn}
          count={m.count}
          icon={<Text style={{ fontSize: 20 }}>{m.icon}</Text>}
          color={m.color}
        />
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  phaseBanner: {
    backgroundColor: Colors.orange + '20',
    paddingVertical: 7, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.orange + '30',
  },
  phaseText: { fontSize: 11, color: Colors.orange, fontWeight: '600', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10,
  },
  profileCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: 20,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    ...Shadows.md,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.navy, fontWeight: '800', fontSize: 20 },
  profileInfo: { flex: 1 },
  profileName: { color: Colors.surface, fontSize: 17, fontWeight: '800' },
  profileClass: { color: Colors.navy300, fontSize: 12, marginTop: 3 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  subjectRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    ...Shadows.sm,
  },
  subjectIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  subjectTeacher: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  scoreBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
  },
  scoreText: { fontSize: 14, fontWeight: '800' },
  behaviorCard: {
    backgroundColor: Colors.greenSoft,
    borderRadius: Radius.md,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  behaviorIcon: { fontSize: 28 },
  behaviorInfo: { flex: 1 },
  behaviorTitle: { fontSize: 13, fontWeight: '700', color: Colors.green, marginBottom: 4 },
  behaviorText: { fontSize: 13, color: Colors.text2, lineHeight: 18 },
  behaviorTextSo: { fontSize: 12, color: Colors.muted, marginTop: 2 },
});
