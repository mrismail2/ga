import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { StatCard } from '../../components/StatCard';
import { ModuleCard } from '../../components/ModuleCard';
import { TopHeader } from '../../components/TopHeader';

const stats = [
  { label: 'Total Schools\nDugsiyo Guud', value: 38,    trend: '12.5%', up: true,  color: Colors.blue },
  { label: 'Active Schools\nDugsiyo Firfircoon', value: 31, trend: '8.2%', up: true,  color: Colors.green },
  { label: 'Pending Requests\nCodsiyada Sugaya', value: 5,  trend: '',     up: false, color: Colors.orange },
  { label: 'Suspended\nJoojiyay',  value: 2,    trend: '',     up: false, color: Colors.red },
  { label: 'Active Subscriptions\nRuqsad Firfircoon', value: 31, trend: '8.2%', up: true, color: '#6C63FF' },
  { label: 'Platform Revenue\nDakhliga Platform', value: '$18,400', trend: '14.1%', up: true, color: Colors.gold700 },
];

const modules = [
  { title: 'Dugsiyo',         titleEn: 'All Schools',     icon: '🏫', color: Colors.blue },
  { title: 'Maamulayaasha',   titleEn: 'School Admins',   icon: '👤', color: Colors.navy },
  { title: 'Ruqsadaha',       titleEn: 'Subscriptions',   icon: '📋', color: '#6C63FF' },
  { title: 'Dakhliga',        titleEn: 'Platform Revenue', icon: '💰', color: Colors.green },
  { title: 'Ogeysiisyada',    titleEn: 'System Alerts',   icon: '🔔', color: Colors.red, count: 3 },
  { title: 'Codsiyada',       titleEn: 'Pending Requests', icon: '📩', color: Colors.orange, count: 5 },
  { title: 'Warbixinta',      titleEn: 'Platform Reports', icon: '📊', color: Colors.navy600 },
  { title: 'Goobaha',         titleEn: 'System Settings', icon: '⚙️', color: Colors.muted },
];

const alerts = [
  { text: '5 new school registrations pending review', icon: '📩', color: Colors.orange },
  { text: '2 schools have overdue subscription payments', icon: '💳', color: Colors.red },
  { text: 'System backup completed successfully', icon: '✅', color: Colors.green },
  { text: 'Platform uptime: 99.97% this month', icon: '📡', color: Colors.blue },
];

export const SuperAdminDashboard: React.FC = () => (
  <View style={styles.wrap}>
    <TopHeader
      title="Super Admin"
      subtitle="Kobciye Platform Management"
      userName="Super Admin"
      userRole="Platform Owner"
    />
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>📊 Platform Overview</Text>
      <View style={styles.statsGrid}>
        {stats.map((s, i) => (
          <StatCard
            key={i}
            label={s.label}
            value={s.value}
            trend={s.trend || undefined}
            trendUp={s.up}
            accentColor={s.color}
            style={styles.statCard}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>⚠️ System Alerts</Text>
      {alerts.map((a, i) => (
        <View key={i} style={[styles.alertRow, { borderLeftColor: a.color }]}>
          <Text style={styles.alertIcon}>{a.icon}</Text>
          <Text style={styles.alertText}>{a.text}</Text>
        </View>
      ))}

      <Text style={styles.sectionLabel}>📦 Platform Modules</Text>
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
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.orange + '30',
  },
  phaseText: { fontSize: 11, color: Colors.orange, fontWeight: '600', textAlign: 'center' },
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
  alertRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    borderLeftWidth: 3,
    ...Shadows.sm,
  },
  alertIcon: { fontSize: 18 },
  alertText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 18 },
});
