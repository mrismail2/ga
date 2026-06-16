import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { TopHeader } from '../../components/TopHeader';
import { ModuleCard } from '../../components/ModuleCard';
import { PaymentBadge } from '../../components/PaymentBadge';
import { AttendanceBadge } from '../../components/AttendanceBadge';

const child = {
  name: 'Abdirashid Xasan',
  code: 'ARD-2024-089',
  class: 'Grade 5A',
  teacher: 'Maxamed Yuusuf',
  avatar: 'AX',
};

const modules = [
  { title: 'Carruurteyda',     titleEn: 'My Children',          icon: '👧', color: Colors.blue },
  { title: 'Xaadiris Maanta', titleEn: 'Attendance Today',     icon: '📅', color: Colors.green },
  { title: 'Lacag-bixinta',   titleEn: 'Payment Status',       icon: '💳', color: Colors.navy },
  { title: 'Natiijada',       titleEn: 'Exam Results',         icon: '📝', color: Colors.orange },
  { title: 'Fariimaha',       titleEn: 'Teacher Messages',     icon: '💬', color: Colors.blue, count: 2 },
  { title: 'Warbixinta',      titleEn: 'Parent Reports',       icon: '📊', color: Colors.navy600 },
  { title: 'Kiisaska',        titleEn: 'Behavior / Incidents', icon: '⚠️', color: Colors.red },
  { title: 'Ogeysiisyada',    titleEn: 'School Announcements', icon: '📢', color: Colors.gold700 },
  { title: 'Raad-raac',       titleEn: 'Follow-up Required',  icon: '🔔', color: Colors.orange, count: 1 },
];

export const ParentDashboard: React.FC = () => (
  <View style={styles.wrap}>
    <TopHeader
      title="Parent Dashboard"
      subtitle="Waalidka · Xogta Carruurteyda"
      userName="Faadumo Cabdi"
      userRole="Waalid (Parent)"
    />
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>👦 My Child · Ilmaheeyga</Text>
      <View style={styles.childCard}>
        <View style={styles.childAvatar}>
          <Text style={styles.childAvatarText}>{child.avatar}</Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childCode}>#{child.code}</Text>
          <Text style={styles.childMeta}>{child.class} · {child.teacher}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>📋 Today's Status · Xaaladda Maanta</Text>
      <View style={styles.statusRow}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Attendance</Text>
          <AttendanceBadge status="present" />
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Payment</Text>
          <PaymentBadge status="partial" />
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Behavior</Text>
          <View style={[styles.behaviorBadge, { backgroundColor: Colors.greenSoft }]}>
            <Text style={[styles.behaviorText, { color: Colors.green }]}>Good</Text>
          </View>
        </View>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>📢</Text>
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>School Announcement</Text>
          <Text style={styles.noticeText}>
            Final exams will begin on June 25th. Please ensure your child is well prepared.
          </Text>
          <Text style={styles.noticeTime}>Today, 10:00 AM</Text>
        </View>
      </View>

      <View style={[styles.alertCard, { borderColor: Colors.orange + '50' }]}>
        <Text style={styles.alertIcon}>⚠️</Text>
        <View style={styles.alertContent}>
          <Text style={styles.alertTitle}>Follow-up Required · Raad-raac Loo Baahan Yahay</Text>
          <Text style={styles.alertText}>
            Payment balance of $60 is due by June 20th. Please contact the school office.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>📦 Parent Modules · Qaybaha Waalidka</Text>
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
  childCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadows.md,
  },
  childAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  childAvatarText: { color: Colors.navy, fontWeight: '800', fontSize: 20 },
  childInfo: {},
  childName: { color: Colors.surface, fontSize: 17, fontWeight: '800' },
  childCode: { color: Colors.navy300, fontSize: 12, marginTop: 2 },
  childMeta: { color: Colors.gold, fontSize: 13, marginTop: 4 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flex: 1,
    alignItems: 'center',
    gap: 8,
    ...Shadows.sm,
  },
  statusLabel: { fontSize: 12, color: Colors.muted, fontWeight: '600' },
  behaviorBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  behaviorText: { fontSize: 12, fontWeight: '600' },
  noticeCard: {
    backgroundColor: Colors.blueSoft,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  noticeIcon: { fontSize: 20 },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginBottom: 4 },
  noticeText: { fontSize: 12, color: Colors.text2, lineHeight: 18 },
  noticeTime: { fontSize: 11, color: Colors.muted, marginTop: 4 },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    borderWidth: 1,
    ...Shadows.sm,
  },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: Colors.orange, marginBottom: 4 },
  alertText: { fontSize: 12, color: Colors.text2, lineHeight: 18 },
});
