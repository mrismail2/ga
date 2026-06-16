import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { StatCard } from '../../components/StatCard';
import { ModuleCard } from '../../components/ModuleCard';
import { TopHeader } from '../../components/TopHeader';

const stats = [
  { label: 'My Classes\nFasalladeyda', value: 4, color: Colors.blue },
  { label: 'My Subjects\nMaaddooyinkeyda', value: 3, color: Colors.navy },
  { label: 'Students\nArdayda', value: 124, color: '#6C63FF' },
  { label: 'Attendance\nXaadiris', value: '91%', color: Colors.green },
];

const myModules = [
  { title: 'Calaamadee Xaadiris', titleEn: 'Mark Attendance',      icon: '📅', color: Colors.green,   locked: false },
  { title: 'Gali Natiijada',      titleEn: 'Enter Exam Marks',     icon: '📝', color: Colors.blue,    locked: false },
  { title: 'Diyaarinta Casharka', titleEn: 'Lesson Preparations',  icon: '📖', color: Colors.navy,    locked: false },
  { title: 'Fariimaha',           titleEn: 'Messages',              icon: '💬', color: Colors.blue,    locked: false, count: 3 },
  { title: 'Diiwaangeli Kiis',    titleEn: 'Report Student Incident', icon: '⚠️', color: Colors.red, locked: false },
  { title: 'Kiisas Furan',        titleEn: 'Open Behavior Cases',  icon: '🔓', color: Colors.orange,  locked: false, count: 1 },
  { title: 'Ardayda Nugul',       titleEn: 'Students Needing Attention', icon: '🎯', color: Colors.red, locked: false },
  { title: 'Xisaabinta',          titleEn: 'Finance View',          icon: '💳', color: Colors.muted,  locked: true },
  { title: 'Maamulka',            titleEn: 'Admin Panel',           icon: '⚙️', color: Colors.muted,  locked: true },
];

const myClasses = [
  { name: 'Grade 5A', students: 32, subject: 'Mathematics' },
  { name: 'Grade 5B', students: 29, subject: 'Mathematics' },
  { name: 'Grade 6A', students: 35, subject: 'Science' },
  { name: 'Grade 6B', students: 28, subject: 'Science' },
];

export const TeacherDashboard: React.FC = () => (
  <View style={styles.wrap}>
    <TopHeader
      title="Teacher Dashboard"
      subtitle="Macalin · Dugsiga Hidaayada"
      userName="Maxamed Yuusuf"
      userRole="Macalin (Teacher)"
    />
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>📊 My Overview</Text>
      <View style={styles.statsGrid}>
        {stats.map((s, i) => (
          <StatCard key={i} label={s.label} value={s.value} accentColor={s.color} style={styles.statCard} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>🏫 My Classes · Fasalladeyda</Text>
      {myClasses.map((c, i) => (
        <View key={i} style={styles.classRow}>
          <View style={[styles.classIcon, { backgroundColor: Colors.blue + '18' }]}>
            <Text style={{ fontSize: 18 }}>🏫</Text>
          </View>
          <View style={styles.classInfo}>
            <Text style={styles.className}>{c.name}</Text>
            <Text style={styles.classMeta}>{c.subject} · {c.students} students</Text>
          </View>
          <View style={[styles.studentCount, { backgroundColor: Colors.blue }]}>
            <Text style={styles.studentCountText}>{c.students}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>📦 My Modules · Qaybaheyga</Text>
      <Text style={styles.lockedHint}>🔒 Locked modules require admin permission</Text>
      {myModules.map((m, i) => (
        <ModuleCard
          key={i}
          title={m.title}
          subtitle={m.titleEn}
          count={m.count}
          icon={<Text style={{ fontSize: 20 }}>{m.icon}</Text>}
          color={m.color}
          locked={m.locked}
        />
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.background },
  phaseBanner: {
    backgroundColor: Colors.orange + '20',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.orange + '30',
  },
  phaseText: { fontSize: 11, color: Colors.orange, fontWeight: '600', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%' },
  classRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    ...Shadows.sm,
  },
  classIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  classInfo: { flex: 1 },
  className: { fontSize: 14, fontWeight: '700', color: Colors.text },
  classMeta: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  studentCount: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
  },
  studentCountText: { color: Colors.surface, fontSize: 13, fontWeight: '700' },
  lockedHint: { fontSize: 11, color: Colors.muted, marginBottom: 8, fontStyle: 'italic' },
});
