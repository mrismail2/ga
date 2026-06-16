import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';
import { Avatar } from './Avatar';
import { PaymentBadge } from './PaymentBadge';
import { AttendanceBadge } from './AttendanceBadge';

interface StudentCardProps { name: string; code?: string; className: string; paymentStatus: 'paid' | 'unpaid' | 'partial' | 'free'; attendanceStatus: 'present' | 'absent' | 'late' | 'excused'; onPress?: () => void; }

export const StudentCard: React.FC<StudentCardProps> = ({ name, code, className, paymentStatus, attendanceStatus, onPress }) => {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <Avatar initials={initials} size={46} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{code ? `#${code} · ` : ''}{className}</Text>
        <View style={styles.badges}><PaymentBadge status={paymentStatus} /><AttendanceBadge status={attendanceStatus} /></View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.sm, marginBottom: 8 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  meta: { fontSize: 12, color: Colors.muted, marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
