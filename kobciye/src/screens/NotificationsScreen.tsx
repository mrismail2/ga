import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Radius, Shadows } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<any> };

const notifications = [
  { icon: '⚠️', title: 'New Incident Reported', body: 'Grade 5A - Bullying case opened by Maxamed Yuusuf', time: '10 min ago', color: Colors.red, unread: true },
  { icon: '💳', title: 'Payment Received', body: 'Abdirashid Xasan paid $120 for June fees', time: '25 min ago', color: Colors.green, unread: true },
  { icon: '📅', title: 'Attendance Alert', body: 'Grade 3B has 78% attendance today — below threshold', time: '1 hr ago', color: Colors.orange, unread: false },
  { icon: '📝', title: 'Exam Results Entered', body: 'Mathematics Grade 7 results are now available', time: '2 hrs ago', color: Colors.blue, unread: false },
  { icon: '👤', title: 'New Teacher Registered', body: 'Caasha Mahad has been added to the system', time: '3 hrs ago', color: Colors.navy, unread: false },
  { icon: '📢', title: 'School Announcement', body: 'Final exams begin June 25th - inform parents', time: '1 day ago', color: Colors.gold700, unread: false },
];

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => (
  <View style={styles.wrap}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.titleSo}>Ogeysiisyada</Text>
    </View>
    <View style={styles.phaseBanner}>
      <Text style={styles.phaseText}>📱 Phase 1 — Notifications module placeholder</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.filterRow}>
        {['All', 'Unread', 'Incidents', 'Payments'].map((f) => (
          <TouchableOpacity key={f} style={[styles.chip, f === 'All' && styles.chipActive]}>
            <Text style={[styles.chipText, f === 'All' && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {notifications.map((n, i) => (
        <View key={i} style={[styles.notifCard, n.unread && styles.unread]}>
          <View style={[styles.iconWrap, { backgroundColor: n.color + '18' }]}>
            <Text style={styles.icon}>{n.icon}</Text>
          </View>
          <View style={styles.notifContent}>
            <View style={styles.notifTop}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              {n.unread && <View style={styles.dot} />}
            </View>
            <Text style={styles.notifBody}>{n.body}</Text>
            <Text style={styles.notifTime}>{n.time}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  </View>
);

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
  content: { padding: 16, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  chipTextActive: { color: Colors.surface },
  notifCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    ...Shadows.sm,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: Colors.blue },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.blue },
  notifBody: { fontSize: 13, color: Colors.text2, lineHeight: 18 },
  notifTime: { fontSize: 11, color: Colors.muted, marginTop: 4 },
});
