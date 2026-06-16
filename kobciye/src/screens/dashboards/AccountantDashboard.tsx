import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Radius, Shadows } from '../../constants/colors';
import { StatCard } from '../../components/StatCard';
import { ModuleCard } from '../../components/ModuleCard';
import { TopHeader } from '../../components/TopHeader';
import { PaymentBadge } from '../../components/PaymentBadge';

const stats = [
  { label: 'Expected Revenue\nDakhliga La Filayo', value: '$12,500', color: Colors.blue },
  { label: 'Collected\nLa Ururiyay', value: '$8,600',  color: Colors.green, trend: '68.8%', up: true },
  { label: 'Remaining\nKu Hartay',   value: '$3,900',  color: Colors.red },
  { label: 'Paid Students\nArdayda La Bixiyay', value: 198, color: Colors.green },
  { label: 'Unpaid\nLama Bixin',    value: 43,         color: Colors.red },
  { label: 'Partial\nQayb La Bixiyay', value: 26,      color: Colors.orange },
];

const recentPayments = [
  { name: 'Abdirashid Xasan', amount: '$120', status: 'paid' as const, date: 'Today, 09:14' },
  { name: 'Hodan Maxamed',    amount: '$60',  status: 'partial' as const, date: 'Today, 08:55' },
  { name: 'Cali Abukar',      amount: '$120', status: 'paid' as const, date: 'Yesterday' },
  { name: 'Leyla Nuur',       amount: '$0',   status: 'unpaid' as const, date: '3 days ago' },
  { name: 'Guled Farah',      amount: '$120', status: 'paid' as const, date: '3 days ago' },
];

const modules = [
  { title: 'Lacag-bixinta',    titleEn: 'Payments',           icon: '💳', color: Colors.blue },
  { title: 'Ardayda Paid',     titleEn: 'Paid Students',      icon: '✅', color: Colors.green },
  { title: 'Ardayda Unpaid',   titleEn: 'Unpaid Students',    icon: '❌', color: Colors.red },
  { title: 'Qayb La Bixiyay', titleEn: 'Partial Payments',   icon: '⚡', color: Colors.orange },
  { title: 'Warbixinta',       titleEn: 'Payment Reports',    icon: '📊', color: Colors.navy },
  { title: 'Rasiidhada',       titleEn: 'Receipts',           icon: '🧾', color: Colors.navy600 },
];

export const AccountantDashboard: React.FC = () => (
  <View style={styles.wrap}>
    <TopHeader
      title="Accountant Dashboard"
      subtitle="Finance · Maaliyadda Dugsiga"
      userName="Sahra Axmed"
      userRole="Xisaabiye (Accountant)"
    />
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 UI Preview — No real data connected</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>💰 Finance Overview · Dulmar Maaliyadeed</Text>
      <View style={styles.statsGrid}>
        {stats.map((s, i) => (
          <StatCard
            key={i}
            label={s.label}
            value={s.value}
            trend={s.trend}
            trendUp={s.up}
            accentColor={s.color}
            style={styles.statCard}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>🕐 Recent Payments · Lacag-bixinta Dhowaan</Text>
      {recentPayments.map((p, i) => (
        <View key={i} style={styles.paymentRow}>
          <View style={styles.paymentAvatar}>
            <Text style={styles.paymentAvatarText}>{p.name[0]}</Text>
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentName}>{p.name}</Text>
            <Text style={styles.paymentDate}>{p.date}</Text>
          </View>
          <View style={styles.paymentRight}>
            <Text style={styles.paymentAmount}>{p.amount}</Text>
            <PaymentBadge status={p.status} />
          </View>
        </View>
      ))}

      <Text style={styles.sectionLabel}>📦 Finance Modules</Text>
      {modules.map((m, i) => (
        <ModuleCard
          key={i}
          title={m.title}
          subtitle={m.titleEn}
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '47%' },
  paymentRow: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    ...Shadows.sm,
  },
  paymentAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  paymentAvatarText: { color: Colors.surface, fontWeight: '700', fontSize: 16 },
  paymentInfo: { flex: 1 },
  paymentName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  paymentDate: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', gap: 4 },
  paymentAmount: { fontSize: 15, fontWeight: '800', color: Colors.text },
});
