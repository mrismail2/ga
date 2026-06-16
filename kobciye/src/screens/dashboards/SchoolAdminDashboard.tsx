import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { StatCard } from '../../components/StatCard';
import { ActionCard } from '../../components/ActionCard';
import { ModuleCard } from '../../components/ModuleCard';
import { TopHeader } from '../../components/TopHeader';
import { EmptyState } from '../../components/EmptyState';

const stats = [
  { label: 'Tirada Ardayda', labelEn: 'Total Students', value: 267, trend: '4.2%', up: true, color: '#6C63FF' },
  { label: 'Macalimiinta',   labelEn: 'Teachers',       value: 18,  trend: '2.0%', up: true, color: Colors.gold },
  { label: 'Lacagta Bishan', labelEn: 'Monthly Revenue', value: '$6,200', trend: '8.5%', up: true, color: Colors.green },
  { label: 'Xaadirinta',     labelEn: 'Attendance Today', value: '94%', trend: '1.1%', up: false, color: Colors.blue },
];

const quickActions = [
  { label: 'Add Student',       labelSo: 'Ku dar Arday',   icon: '👤', color: Colors.blue },
  { label: 'Add Teacher',       labelSo: 'Ku dar Macalin', icon: '👩‍🏫', color: Colors.navy },
  { label: 'View Attendance',   labelSo: 'Xaadiris',       icon: '📅', color: Colors.green },
  { label: 'View Payments',     labelSo: 'Lacag-bixin',    icon: '💳', color: Colors.gold700 },
  { label: 'View Reports',      labelSo: 'Warbixinta',     icon: '📊', color: Colors.navy600 },
  { label: 'View Incidents',    labelSo: 'Kiisaska',       icon: '⚠️', color: Colors.red },
];

const modules = [
  { title: 'Ardayda',     titleEn: 'Students',        icon: '👨‍🎓', color: '#6C63FF', count: 267 },
  { title: 'Macalimiinta', titleEn: 'Teachers',       icon: '👩‍🏫', color: Colors.gold700, count: 18 },
  { title: 'Fasallada',   titleEn: 'Classes',         icon: '🏫', color: Colors.blue, count: 12 },
  { title: 'Xaadirinta',  titleEn: 'Attendance',      icon: '📅', color: Colors.green },
  { title: 'Maaliyadda',  titleEn: 'Finance',         icon: '💳', color: Colors.navy },
  { title: 'Imtixaanada', titleEn: 'Exams',          icon: '📝', color: Colors.orange },
  { title: 'Kiisaska',    titleEn: 'Student Incidents', icon: '⚠️', color: Colors.red, count: 2 },
  { title: 'Fariimaha',   titleEn: 'Messages',        icon: '💬', color: Colors.blue, count: 5 },
  { title: 'Warbixinta',  titleEn: 'Reports',         icon: '📊', color: Colors.navy600 },
  { title: 'Oggolaanshaha', titleEn: 'Permissions',   icon: '🔐', color: Colors.muted },
];

const recentActivity = [
  { text: 'Faadumo Cali marked attendance for Grade 5A', time: '10 min ago', icon: '📅' },
  { text: 'New payment received: Abdirashid Xasan - $120', time: '25 min ago', icon: '💳' },
  { text: 'Incident reported: Grade 3B - Misconduct', time: '1 hr ago', icon: '⚠️' },
  { text: 'Exam results entered: Mathematics Grade 7', time: '2 hrs ago', icon: '📝' },
  { text: 'New teacher registered: Caasha Mahad', time: '3 hrs ago', icon: '👩‍🏫' },
];

export const SchoolAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'activity'>('overview');

  return (
    <View style={styles.wrap}>
      <TopHeader
        title="School Admin Dashboard"
        subtitle="Dugsiga Hidaayada · Gabiley"
        userName="Faadumo Cali"
        userRole="Maamulaha Dugsiga"
      />

      <View style={styles.phaseBanner}>
        <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
      </View>

      <View style={styles.tabs}>
        {(['overview', 'modules', 'activity'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'overview' ? 'Overview' : tab === 'modules' ? 'Modules' : 'Activity'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeTab === 'overview' && (
          <>
            <Text style={styles.sectionLabel}>📊 School Overview</Text>
            <View style={styles.statsGrid}>
              {stats.map((s, i) => (
                <StatCard
                  key={i}
                  label={`${s.label}\n${s.labelEn}`}
                  value={s.value}
                  trend={s.trend}
                  trendUp={s.up}
                  accentColor={s.color}
                  style={styles.statCard}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>⚡ Quick Actions · Ficilada Degdega</Text>
            <View style={styles.actionsGrid}>
              {quickActions.map((a, i) => (
                <ActionCard
                  key={i}
                  label={`${a.label}\n${a.labelSo}`}
                  icon={<Text style={{ fontSize: 22 }}>{a.icon}</Text>}
                  color={a.color}
                  style={styles.actionCard}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>🚨 Alerts · Ogeysiisyada</Text>
            <View style={styles.alertCard}>
              <Text style={styles.alertIcon}>⚠️</Text>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>2 Open Student Incidents</Text>
                <Text style={styles.alertSub}>Kiisas Furan: 2 · Requires attention</Text>
              </View>
              <View style={[styles.alertBadge, { backgroundColor: Colors.red }]}>
                <Text style={styles.alertBadgeText}>2</Text>
              </View>
            </View>
            <View style={[styles.alertCard, { borderColor: Colors.orange + '40' }]}>
              <Text style={styles.alertIcon}>💳</Text>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>43 Unpaid Fee Students</Text>
                <Text style={styles.alertSub}>Ardayda aan lacag bixin: 43</Text>
              </View>
              <View style={[styles.alertBadge, { backgroundColor: Colors.orange }]}>
                <Text style={styles.alertBadgeText}>43</Text>
              </View>
            </View>
            <View style={[styles.alertCard, { borderColor: Colors.green + '40' }]}>
              <Text style={styles.alertIcon}>📅</Text>
              <View style={styles.alertText}>
                <Text style={styles.alertTitle}>Attendance at 94% today</Text>
                <Text style={styles.alertSub}>Xaadirinta Maanta: 94%</Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'modules' && (
          <>
            <Text style={styles.sectionLabel}>📦 All Modules · Dhammaan Qaybaha</Text>
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
          </>
        )}

        {activeTab === 'activity' && (
          <>
            <Text style={styles.sectionLabel}>🕐 Recent Activity · Hawlaha Dhowaan</Text>
            {recentActivity.map((a, i) => (
              <View key={i} style={styles.activityItem}>
                <Text style={styles.activityIcon}>{a.icon}</Text>
                <View style={styles.activityText}>
                  <Text style={styles.activityTitle}>{a.text}</Text>
                  <Text style={styles.activityTime}>{a.time}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

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
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.blue },
  tabText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
  tabTextActive: { color: Colors.blue },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '30%' },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.red + '30',
    ...Shadows.sm,
  },
  alertIcon: { fontSize: 22 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  alertSub: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  alertBadgeText: { color: Colors.surface, fontSize: 12, fontWeight: '700' },
  activityItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 8,
    ...Shadows.sm,
  },
  activityIcon: { fontSize: 20 },
  activityText: { flex: 1 },
  activityTitle: { fontSize: 13, color: Colors.text, lineHeight: 18, fontWeight: '500' },
  activityTime: { fontSize: 11, color: Colors.muted, marginTop: 3 },
});
